import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, Layers3, Plus, RotateCcw, Sparkles } from "lucide-react";
import type { Concept, FlashcardVariant, ReviewLog, StudySettings, StudySubject } from "../../domain/study";
import { emptyFsrsState, rateFsrs, type FsrsGrade } from "../../domain/fsrs";
import {
  createConcept, getConcept, getStudySettings, listConcepts, listReviews,
  recordConceptReview, saveConcept,
} from "../../data/study";

const KINDS = ["Definição", "Diferenciação", "Comparação", "Identificação", "Competência", "Condição", "Exceção", "Lei seca", "Aplicação", "Armadilha"];
const FORMATS = [
  { value: "basic", label: "Pergunta e resposta" },
  { value: "cloze", label: "Lacuna" },
  { value: "typed", label: "Resposta digitada" },
  { value: "image", label: "Imagem" },
];
const uid = () => crypto.randomUUID();
function newVariant(): FlashcardVariant {
  return { id: uid(), kind: "Definição", format: "basic", q: "", a: "", reason: "", source: "", image: "", mask: null, status: "pending", uses: 0, passes: 0, failures: 0 };
}
function isPublished(concept: Concept) {
  return concept.status === "published" && !concept.suspended && concept.variants.some(variant => variant.status === "approved");
}
function formatCloze(value: string, revealed: boolean) {
  return value.replace(/\{\{c\d+::([\s\S]+?)(?:::[\s\S]+?)?\}\}/g, (_match, answer: string) => revealed ? answer : "＿＿＿＿");
}
function dueLabel(due: number) {
  if (due <= Date.now()) return "Vencido";
  return new Date(due).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function FamilyList() {
  const navigate = useNavigate();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [filter, setFilter] = useState<"all" | StudySubject>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [leechLimit, setLeechLimit] = useState(4);
  useEffect(() => { Promise.all([listConcepts(), getStudySettings()]).then(([items, settings]) => { setConcepts(items); setLeechLimit(settings.leech); }).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => concepts.filter(concept =>
    (filter === "all" || concept.subject === filter) &&
    concept.topic.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  ), [concepts, filter, search]);
  return <div className="stack">
    <header className="heading"><div><small>RITMO / APRENDIZAGEM</small><h1>Flashcards</h1><p>Uma família reúne até dez formas de cobrar o mesmo microconhecimento.</p></div><button className="primary-button" onClick={() => navigate("/flashcards/new")}><Plus size={16}/>Nova família</button></header>
    <section className="panel">
      <div className="flashcard-toolbar">
        <div className="filter-pills">
          {(["all", "tae", "fisica"] as const).map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "Todas" : value === "tae" ? "TAE" : "Física"}</button>)}
        </div>
        <input className="search-input" type="search" placeholder="Buscar conhecimento…" value={search} onChange={event => setSearch(event.target.value)}/>
      </div>
      {loading ? <div className="loading-panel">Carregando famílias…</div> : visible.length ? <div className="family-grid">
        {visible.map(concept => {
          const approved = concept.variants.filter(variant => variant.status === "approved").length;
          return <article className="family-card" key={concept.id}>
            <div className="family-card-top"><span className={`subject-pill ${concept.subject}`}>{concept.subject === "tae" ? "TAE" : "Física"}</span><span className={`status-pill ${concept.status === "published" && !concept.suspended ? "active" : "draft"}`}>{concept.suspended ? "Suspenso" : concept.status === "published" ? "Publicado" : "Rascunho"}</span></div>
            {concept.fsrs.lapses >= leechLimit && <span className="leech-note">Esquecimentos recorrentes · revisar qualidade</span>}
            <h2>{concept.topic}</h2>
            <p>{concept.source || "Sem fonte cadastrada"}</p>
            <div className="family-metrics"><span><Layers3 size={14}/>{approved} de {concept.variants.length} versões ativas</span><span><Clock3 size={14}/>{concept.status === "published" ? dueLabel(concept.fsrs.due) : "Ainda não revisado"}</span></div>
            <div className="family-card-actions"><button className="secondary-button compact" onClick={() => navigate(`/flashcards/${concept.id}/edit`)}>Editar</button><button className="text-button" onClick={async () => { await saveConcept({ ...concept, suspended: !concept.suspended }); setConcepts(await listConcepts()); }}>{concept.suspended ? "Reativar" : "Suspender"}</button></div>
          </article>;
        })}
      </div> : <div className="empty-state"><Layers3 size={28}/><strong>{concepts.length ? "Nenhuma família encontrada" : "Suas famílias de conhecimentos começam aqui"}</strong><span>Cadastre uma pergunta central e crie versões que explorem definição, comparação, diferenciação, competência, exceção e aplicação.</span><button className="primary-button" onClick={() => navigate("/flashcards/new")}>Criar primeira família <ArrowRight size={15}/></button></div>}
    </section>
  </div>;
}

function FlashcardEditor() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("return") === "curation" ? "/curation" : "/flashcards";
  const editing = !!id;
  const [subject, setSubject] = useState<StudySubject>("tae");
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("");
  const [variants, setVariants] = useState<FlashcardVariant[]>([newVariant()]);
  const [existing, setExisting] = useState<Concept | null>(null);
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getConcept(id).then(concept => {
      if (!concept) { setError("Não encontrei esta família."); return; }
      setExisting(concept);
      setSubject(concept.subject);
      setTopic(concept.topic);
      setSource(concept.source);
      setVariants(concept.variants.map(variant => ({ ...variant })));
    }).finally(() => setLoading(false));
  }, [id]);

  function updateVariant(index: number, patch: Partial<FlashcardVariant>) {
    setVariants(current => current.map((variant, i) => i === index ? { ...variant, ...patch } : variant));
  }
  function addVariant() {
    if (variants.length >= 10) return;
    setVariants(current => [...current, newVariant()]);
  }
  function removeVariant(index: number) {
    if (variants.length <= 1) return;
    setVariants(current => current.filter((_, i) => i !== index));
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!topic.trim()) { setError("Informe o conhecimento que esta família vai cobrar."); return; }
    if (!variants.length || variants.some(variant => !variant.q.trim() || !variant.a.trim())) { setError("Cada versão precisa ter pergunta e resposta."); return; }
    const normalizedQuestions = variants.map(variant => variant.q.trim().toLocaleLowerCase().replace(/\\s+/g, " "));
    if (new Set(normalizedQuestions).size !== normalizedQuestions.length) { setError("Há perguntas repetidas. Cada versão deve cobrar o mesmo conhecimento por uma operação diferente."); return; }
    if (variants.some(variant => variant.format === "cloze" && !/\{\{c\d+::[^}]+\}\}/.test(variant.q))) { setError("Nas lacunas, marque a resposta usando {{c1::resposta}}."); return; }
    if (variants.some(variant => variant.format === "image" && !variant.image.trim())) { setError("Adicione a imagem para cada versão do tipo imagem."); return; }
    setSaving(true);
    try {
      const clean = variants.map(variant => ({ ...variant }));
      if (existing) {
        await saveConcept({ ...existing, subject, topic: topic.trim(), source: source.trim(), variants: clean });
      } else {
        await createConcept({ subject, topic, source }, clean, "draft");
      }
      navigate(returnTo);
    } catch {
      setError("Não foi possível salvar. Seus dados anteriores permanecem preservados.");
      setSaving(false);
    }
  }
  if (loading) return <div className="loading-panel">Carregando família…</div>;
  return <div className="stack">
    <header className="heading"><div><small>RITMO / FLASHCARDS</small><h1>{editing ? "Editar família" : "Nova família"}</h1><p>O conteúdo central permanece o mesmo; cada versão muda a forma de recuperação.</p></div><Link className="secondary-button" to="/flashcards"><ArrowLeft size={15}/>Voltar</Link></header>
    <form className="stack" onSubmit={submit}>
      <section className="panel wizard-panel">
        <div className="panel-title-row"><div><span className="step-kicker">CONHECIMENTO</span><h2>Defina o que precisa ser lembrado</h2><p>Uma família deve representar um microconhecimento específico, não um capítulo inteiro.</p></div><span className="soft-tag">{variants.length}/10 versões</span></div>
        <div className="form-grid">
          <div className="field-block"><label>Área de estudo</label><select value={subject} onChange={event => setSubject(event.target.value as StudySubject)}><option value="tae">TAE</option><option value="fisica">Física</option></select></div>
          <div className="field-block"><label>Conhecimento / tópico *</label><input required maxLength={180} value={topic} onChange={event => setTopic(event.target.value)} placeholder="Ex.: Competências do SINAES"/></div>
          <div className="field-block field-span"><label>Fonte ou referência (opcional)</label><input value={source} onChange={event => setSource(event.target.value)} placeholder="Ex.: Lei nº 10.861/2004, art. 3º"/></div>
        </div>
      </section>
      <section className="panel wizard-panel">
        <div className="panel-title-row"><div><span className="step-kicker">VERSÕES DO CARTÃO</span><h2>Varie a forma de cobrança</h2><p>Evite repetir a mesma pergunta com palavras trocadas. Cada versão deve exigir uma operação mental diferente.</p></div><button type="button" className="secondary-button compact" onClick={addVariant} disabled={variants.length >= 10}><Plus size={14}/>Adicionar versão</button></div>
        <div className="variant-editor-list">
          {variants.map((variant, index) => <article className="variant-editor" key={variant.id}>
            <div className="variant-editor-heading"><div><span>VERSÃO {index + 1}</span><strong>{variant.kind}</strong></div>{variants.length > 1 && <button type="button" className="icon-button" aria-label={`Remover versão ${index + 1}`} onClick={() => removeVariant(index)}>×</button>}</div>
            <div className="form-grid">
              <div className="field-block"><label>Operação mental</label><select value={variant.kind} onChange={event => updateVariant(index, { kind: event.target.value })}>{KINDS.map(kind => <option key={kind}>{kind}</option>)}</select></div>
              <div className="field-block"><label>Formato</label><select value={variant.format} onChange={event => updateVariant(index, { format: event.target.value })}>{FORMATS.map(format => <option key={format.value} value={format.value}>{format.label}</option>)}</select></div>
              <div className="field-block field-span"><label>Pergunta / comando *</label><textarea rows={3} value={variant.q} onChange={event => updateVariant(index, { q: event.target.value })} placeholder="Ex.: Diferencie avaliação institucional e avaliação de cursos no SINAES."/></div>
              <div className="field-block field-span"><label>Resposta esperada *</label><textarea rows={3} value={variant.a} onChange={event => updateVariant(index, { a: event.target.value })} placeholder="Resposta objetiva, precisa e verificável."/></div>
              {variant.format === "image" && <div className="field-block field-span"><label>URL ou data URL da imagem</label><input value={variant.image} onChange={event => updateVariant(index, { image: event.target.value })} placeholder="https://… ou data:image/…"/><small>O editor visual de máscaras de imagem será integrado em uma etapa posterior.</small></div>}
              <div className="field-block field-span"><label>Justificativa / explicação (opcional)</label><textarea rows={2} value={variant.reason} onChange={event => updateVariant(index, { reason: event.target.value })} placeholder="Explique por que a resposta está correta ou onde está a pegadinha."/></div>
              <div className="field-block field-span"><label>Fonte específica desta versão (opcional)</label><input value={variant.source} onChange={event => updateVariant(index, { source: event.target.value })} placeholder="Artigo, inciso, página ou referência"/></div>
            </div>
          </article>)}
        </div>
        <div className="note-strip"><strong>Controle de qualidade</strong>Prefira perguntas que peçam definição, diferença, comparação, competência, responsável, prazo, condição ou exceção. Em lei seca, teste a precisão da redação e a troca de uma palavra que altere o sentido. Não transforme uma informação não conferida em resposta.</div>
        {error && <p className="inline-feedback" role="alert">{error}</p>}
        <div className="form-actions"><Link to="/flashcards">Cancelar</Link><button className="primary-button" disabled={saving}>{saving ? "Salvando…" : "Salvar família"} <Check size={15}/></button></div>
      </section>
    </form>
  </div>;
}

interface ReviewCard { concept: Concept; variant: FlashcardVariant; wasNew: boolean }
type ReviewMode = "normal" | "difficult" | "law";
function chooseVariant(concept: Concept, mode: ReviewMode): FlashcardVariant | undefined {
  let eligible = concept.variants.filter(variant => variant.status === "approved");
  if (mode === "law") eligible = eligible.filter(variant => /lei seca|armadilha|competência|condição|exceção/i.test(variant.kind));
  if (!eligible.length) eligible = concept.variants.filter(variant => variant.status === "approved");
  const alternatives = eligible.filter(variant => variant.id !== concept.lastVariant);
  const pool = alternatives.length ? alternatives : eligible;
  return [...pool].sort((a, b) => a.uses - b.uses || (a.passes / (a.uses || 1)) - (b.passes / (b.uses || 1)))[0];
}
function pickReview(concepts: Concept[], reviews: ReviewLog[], settings: StudySettings, mode: ReviewMode, subject: "all" | StudySubject): ReviewCard | null {
  const todayKey = new Date().toDateString();
  const seenNew = new Set(reviews.filter(review => new Date(review.at).toDateString() === todayKey && !review.preview && review.wasNew).map(review => review.conceptId));
  const reviewed = reviews.filter(review => new Date(review.at).toDateString() === todayKey && !review.preview && !review.wasNew).length;
  let candidates = concepts.filter(concept => isPublished(concept) && (subject === "all" || concept.subject === subject));
  if (mode === "difficult") candidates = candidates.filter(concept => concept.fsrs.lapses >= settings.leech || concept.variants.some(variant => variant.failures >= settings.leech));
  if (mode === "law") candidates = candidates.filter(concept => concept.variants.some(variant => /lei seca|armadilha|competência|condição|exceção/i.test(variant.kind)));
  candidates = candidates.filter(concept => concept.fsrs.due <= Date.now());
  candidates.sort((a, b) => Number(a.fsrs.reps === 0) - Number(b.fsrs.reps === 0) || a.fsrs.due - b.fsrs.due);
  for (const concept of candidates) {
    const wasNew = concept.fsrs.reps === 0;
    if (wasNew ? seenNew.size >= settings.newLimit : reviewed >= settings.reviewLimit) continue;
    const variant = chooseVariant(concept, mode);
    if (variant) return { concept, variant, wasNew };
  }
  return null;
}

function ReviewPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [reviews, setReviews] = useState<ReviewLog[]>([]);
  const [settings, setSettings] = useState<StudySettings>({ retention: 0.9, newLimit: 10, reviewLimit: 70, leech: 4 });
  const [mode, setMode] = useState<ReviewMode>("normal");
  const [subject, setSubject] = useState<"all" | StudySubject>("all");
  const [current, setCurrent] = useState<ReviewCard | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function reload() {
    const [nextConcepts, nextReviews, nextSettings] = await Promise.all([listConcepts(), listReviews(), getStudySettings()]);
    setConcepts(nextConcepts); setReviews(nextReviews); setSettings(nextSettings);
    return { concepts: nextConcepts, reviews: nextReviews, settings: nextSettings };
  }
  useEffect(() => { reload().finally(() => setLoading(false)); }, []);
  function startSession() {
    const next = pickReview(concepts, reviews, settings, mode, subject);
    setCurrent(next); setRevealed(false); setTyped(""); setCompleted(!next);
  }
  async function grade(gradeValue: FsrsGrade) {
    if (!current || !revealed || saving) return;
    setSaving(true);
    try {
      const concept = { ...current.concept, fsrs: rateFsrs(current.concept.fsrs, gradeValue, Date.now(), settings.retention), variants: current.concept.variants.map(variant => variant.id === current.variant.id ? {
        ...variant,
        uses: variant.uses + 1,
        passes: variant.passes + (gradeValue === "again" ? 0 : 1),
        failures: variant.failures + (gradeValue === "again" ? 1 : 0),
      } : variant), lastVariant: current.variant.id };
      const review: ReviewLog = {
        id: uid(), conceptId: concept.id, subject: concept.subject, topic: concept.topic,
        variantId: current.variant.id, kind: current.variant.kind, format: current.variant.format,
        grade: gradeValue, at: Date.now(), wasNew: current.wasNew, preview: false, typed,
        s: concept.fsrs.s, d: concept.fsrs.d, due: concept.fsrs.due,
      };
      await recordConceptReview(concept, review);
      const data = await reload();
      const next = pickReview(data.concepts, data.reviews, data.settings, mode, subject);
      setCurrent(next); setRevealed(false); setTyped(""); setCompleted(!next);
    } catch {
      // Keep the current card visible so the student can retry without losing the response.
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-panel">Preparando revisões…</div>;
  const dueCount = concepts.filter(concept => isPublished(concept) && concept.fsrs.due <= Date.now() && (subject === "all" || concept.subject === subject)).length;
  return <div className="stack">
    <header className="heading"><div><small>RITMO / APRENDIZAGEM</small><h1>Revisões</h1><p>O FSRS agenda cada família de conhecimentos; a cobrança varia entre as versões cadastradas.</p></div><Link className="secondary-button" to="/flashcards"><Layers3 size={15}/>Flashcards</Link></header>
    {!current && !completed && <section className="panel review-start">
      <div className="panel-title-row"><div><span className="step-kicker">SESSÃO DE ESTUDO</span><h2>O que vamos revisar?</h2><p>{dueCount} família(s) vencida(s) no filtro atual.</p></div><span className="soft-tag">FSRS-6</span></div>
      <div className="form-grid">
        <div className="field-block"><label>Tipo de sessão</label><select value={mode} onChange={event => setMode(event.target.value as ReviewMode)}><option value="normal">Revisões do dia</option><option value="difficult">Esquecimentos recorrentes</option><option value="law">Lei seca e exceções</option></select></div>
        <div className="field-block"><label>Área</label><select value={subject} onChange={event => setSubject(event.target.value as "all" | StudySubject)}><option value="all">Todas</option><option value="tae">TAE</option><option value="fisica">Física</option></select></div>
      </div>
      <button className="primary-button" onClick={startSession}><BookOpen size={16}/>Começar revisão <ArrowRight size={16}/></button>
      <p className="field-hint">Limites diários: {settings.newLimit} novas famílias e {settings.reviewLimit} revisões antigas. As versões não multiplicam a carga de revisão.</p>
    </section>}
    {current && <section className="panel review-card-panel">
      <div className="review-card-meta"><span className={`subject-pill ${current.concept.subject}`}>{current.concept.subject === "tae" ? "TAE" : "Física"}</span><span>{current.concept.topic}</span><span className="origin-pill">{current.variant.kind}</span><span className="soft-tag">{current.wasNew ? "Primeiro contato" : dueLabel(current.concept.fsrs.due)}</span></div>
      <div className="review-card-face">
        <small>{current.variant.format === "cloze" ? "COMPLETE A LACUNA" : "RECUPERE A RESPOSTA"}</small>
        {current.variant.format === "image" && current.variant.image && <img className="review-image" src={current.variant.image} alt="Imagem do cartão"/>}
        <div className="review-prompt">{current.variant.format === "cloze" ? formatCloze(current.variant.q, revealed) : current.variant.q}</div>
        {current.variant.format === "typed" && <textarea className="typed-answer" rows={3} value={typed} onChange={event => setTyped(event.target.value)} placeholder="Tente responder antes de revelar…"/>}
        {!revealed ? <button className="primary-button" onClick={() => setRevealed(true)}>Revelar resposta</button> : <div className="review-answer"><strong>Resposta esperada</strong><p>{current.variant.a}</p>{current.variant.reason && <p className="review-reason">{current.variant.reason}</p>}</div>}
      </div>
      {revealed && <div className="grade-panel"><p>Como foi sua recuperação?</p><div className="grade-buttons">
        <button className="grade-again" disabled={saving} onClick={() => grade("again")}>Errei</button>
        <button className="grade-hard" disabled={saving} onClick={() => grade("hard")}>Difícil</button>
        <button className="grade-good" disabled={saving} onClick={() => grade("good")}>Lembrei</button>
        <button className="grade-easy" disabled={saving} onClick={() => grade("easy")}>Fácil</button>
      </div><small>O intervalo é calculado pelo FSRS com sua meta de retenção atual ({Math.round(settings.retention * 100)}%).</small></div>}
    </section>}
    {completed && <section className="panel empty-state"><Check size={30}/><strong>Sessão concluída</strong><span>Não há mais cartões disponíveis nesta sessão dentro dos limites diários. Você pode voltar depois ou cadastrar novos conhecimentos.</span><button className="primary-button" onClick={() => { setCompleted(false); setCurrent(null); }}>Voltar ao início</button><Link className="text-link" to="/flashcards">Gerenciar flashcards</Link></section>}
  </div>;
}

export function FlashcardsPage() { return <FamilyList/>; }
export function FlashcardEditorPage() { return <FlashcardEditor/>; }
export function ReviewPageRoute() { return <ReviewPage/>; }
