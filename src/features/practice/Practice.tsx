import { useEffect, useState, type FormEvent } from "react";
import "../study/materials.css";
import {useStudyContext} from "../study/useStudyContext";
import {linkedTo} from "../../domain/topicContext";
import { ArrowRight, Check, Plus, Target, Trash2 } from "lucide-react";
import type { StudySubject, QuestionBlock } from "../../domain/study";
import { deleteQuestionBlock, listQuestionBlocks, saveQuestionBlock } from "../../data/study";

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

export { ErrorsPage } from "./ErrorsPage";

export function QuestionsPage() {
  const context=useStudyContext();
  const [blocks, setBlocks] = useState<QuestionBlock[]>([]);
  const [form, setForm] = useState(EMPTY_BLOCK);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | StudySubject>("all");
  const [feedback, setFeedback] = useState("");
  async function reload() { setBlocks(await listQuestionBlocks()); }
  useEffect(() => { reload(); }, []);
  const visible = blocks.filter(block => context.requested?context.valid&&linkedTo(block,context.ref):filter === "all" || block.subject === filter);
  function newBlock(){setForm(context.valid?{...EMPTY_BLOCK,topic:context.title,subject:/f[ií]sica/i.test(context.plan?.area||"")?"fisica":"tae"}:EMPTY_BLOCK);setShowForm(true);}
  const total = visible.reduce((sum, block) => sum + block.total, 0);
  const correct = visible.reduce((sum, block) => sum + block.correct, 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if(context.requested&&!context.valid){setFeedback("Assunto indisponível.");return;}
    if (!form.topic.trim() || form.total < 1 || form.correct < 0 || form.correct > form.total) { setFeedback("Confira o assunto, o total e a quantidade de acertos."); return; }
    await saveQuestionBlock({ ...form, id: crypto.randomUUID(), topic: form.topic.trim(), at: Date.now(),...(context.valid?{planTopics:[context.ref]}:{}) });
    setForm(EMPTY_BLOCK); setShowForm(false); setFeedback("Bloco registrado."); await reload();
  }
  async function remove(id: string) {
    if (!confirm("Excluir este bloco de questões?")) return;
    await deleteQuestionBlock(id); await reload();
  }
  return <div className="stack">
    <header className="heading"><div><small>RITMO / PRÁTICA</small><h1>Questões</h1><p>Registre blocos resolvidos e acompanhe a aplicação do que você estudou.</p></div><button className="primary-button" onClick={()=>showForm?setShowForm(false):newBlock()}><Plus size={16}/>Registrar bloco</button></header>
    {context.requested&&<p className="inline-feedback">{context.valid?context.plan?.title+" · "+context.title:"Assunto indisponível ou carregando."} · <Link to={context.returnTo}>Voltar a Aprender</Link></p>}
    <section className="panel">
      <div className="practice-toolbar"><div className="filter-pills">{(["all", "tae", "fisica"] as const).map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "Todas" : value === "tae" ? "TAE" : "Física"}</button>)}</div><span className="soft-tag">{total} questões · {total ? Math.round(correct / total * 100) : 0}% de acertos</span></div>
      {showForm && <form className="question-form" onSubmit={submit}><div className="form-grid">
        <div className="field-block"><label>Área de estudo</label><select value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value as StudySubject }))}><option value="tae">Geral</option><option value="fisica">Física</option></select></div>
        <div className="field-block"><label>Assunto</label><input required value={form.topic} onChange={event => setForm(current => ({ ...current, topic: event.target.value }))} placeholder="Ex.: SINAES"/></div>
        <div className="field-block"><label>Questões resolvidas</label><input type="number" min={1} max={500} value={form.total} onChange={event => setForm(current => ({ ...current, total: Number(event.target.value) }))}/></div>
        <div className="field-block"><label>Acertos</label><input type="number" min={0} max={500} value={form.correct} onChange={event => setForm(current => ({ ...current, correct: Number(event.target.value) }))}/></div>
        <div className="field-block field-span"><label>Observação (opcional)</label><textarea rows={2} value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} placeholder="Banca, dificuldade, tipo de erro…"/></div>
      </div>{feedback && <p className="inline-feedback">{feedback}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" type="submit">Registrar questões <Check size={15}/></button></div></form>}
      <div className="question-block-list">{visible.length ? visible.map(block => <article className="question-block-card" key={block.id}><div><span className="subject-pill">{subjectLabel(block.subject)}</span><h3>{block.topic}</h3><p>{dateLabel(block.at)} · {block.total} questões · {block.correct} acertos · {Math.round(block.correct / block.total * 100)}%</p>{block.note && <small>{block.note}</small>}</div><button className="icon-button" aria-label="Excluir bloco" onClick={() => remove(block.id)}><Trash2 size={14}/></button></article>) : <div className="empty-state"><Target size={28}/><strong>Nenhum bloco registrado</strong><span>Registre uma sessão de questões para acompanhar seus acertos por assunto.</span><button className="primary-button" onClick={newBlock}>Registrar primeiro bloco</button></div>}</div>
    </section>
  </div>;
}
