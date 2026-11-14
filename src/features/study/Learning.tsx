import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Brain, Check, Layers3, Lightbulb, Shuffle, Sparkles } from "lucide-react";
import type { Concept, ErrorRecord, LearningSession, StudySubject } from "../../domain/study";
import { listConcepts, listErrors, listLearningSessions, saveLearningSession } from "../../data/study";

type LearningMode = "explain" | "recall" | "errors" | "interleave";
interface LearningItem {
  sourceType: "flashcard-family" | "error-notebook";
  sourceId: string;
  subject: StudySubject;
  topic: string;
  prompt: string;
  reference: string;
  context: string;
}
const MODES: Array<{ id: LearningMode; title: string; desc: string; icon: typeof Brain }> = [
  { id: "recall", title: "Recuperação livre", desc: "Tente recuperar o que sabe antes de consultar a resposta.", icon: Brain },
  { id: "explain", title: "Autoexplicação", desc: "Explique o conceito com suas palavras e compare com a referência.", icon: Lightbulb },
  { id: "errors", title: "Retomar erros", desc: "Revisite a dificuldade e formule como resolveria uma nova questão.", icon: BookOpen },
  { id: "interleave", title: "Prática intercalada", desc: "Alterne conhecimentos e erros para treinar a escolha da estratégia.", icon: Shuffle },
];
function buildConceptItem(concept: Concept, mode: LearningMode): LearningItem | null {
  const variants = concept.variants.filter(variant => variant.status === "approved");
  if (!variants.length) return null;
  const variant = [...variants].sort((a, b) => a.uses - b.uses)[0];
  if (mode === "recall") {
    return {
      sourceType: "flashcard-family", sourceId: concept.id, subject: concept.subject, topic: concept.topic,
      prompt: concept.topic,
      reference: variants.map((item, index) => `${index + 1}. ${item.q}\n${item.a}${item.reason ? `\nExplicação: ${item.reason}` : ""}`).join("\n\n"),
      context: concept.source,
    };
  }
  return {
    sourceType: "flashcard-family", sourceId: concept.id, subject: concept.subject, topic: concept.topic,
    prompt: variant.q, reference: `${variant.a}${variant.reason ? `\n\nExplicação: ${variant.reason}` : ""}`,
    context: variant.source || concept.source,
  };
}
function buildErrorItem(error: ErrorRecord): LearningItem {
  return {
    sourceType: "error-notebook", sourceId: error.id, subject: error.subject, topic: error.topic,
    prompt: `Dificuldade registrada:\n${error.mistake}\n\nComo você explicaria a correção e resolveria uma nova questão sobre esse assunto?`,
    reference: error.fix,
    context: [error.discipline, error.area].filter(Boolean).join(" / "),
  };
}
function interleave<T>(first: T[], second: T[]): T[] {
  const result: T[] = [];
  const length = Math.max(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    if (first[index]) result.push(first[index]);
    if (second[index]) result.push(second[index]);
  }
  return result;
}
export function LearningPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [history, setHistory] = useState<LearningSession[]>([]);
  const [mode, setMode] = useState<LearningMode | null>(null);
  const [subject, setSubject] = useState<"all" | StudySubject>("all");
  const [queue, setQueue] = useState<LearningItem[]>([]);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [complete, setComplete] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([listConcepts(), listErrors(), listLearningSessions()])
      .then(([nextConcepts, nextErrors, nextHistory]) => { setConcepts(nextConcepts); setErrors(nextErrors); setHistory(nextHistory); })
      .finally(() => setLoading(false));
  }, []);
  const current = queue[index];
  const recentHistory = history.slice(0, 5);

  function start(selectedMode: LearningMode) {
    const eligibleConcepts = concepts.filter(concept => concept.status === "published" && !concept.suspended && (subject === "all" || concept.subject === subject));
    const eligibleErrors = errors.filter(error => subject === "all" || error.subject === subject);
    const conceptItems = eligibleConcepts.map(concept => buildConceptItem(concept, selectedMode)).filter((item): item is LearningItem => !!item);
    const errorItems = eligibleErrors.map(buildErrorItem);
    let items = selectedMode === "errors" ? errorItems : selectedMode === "interleave" ? interleave(conceptItems, errorItems) : conceptItems;
    items = items.slice(0, 12);
    if (!items.length) { setFeedback(selectedMode === "errors" ? "Registre erros no caderno para usar esta técnica." : "Cadastre famílias de flashcards para construir esta atividade."); return; }
    setMode(selectedMode); setQueue(items); setIndex(0); setResponse(""); setRevealed(false); setStartedAt(Date.now()); setComplete(false); setFeedback("");
  }

  async function grade(value: "complete" | "partial" | "retry") {
    if (!current || !response.trim()) { setFeedback("Escreva sua tentativa antes de registrar a atividade."); return; }
    const record: LearningSession = {
      id: crypto.randomUUID(), mode: mode || "recall", sourceType: current.sourceType, sourceId: current.sourceId,
      subject: current.subject, topic: current.topic, at: Date.now(), startedAt,
      grade: value, response, autoGraded: false, prompt: current.prompt,
    };
    await saveLearningSession(record);
    setHistory(items => [record, ...items]);
    setFeedback("");
    if (index + 1 >= queue.length) {
      setComplete(true);
    } else {
      setIndex(value => value + 1); setResponse(""); setRevealed(false);
    }
  }

  function leave() {
    setMode(null); setQueue([]); setIndex(0); setResponse(""); setRevealed(false); setComplete(false); setFeedback("");
  }

  if (loading) return <div className="loading-panel">Preparando suas atividades…</div>;
  if (mode && complete) return <div className="stack">
    <header className="heading"><div><small>RITMO / APRENDER</small><h1>Atividade concluída</h1><p>Você trabalhou com {queue.length} item(ns) do seu próprio material.</p></div></header>
    <section className="panel empty-state"><Check size={30}/><strong>Boa prática de recuperação!</strong><span>Seu registro foi salvo no histórico. Flashcards, FSRS e caderno de erros permaneceram intactos.</span><button className="primary-button" onClick={leave}>Voltar às técnicas</button></section>
  </div>;
  if (mode && current) return <div className="stack">
    <header className="heading"><div><small>RITMO / APRENDER · {MODES.find(item => item.id === mode)?.title.toUpperCase()}</small><h1>{current.topic}</h1><p>Item {index + 1} de {queue.length} · {current.sourceType === "flashcard-family" ? "Flashcard" : "Caderno de erros"}</p></div><button className="secondary-button" onClick={leave}><ArrowLeft size={15}/>Sair da atividade</button></header>
    <section className="panel learning-card">
      <div className="learning-progress"><span style={{ width: `${Math.round((index + 1) / queue.length * 100)}%` }}/></div>
      <div className="learning-context"><span className="subject-pill">{current.subject === "tae" ? "TAE" : "Física"}</span>{current.context && <small>{current.context}</small>}</div>
      <div className="learning-prompt">{current.prompt}</div>
      <div className="field-block"><label htmlFor="learning-response">{mode === "explain" ? "Explique com suas palavras" : mode === "errors" ? "Como você corrigiria o raciocínio?" : "Registre o que conseguiu recuperar"}</label><textarea id="learning-response" rows={6} value={response} onChange={event => setResponse(event.target.value)} placeholder="Escreva sua tentativa antes de revelar a referência…"/></div>
      {!revealed ? <button className="primary-button" disabled={!response.trim()} onClick={() => setRevealed(true)}>Comparar com a referência <ArrowRight size={15}/></button> : <div className="learning-reference"><span>REFERÊNCIA DO SEU MATERIAL</span><p>{current.reference}</p><div className="learning-self-grade"><strong>Como avalia sua explicação?</strong><div className="button-row"><button className="secondary-button compact" onClick={() => grade("retry")}>Preciso retomar</button><button className="secondary-button compact" onClick={() => grade("partial")}>Parcialmente</button><button className="primary-button compact" onClick={() => grade("complete")}>Consegui explicar <Check size={13}/></button></div></div></div>}
      {feedback && <p className="inline-feedback" role="alert">{feedback}</p>}
    </section>
  </div>;

  return <div className="stack">
    <header className="heading"><div><small>RITMO / APRENDIZAGEM</small><h1>Aprender</h1><p>Técnicas para trabalhar o material que você já cadastrou, sem substituir os flashcards nem alterar o FSRS.</p></div><span className="soft-tag"><Sparkles size={14}/> Sem IA externa</span></header>
    <section className="panel learning-start">
      <div className="panel-title-row"><div><span className="step-kicker">ESCOLHA UMA ESTRATÉGIA</span><h2>Como você quer estudar agora?</h2><p>As atividades usam somente suas famílias de flashcards e seus registros do caderno de erros.</p></div></div>
      <div className="field-block subject-filter"><label>Filtrar área</label><select value={subject} onChange={event => setSubject(event.target.value as "all" | StudySubject)}><option value="all">Todas</option><option value="tae">TAE</option><option value="fisica">Física</option></select></div>
      <div className="learning-mode-grid">{MODES.map(item => {
        const Icon = item.icon;
        return <button className="learning-mode-card" key={item.id} onClick={() => start(item.id)}><span><Icon size={21}/></span><strong>{item.title}</strong><small>{item.desc}</small><i><ArrowRight size={15}/></i></button>;
      })}</div>
      {feedback && <p className="inline-feedback">{feedback}</p>}
    </section>
    <section className="panel"><div className="panel-head"><h2>Histórico recente</h2><span className="soft-tag">{history.length} atividade(s)</span></div>
      {recentHistory.length ? recentHistory.map(item => <div className="learning-history-row" key={item.id}><div><strong>{item.topic}</strong><small>{MODES.find(modeItem => modeItem.id === item.mode)?.title || item.mode} · {item.sourceType === "error-notebook" ? "Caderno de erros" : "Flashcard"}</small></div><span className={`self-grade ${item.grade}`}>{item.grade === "complete" ? "Consegui" : item.grade === "partial" ? "Parcial" : "Retomar"}</span></div>) : <div className="empty-state"><BookOpen size={25}/><strong>Nenhuma atividade registrada</strong><span>Escolha uma estratégia acima para começar.</span></div>}
    </section>
    <p className="learning-footnote">Autoexplicação, recuperação livre e prática intercalada são atividades de aprendizagem ativa. Elas não reprogramam revisões; o FSRS continua sendo controlado exclusivamente pelos flashcards.</p>
  </div>;
}
