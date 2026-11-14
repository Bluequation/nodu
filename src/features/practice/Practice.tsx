import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ExternalLink, NotebookPen, Plus, Target, Trash2 } from "lucide-react";
import type { Concept, ErrorRecord, StudySubject, QuestionBlock } from "../../domain/study";
import { deleteError, deleteQuestionBlock, listConcepts, listErrors, listQuestionBlocks, saveError, saveQuestionBlock } from "../../data/study";

const DAY = 86_400_000;
const REVIEW_STEPS = [1, 3, 7, 15, 30, 60, 90];
const EMPTY_ERROR = {
  subject: "tae" as StudySubject, discipline: "", area: "", topic: "", type: "Lacuna",
  mistake: "", fix: "", reviewDays: 15, questionUrl: "", conceptId: "",
  questionText: "", optionsText: "", correctAnswer: "",
};
const EMPTY_BLOCK = { subject: "tae" as StudySubject, topic: "", total: 10, correct: 0, note: "" };
function dateLabel(value: number) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function isDue(error: ErrorRecord) { return error.status !== "dominado" && error.nextReview <= Date.now(); }
function subjectLabel(subject: StudySubject) { return subject === "tae" ? "TAE" : "Física"; }
function safeHttpUrl(value: string) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
}

export function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [form, setForm] = useState(EMPTY_ERROR);
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | StudySubject>("all");
  const [applyId, setApplyId] = useState("");
  const [feedback, setFeedback] = useState("");
  async function reload() {
    const [nextErrors, nextConcepts] = await Promise.all([listErrors(), listConcepts()]);
    setErrors(nextErrors); setConcepts(nextConcepts);
  }
  useEffect(() => { reload(); }, []);
  const visible = errors.filter(error => filter === "all" || error.subject === filter);
  const due = visible.filter(isDue).length;
  function set<K extends keyof typeof EMPTY_ERROR>(key: K, value: typeof EMPTY_ERROR[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  function edit(error: ErrorRecord) {
    setEditingId(error.id);
    setForm({
      subject: error.subject, discipline: error.discipline, area: error.area, topic: error.topic,
      type: error.type, mistake: error.mistake, fix: error.fix, reviewDays: error.reviewDays,
      questionUrl: error.questionUrl, conceptId: error.conceptId, questionText: error.questionText,
      optionsText: error.optionsText, correctAnswer: error.correctAnswer,
    });
    setShowForm(true); setFeedback("");
  }
  function newError() {
    setEditingId(""); setForm(EMPTY_ERROR); setShowForm(true); setFeedback("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setFeedback("");
    if (!form.discipline.trim() || !form.area.trim() || !form.topic.trim()) { setFeedback("Preencha disciplina, área e assunto."); return; }
    if (!form.mistake.trim() || !form.fix.trim()) { setFeedback("Descreva o erro e sua correção fundamentada."); return; }
    if (form.questionUrl.trim()) {
      try { const url = new URL(form.questionUrl); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); }
      catch { setFeedback("Informe um link HTTP ou HTTPS válido."); return; }
    }
    const old = errors.find(item => item.id === editingId);
    const now = Date.now();
    const record: ErrorRecord = {
      id: old?.id || crypto.randomUUID(),
      ...form,
      at: old?.at || now,
      nextReview: old?.nextReview || now + form.reviewDays * DAY,
      successes: old?.successes || 0,
      failures: old?.failures || 0,
      status: old?.status === "dominado" ? "pendente" : old?.status || "pendente",
      history: old?.history || [],
    };
    await saveError(record);
    setForm(EMPTY_ERROR); setEditingId(""); setShowForm(false);
    await reload(); setFeedback("Registro salvo.");
  }
  async function gradeApplication(id: string, grade: "right" | "wrong") {
    const record = errors.find(item => item.id === id);
    if (!record) return;
    const at = Date.now();
    const history = [...(record.history || []), { at, grade }];
    let successes = record.successes || 0;
    let failures = record.failures || 0;
    let reviewDays = record.reviewDays || 15;
    let status: ErrorRecord["status"] = "pendente";
    if (grade === "right") {
      const hadSuccessToday = history.slice(0, -1).some(item => item.grade === "right" && new Date(item.at).toDateString() === new Date(at).toDateString());
      if (!hadSuccessToday) successes += 1;
      reviewDays = REVIEW_STEPS.find(step => step > reviewDays) || 90;
      status = successes >= 2 ? "dominado" : "pendente";
    } else {
      failures += 1; successes = 0; reviewDays = failures >= 2 ? 1 : 3;
    }
    await saveError({ ...record, history, successes, failures, reviewDays, status, nextReview: at + reviewDays * DAY });
    setApplyId(""); await reload();
  }
  async function remove(id: string) {
    if (!confirm("Excluir este registro do caderno de erros? O histórico de flashcards associado não será apagado.")) return;
    await deleteError(id); await reload();
  }

  return <div className="stack">
    <header className="heading"><div><small>RITMO / PRÁTICA</small><h1>Caderno de erros</h1><p>Registre o que falhou, a correção e quando testar novamente em uma questão inédita.</p></div><button className="primary-button" onClick={newError}><Plus size={16}/>Registrar erro</button></header>
    <section className="panel">
      <div className="practice-toolbar"><div className="filter-pills">{(["all", "tae", "fisica"] as const).map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "Todas" : value === "tae" ? "TAE" : "Física"}</button>)}</div><span className="soft-tag">{visible.length} registro(s) · {due} para retomar</span></div>
      {showForm && <form className="error-form" onSubmit={submit}>
        <div className="panel-title-row"><div><span className="step-kicker">{editingId ? "EDITAR REGISTRO" : "NOVO REGISTRO"}</span><h2>{editingId ? "Atualize o erro" : "O que aconteceu?"}</h2><p>O objetivo é registrar a dificuldade real e a correção que permitirá resolvê-la depois.</p></div><button className="icon-button" type="button" onClick={() => setShowForm(false)}>×</button></div>
        <div className="form-grid">
          <div className="field-block"><label>Área de estudo</label><select value={form.subject} onChange={event => set("subject", event.target.value as StudySubject)}><option value="tae">TAE</option><option value="fisica">Física</option></select></div>
          <div className="field-block"><label>Tipo de erro</label><select value={form.type} onChange={event => set("type", event.target.value)}>{["Lacuna", "Revisar", "Interpretação", "Cálculo", "Distração", "Confusão de conceitos"].map(value => <option key={value}>{value}</option>)}</select></div>
          <div className="field-block"><label>Disciplina *</label><input list="error-disciplines" value={form.discipline} onChange={event => set("discipline", event.target.value)} placeholder="Ex.: Legislação educacional"/><datalist id="error-disciplines"><option>Português</option><option>Legislação Educacional</option><option>Conhecimentos Pedagógicos</option><option>Administração Pública</option><option>Física</option><option>Matemática para Física</option></datalist></div>
          <div className="field-block"><label>Área / eixo *</label><input value={form.area} onChange={event => set("area", event.target.value)} placeholder="Ex.: Educação superior, Mecânica"/></div>
          <div className="field-block"><label>Assunto *</label><input value={form.topic} onChange={event => set("topic", event.target.value)} placeholder="Ex.: SINAES, Leis de Newton"/></div>
          <div className="field-block"><label>Nova questão após</label><select value={form.reviewDays} onChange={event => set("reviewDays", Number(event.target.value))}>{REVIEW_STEPS.map(days => <option key={days} value={days}>{days} dia(s)</option>)}</select></div>
          <div className="field-block field-span"><label>Qual foi o erro ou a lacuna? *</label><textarea rows={3} value={form.mistake} onChange={event => set("mistake", event.target.value)} placeholder="Registre o raciocínio que levou ao erro, a confusão ou o ponto que você não sabia."/></div>
          <div className="field-block field-span"><label>Correção fundamentada *</label><textarea rows={3} value={form.fix} onChange={event => set("fix", event.target.value)} placeholder="Explique a regra, o conceito ou o procedimento correto."/></div>
          <details className="field-span error-extra"><summary>Enunciado e alternativas da questão original (opcional)</summary>
            <div className="field-block"><label>Enunciado</label><textarea rows={3} value={form.questionText} onChange={event => set("questionText", event.target.value)} placeholder="Cole o enunciado original."/></div>
            <div className="field-block"><label>Alternativas</label><textarea rows={3} value={form.optionsText} onChange={event => set("optionsText", event.target.value)} placeholder={"A) …\nB) …\nC) …"}/></div>
            <div className="field-block"><label>Gabarito</label><input value={form.correctAnswer} onChange={event => set("correctAnswer", event.target.value)} placeholder="Ex.: C"/></div>
          </details>
          <div className="field-block"><label>Link da questão (opcional)</label><input type="url" value={form.questionUrl} onChange={event => set("questionUrl", event.target.value)} placeholder="https://…"/></div>
          <div className="field-block"><label>Vincular a uma família de flashcards (opcional)</label><select value={form.conceptId} onChange={event => set("conceptId", event.target.value)}><option value="">Sem vínculo</option>{concepts.filter(concept => concept.subject === form.subject).map(concept => <option key={concept.id} value={concept.id}>{concept.topic}</option>)}</select></div>
        </div>
        {feedback && <p className="inline-feedback" role="alert">{feedback}</p>}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar registro <Check size={15}/></button></div>
      </form>}
      {!showForm && feedback && <p className="inline-feedback">{feedback}</p>}
      <div className="error-list">
        {visible.length ? visible.map(error => {
          const concept = concepts.find(item => item.id === error.conceptId);
          const questionLink = safeHttpUrl(error.questionUrl);
          return <article className="error-card" key={error.id}>
            <div className="error-card-top"><div><span className="subject-pill">{subjectLabel(error.subject)}</span><span className="soft-tag">{error.type}</span></div><span className={error.status === "dominado" ? "status-pill active" : isDue(error) ? "status-pill due" : "status-pill"}>{error.status === "dominado" ? "Dominado" : isDue(error) ? "Retomar agora" : `Próxima: ${dateLabel(error.nextReview)}`}</span></div>
            <h3>{error.topic}</h3><p className="error-breadcrumb">{error.discipline} / {error.area}</p>
            <div className="error-content-grid"><div><small>ERRO / LACUNA</small><p>{error.mistake}</p></div><div><small>CORREÇÃO</small><p>{error.fix}</p></div></div>
            {error.questionText && <details className="source-excerpt"><summary>Ver enunciado original</summary><p>{error.questionText}{error.optionsText ? `\n\n${error.optionsText}` : ""}{error.correctAnswer ? `\nGabarito: ${error.correctAnswer}` : ""}</p></details>}
            <div className="error-card-footer"><span>{dateLabel(error.at)} · {error.successes} acerto(s) · {error.failures} novo(s) erro(s){concept ? ` · Flashcard: ${concept.topic}` : ""}</span><div><button className="text-button" onClick={() => edit(error)}>Editar</button><button className="text-button" onClick={() => setApplyId(applyId === error.id ? "" : error.id)}>Nova aplicação</button><button className="icon-button" aria-label="Excluir" onClick={() => remove(error.id)}><Trash2 size={14}/></button></div></div>
            {applyId === error.id && <div className="apply-error-panel"><strong>Resolva uma questão inédita sobre este assunto.</strong><p>O resultado desta aplicação não altera o FSRS dos flashcards.</p>{questionLink && <a href={questionLink} target="_blank" rel="noreferrer">Consultar questão original <ExternalLink size={12}/></a>}<div className="button-row"><button className="secondary-button compact" onClick={() => gradeApplication(error.id, "wrong")}>Errei novamente</button><button className="primary-button compact" onClick={() => gradeApplication(error.id, "right")}>Acertei uma inédita <Check size={14}/></button></div></div>}
            {error.history.length > 0 && <details className="error-history"><summary>Histórico de aplicações ({error.history.length})</summary>{error.history.map((entry, index) => <p key={index}>{dateLabel(entry.at)} · {entry.grade === "right" ? "Acerto em questão inédita" : "Erro novamente"}</p>)}</details>}
          </article>;
        }) : <div className="empty-state"><NotebookPen size={28}/><strong>Nenhum erro registrado</strong><span>Quando errar uma questão ou identificar uma lacuna, registre o motivo e a correção. O Ritmo cobrará uma nova aplicação depois.</span><button className="primary-button" onClick={newError}>Registrar primeiro erro</button></div>}
      </div>
    </section>
  </div>;
}

export function QuestionsPage() {
  const [blocks, setBlocks] = useState<QuestionBlock[]>([]);
  const [form, setForm] = useState(EMPTY_BLOCK);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | StudySubject>("all");
  const [feedback, setFeedback] = useState("");
  async function reload() { setBlocks(await listQuestionBlocks()); }
  useEffect(() => { reload(); }, []);
  const visible = blocks.filter(block => filter === "all" || block.subject === filter);
  const total = visible.reduce((sum, block) => sum + block.total, 0);
  const correct = visible.reduce((sum, block) => sum + block.correct, 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.topic.trim() || form.total < 1 || form.correct < 0 || form.correct > form.total) { setFeedback("Confira o assunto, o total e a quantidade de acertos."); return; }
    await saveQuestionBlock({ ...form, id: crypto.randomUUID(), topic: form.topic.trim(), at: Date.now() });
    setForm(EMPTY_BLOCK); setShowForm(false); setFeedback("Bloco registrado."); await reload();
  }
  async function remove(id: string) {
    if (!confirm("Excluir este bloco de questões?")) return;
    await deleteQuestionBlock(id); await reload();
  }
  return <div className="stack">
    <header className="heading"><div><small>RITMO / PRÁTICA</small><h1>Questões</h1><p>Registre blocos resolvidos e acompanhe a aplicação do que você estudou.</p></div><button className="primary-button" onClick={() => setShowForm(value => !value)}><Plus size={16}/>Registrar bloco</button></header>
    <section className="panel">
      <div className="practice-toolbar"><div className="filter-pills">{(["all", "tae", "fisica"] as const).map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "Todas" : value === "tae" ? "TAE" : "Física"}</button>)}</div><span className="soft-tag">{total} questões · {total ? Math.round(correct / total * 100) : 0}% de acertos</span></div>
      {showForm && <form className="question-form" onSubmit={submit}><div className="form-grid">
        <div className="field-block"><label>Área de estudo</label><select value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value as StudySubject }))}><option value="tae">TAE</option><option value="fisica">Física</option></select></div>
        <div className="field-block"><label>Assunto</label><input required value={form.topic} onChange={event => setForm(current => ({ ...current, topic: event.target.value }))} placeholder="Ex.: SINAES"/></div>
        <div className="field-block"><label>Questões resolvidas</label><input type="number" min={1} max={500} value={form.total} onChange={event => setForm(current => ({ ...current, total: Number(event.target.value) }))}/></div>
        <div className="field-block"><label>Acertos</label><input type="number" min={0} max={500} value={form.correct} onChange={event => setForm(current => ({ ...current, correct: Number(event.target.value) }))}/></div>
        <div className="field-block field-span"><label>Observação (opcional)</label><textarea rows={2} value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} placeholder="Banca, dificuldade, tipo de erro…"/></div>
      </div>{feedback && <p className="inline-feedback">{feedback}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" type="submit">Registrar questões <Check size={15}/></button></div></form>}
      <div className="question-block-list">{visible.length ? visible.map(block => <article className="question-block-card" key={block.id}><div><span className="subject-pill">{subjectLabel(block.subject)}</span><h3>{block.topic}</h3><p>{dateLabel(block.at)} · {block.total} questões · {block.correct} acertos · {Math.round(block.correct / block.total * 100)}%</p>{block.note && <small>{block.note}</small>}</div><button className="icon-button" aria-label="Excluir bloco" onClick={() => remove(block.id)}><Trash2 size={14}/></button></article>) : <div className="empty-state"><Target size={28}/><strong>Nenhum bloco registrado</strong><span>Registre uma sessão de questões para acompanhar seus acertos por assunto.</span><button className="primary-button" onClick={() => setShowForm(true)}>Registrar primeiro bloco</button></div>}</div>
    </section>
  </div>;
}
