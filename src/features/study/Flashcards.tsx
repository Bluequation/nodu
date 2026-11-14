import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, Layers3, Plus, RotateCcw, Sparkles, Upload, ShieldCheck } from "lucide-react";
import type { Concept, FlashcardVariant, ReviewLog, StudySettings, StudySubject } from "../../domain/study";
import {useStudyContext} from "./useStudyContext";
import {MaterialScopePicker,useMaterialPlans,materialLabel,materialRoute} from "./MaterialScopePicker";
import "./materials.css";
import {addTopicLink,linkedTo,linkedToPlan,topicUrl} from "../../domain/topicContext";
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
 const navigate=useNavigate(),context=useStudyContext(),plans=useMaterialPlans(),[params]=useSearchParams();
 const route=(path:string)=>context.valid?topicUrl(path,context.ref,context.date):params.get("plan")?path+"?plan="+encodeURIComponent(params.get("plan")!):path;
 const [concepts,setConcepts]=useState<Concept[]>([]),[search,setSearch]=useState(""),[area,setArea]=useState(""),[loading,setLoading]=useState(true);
 const selectedPlan=plans.find(p=>p.id===params.get("plan"));
 useEffect(()=>{listConcepts().then(setConcepts).finally(()=>setLoading(false));},[]);
 const base=concepts.filter(c=>context.requested?context.valid&&linkedTo(c,context.ref):params.get("plan")?!!selectedPlan&&linkedToPlan(c,selectedPlan):true);
 const groups=new Map<string,{title:string;area:string;plan:string;tone:string;ref?:{planId:string;nodeId:string};items:Concept[]}>();
 for(const c of base){
  const refs=(c.planTopics||[]).filter(r=>!params.get("plan")||r.planId===params.get("plan")).filter(r=>!context.requested||linkedTo({planTopics:[r]},context.ref));
  const valid=refs.map(ref=>({ref,label:materialLabel(plans,ref)})).filter(x=>x.label);
  const entries=valid.length?valid.map(({ref,label})=>({key:JSON.stringify(ref),ref,...label!})):[{key:"free",title:"Sem plano",plan:"Estudo livre",area:"Avulsos",tone:"neutral",ref:undefined}];
  for(const entry of entries){const group=groups.get(entry.key)||{...entry,items:[]};group.items.push(c);groups.set(entry.key,group);}
 }
 const areas=[...new Set([...groups.values()].map(g=>g.area))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 const visible=[...groups.values()].filter(g=>!area||g.area===area).map(g=>({...g,items:g.items.filter(c=>(g.title+" "+c.topic).toLocaleLowerCase().includes(search.toLocaleLowerCase()))})).filter(g=>g.items.length).sort((a,b)=>a.title.localeCompare(b.title,"pt-BR"));
 const pub=base.filter(isPublished),due=pub.filter(c=>c.fsrs.due<=Date.now()).length,drafts=base.filter(c=>c.status==="draft").length;
 return <div className="stack ritmo-materials"><header className="heading"><div><small>RITMO / APRENDIZAGEM</small><h1>Flashcards</h1></div><div className="rm-actions"><Link className="secondary-button compact" to={route("/flashcards/new")}><Plus size={15}/>Manual</Link><Link className="primary-button" to={route("/import")}><Upload size={16}/>Importar</Link></div></header>
 {context.requested&&<p className="inline-feedback">{context.valid?context.plan?.title+" · "+context.title:"Carregando assunto ou indisponível."} · <Link to={context.returnTo}>Voltar a Aprender</Link></p>}
 <div className="rm-stats"><div data-tone="law"><Layers3 size={20}/><strong>{pub.reduce((n,c)=>n+c.variants.filter(v=>v.status==="approved").length,0)}</strong><small>Cartões publicados</small></div><Link data-tone="simulation" to={route("/reviews")}><Clock3 size={20}/><strong>{due}</strong><small>Famílias para revisar</small></Link><Link data-tone="pedagogy" to={route("/curation")}><ShieldCheck size={20}/><strong>{drafts}</strong><small>Em curadoria</small></Link></div>
 <div className="rm-toolbar"><MaterialScopePicker plans={plans} onChange={()=>setArea("")}/><label>Disciplina<select aria-label="Filtrar disciplina" value={area} onChange={e=>setArea(e.target.value)}><option value="">Todas</option>{areas.map(a=><option key={a}>{a}</option>)}</select></label><input className="search-input" type="search" aria-label="Buscar conhecimento" placeholder="Buscar conhecimento…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
 <header className="rm-section-head"><h2>Minha coleção</h2><small>{base.length} famílias</small></header>
 {loading?<p>Carregando…</p>:visible.length?<div className="rm-collections">{visible.map(g=><article className="rm-collection" key={g.ref?JSON.stringify(g.ref):"free"} data-tone={g.tone}><div className="rm-collection-head"><Layers3 size={22}/><div><small>{g.plan} · {g.area}</small><h3>{g.title}</h3><span>{g.items.length} famílias · {g.items.reduce((n,c)=>n+c.variants.length,0)} versões</span></div></div><details><summary>Abrir coleção <ArrowRight size={13}/></summary>{g.items.map(c=><div className="rm-family" key={c.id}><div><b>{c.topic}</b><small>{c.suspended?"Suspensa":c.status==="draft"?"Rascunho":dueLabel(c.fsrs.due)} · {c.variants.length} versões</small></div><button className="text-button" onClick={()=>navigate(g.ref?topicUrl("/flashcards/"+c.id+"/edit",g.ref,context.date):"/flashcards/"+c.id+"/edit")}>Editar</button><button className="text-button" onClick={async()=>{await saveConcept({...c,suspended:!c.suspended});setConcepts(await listConcepts());}}>{c.suspended?"Reativar":"Suspender"}</button></div>)}</details>{g.ref&&<Link className="rm-review-link" to={topicUrl("/reviews",g.ref,context.date)}>Revisar assunto <ArrowRight size={13}/></Link>}</article>)}</div>:<div className="rm-empty"><Layers3 size={25}/><div><b>{base.length?"Nenhuma família encontrada":"Sua coleção começa aqui"}</b><small>Importe um lote de cartões e confira na curadoria.</small></div><Link className="primary-button compact" to={route("/import")}>Importar cartões <ArrowRight size={14}/></Link></div>}
 </div>;
}

function FlashcardEditor() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const context=useStudyContext(),plans=useMaterialPlans();
  const editingReturn=searchParams.get("return");
  const destination=editingReturn==="curation"?"/curation":editingReturn==="import"?"/import":"/flashcards";
  const returnTo=materialRoute(destination,searchParams);
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

  useEffect(()=>{if(!editing&&context.valid)setSubject(/f[ií]sica/i.test(context.plan?.area||"")?"fisica":"tae");},[editing,context.valid,context.title,context.plan?.area]);
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
    if(searchParams.get("plan")&&!context.valid){setError("Selecione um assunto válido do plano.");return;}
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
        await saveConcept({ ...existing, subject, topic: topic.trim(), source: source.trim(), variants: clean,...(context.valid?{planTopics:addTopicLink(existing.planTopics,context.ref)}:{}) });
      } else {
        await createConcept({ subject, topic, source,...(context.valid?{planTopics:[context.ref]}:{}) }, clean, "draft");
      }
      navigate(!editing&&editingReturn==="import"?materialRoute("/curation",searchParams):returnTo);
    } catch {
      setError("Não foi possível salvar. Seus dados anteriores permanecem preservados.");
      setSaving(false);
    }
  }
  if (loading) return <div className="loading-panel">Carregando família…</div>;
  return <div className="stack ritmo-materials rm-editor">
    <header className="heading"><div><small>RITMO / FLASHCARDS</small><h1>{editing ? "Editar família" : "Adicionar flashcards"}</h1></div><Link className="secondary-button" to={returnTo}><ArrowLeft size={15}/>Voltar</Link></header>
    {!editing&&<div className="rm-toolbar"><div className="rm-tabs"><Link to={materialRoute("/import",searchParams)}>Importar</Link><button type="button" aria-pressed="true">Manual</button><button type="button" disabled title="Disponível quando houver integração com API"><Sparkles size={13}/> Gerar com IA</button></div><MaterialScopePicker plans={plans} creation disabled={saving}/></div>}
    {context.requested&&<p className="inline-feedback">{context.loading?"Carregando assunto…":context.valid?context.plan?.title+" · "+context.title+" · Família será salva como rascunho.":"Assunto indisponível."}</p>}
    <form className="rm-editor-form" onSubmit={submit}>
      <section className="panel wizard-panel">
        <div className="panel-title-row"><h2>Microconhecimento</h2><small>{variants.length}/10 versões</small></div>
        <div className={"form-grid rm-knowledge-grid "+(context.valid?"has-context":"")}>
          {!context.valid&&<div className="field-block"><label>Área de estudo</label><select value={subject} onChange={event => setSubject(event.target.value as StudySubject)}><option value="tae">Geral</option><option value="fisica">Física</option></select></div>}
          <div className="field-block"><label>Conhecimento / tópico *</label><input required maxLength={180} value={topic} onChange={event => setTopic(event.target.value)} placeholder="Ex.: Competências do SINAES"/></div>
          <div className="field-block rm-knowledge-source"><label>Fonte ou referência (opcional)</label><input value={source} onChange={event => setSource(event.target.value)} placeholder="Ex.: Lei nº 10.861/2004, art. 3º"/></div>
        </div>
      </section>
      <section className="panel wizard-panel">
        <div className="panel-title-row"><h2>Versões do cartão</h2><button type="button" className="secondary-button compact" onClick={addVariant} disabled={variants.length >= 10}><Plus size={14}/>Adicionar versão</button></div>
        <div className="variant-editor-list">
          {variants.map((variant, index) => <article className="variant-editor" key={variant.id}>
            <div className="variant-editor-heading"><div><span>VERSÃO {index + 1}</span><strong>{variant.kind}</strong></div>{variants.length > 1 && <button type="button" className="icon-button" aria-label={`Remover versão ${index + 1}`} onClick={() => removeVariant(index)}>×</button>}</div>
            <div className="form-grid">
              <div className="field-block"><label>Operação mental</label><select value={variant.kind} onChange={event => updateVariant(index, { kind: event.target.value })}>{KINDS.map(kind => <option key={kind}>{kind}</option>)}</select></div>
              <div className="field-block"><label>Formato</label><select value={variant.format} onChange={event => updateVariant(index, { format: event.target.value })}>{FORMATS.map(format => <option key={format.value} value={format.value}>{format.label}</option>)}</select></div>
              <div className="field-block"><label>Pergunta / comando *</label><textarea aria-label="Pergunta / comando" rows={4} value={variant.q} onChange={event => updateVariant(index, { q: event.target.value })} placeholder="Escreva a pergunta do flashcard."/></div>
              <div className="field-block"><label>Resposta esperada *</label><textarea aria-label="Resposta esperada" rows={4} value={variant.a} onChange={event => updateVariant(index, { a: event.target.value })} placeholder="Escreva a resposta esperada."/></div>
              {variant.format === "image" && <div className="field-block field-span"><label>URL ou data URL da imagem</label><input value={variant.image} onChange={event => updateVariant(index, { image: event.target.value })} placeholder="https://… ou data:image/…"/><small>O editor visual de máscaras de imagem será integrado em uma etapa posterior.</small></div>}
              <details className="rm-optional field-span"><summary>Justificativa e fonte específica (opcional)</summary><div className="form-grid"><div className="field-block"><label>Justificativa / explicação (opcional)</label><textarea rows={2} value={variant.reason} onChange={event => updateVariant(index, { reason: event.target.value })} placeholder="Explique por que a resposta está correta ou onde está a pegadinha."/></div>
              <div className="field-block"><label>Fonte específica desta versão (opcional)</label><input value={variant.source} onChange={event => updateVariant(index, { source: event.target.value })} placeholder="Artigo, inciso, página ou referência"/></div></div></details>
            </div>
          </article>)}
        </div>
        <details className="rm-optional"><summary>Critérios de qualidade</summary><p>Uma pergunta por microconhecimento. Varie a operação mental, preserve a redação legal quando citada e confira fontes.</p></details>
        {error && <p className="inline-feedback" role="alert">{error}</p>}
        <div className="form-actions"><Link to={returnTo}>Cancelar</Link><button className="primary-button" disabled={saving}>{saving ? "Salvando…" : "Salvar família"} <Check size={15}/></button></div>
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
  const context=useStudyContext(),plans=useMaterialPlans(),[params]=useSearchParams();
  const plan=plans.find(p=>p.id===params.get("plan"));
  const scoped=(items:Concept[])=>context.requested?items.filter(item=>context.valid&&linkedTo(item,context.ref)):params.get("plan")?items.filter(item=>!!plan&&linkedToPlan(item,plan)):items;
  const selectedSubject=params.get("plan")?"all":undefined;
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
    const next = pickReview(scoped(concepts), reviews, settings, mode, selectedSubject||subject);
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
        ...(context.valid?{planTopic:context.ref,sessionDate:context.date}:{}),
      };
      await recordConceptReview(concept, review);
      const data = await reload();
      const next = pickReview(scoped(data.concepts), data.reviews, data.settings, mode, selectedSubject||subject);
      setCurrent(next); setRevealed(false); setTyped(""); setCompleted(!next);
    } catch {
      // Keep the current card visible so the student can retry without losing the response.
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-panel">Preparando revisões…</div>;
  const dueCount = scoped(concepts).filter(concept => isPublished(concept) && concept.fsrs.due <= Date.now() && (params.get("plan")||subject === "all" || concept.subject === subject)).length;
  return <div className="stack">
    <header className="heading"><div><small>RITMO / APRENDIZAGEM</small><h1>Revisões</h1><p>O FSRS agenda cada família de conhecimentos; a cobrança varia entre as versões cadastradas.</p></div><Link className="secondary-button" to={context.valid?topicUrl("/flashcards",context.ref,context.date):"/flashcards"}><Layers3 size={15}/>Flashcards</Link></header>
    {context.requested&&<p className="inline-feedback">{context.valid?context.plan?.title+" · "+context.title:"Assunto indisponível ou carregando."} · <Link to={context.returnTo}>Voltar a Aprender</Link></p>}
    {!current && !completed && <section className="panel review-start">
      <div className="panel-title-row"><div><span className="step-kicker">SESSÃO DE ESTUDO</span><h2>O que vamos revisar?</h2><p>{dueCount} família(s) vencida(s) no filtro atual.</p></div><span className="soft-tag">FSRS-6</span></div>
      <div className="form-grid">
        <div className="field-block"><label>Tipo de sessão</label><select value={mode} onChange={event => setMode(event.target.value as ReviewMode)}><option value="normal">Revisões do dia</option><option value="difficult">Esquecimentos recorrentes</option><option value="law">Lei seca e exceções</option></select></div>
        <div className="field-block"><MaterialScopePicker plans={plans}/></div>
      </div>
      <button className="primary-button" disabled={(context.requested&&!context.valid)|| (!!params.get("plan")&&!plan)} onClick={startSession}><BookOpen size={16}/>Começar revisão <ArrowRight size={16}/></button>
      <p className="field-hint">Limites diários: {settings.newLimit} novas famílias e {settings.reviewLimit} revisões antigas. As versões não multiplicam a carga de revisão.</p>
    </section>}
    {current && <section className="panel review-card-panel">
      <div className="review-card-meta"><span className={`subject-pill ${current.concept.subject}`}>{context.valid?context.title:current.concept.planTopics?.map(ref=>materialLabel(plans,ref)?.title).filter(Boolean).join(" · ")||"Estudo livre"}</span><span>{current.concept.topic}</span><span className="origin-pill">{current.variant.kind}</span><span className="soft-tag">{current.wasNew ? "Primeiro contato" : dueLabel(current.concept.fsrs.due)}</span></div>
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
    {completed && <section className="panel empty-state"><Check size={30}/><strong>Sessão concluída</strong><span>Não há mais cartões disponíveis nesta sessão dentro dos limites diários. Você pode voltar depois ou cadastrar novos conhecimentos.</span><button className="primary-button" onClick={() => { setCompleted(false); setCurrent(null); }}>Voltar ao início</button><Link className="text-link" to={context.valid?topicUrl("/flashcards",context.ref,context.date):"/flashcards"}>Gerenciar flashcards</Link></section>}
  </div>;
}

export function FlashcardsPage() { return <FamilyList/>; }
export function FlashcardEditorPage() { return <FlashcardEditor/>; }
export function ReviewPageRoute() { return <ReviewPage/>; }
