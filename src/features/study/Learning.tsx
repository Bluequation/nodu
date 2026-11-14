import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Brain, Check, Lightbulb, Shuffle, Layers3, NotebookPen, History } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {listPlans} from "../../data/plans";
import type {StudyPlan} from "../../domain/models";
import {getSelectedLeaves} from "../../domain/verticalization";
import {dateKey,linkedTo,sameTopic,topicScheduled,topicUrl} from "../../domain/topicContext";
import {pieceTitle,topicTone,topicPlacement,areaDisplayName,displayNodeName} from "../plans/planner/plannerModel";
import type {QuestionBlock,PlanTopicRef} from "../../domain/study";
import "./learning.css";
import type { Concept, ErrorRecord, LearningSession, StudySubject } from "../../domain/study";
import { listConcepts, listErrors, listLearningSessions, saveLearningSession,listQuestionBlocks,linkStudyMaterial,readTopicNote,saveTopicNote,finishTopicStudy,type MaterialKind } from "../../data/study";

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
const MODES: Array<{ id: LearningMode; title: string; desc: string; icon: typeof Brain; tone: string }> = [
  { id: "recall", title: "Recuperação livre", desc: "Lembre antes de consultar.", icon: Brain, tone: "recall" },
  { id: "explain", title: "Autoexplicação", desc: "Explique com suas palavras.", icon: Lightbulb, tone: "explain" },
  { id: "errors", title: "Retomar erros", desc: "Reconstrua seu raciocínio.", icon: BookOpen, tone: "errors" },
  { id: "interleave", title: "Prática intercalada", desc: "Alterne conceitos e erros.", icon: Shuffle, tone: "interleave" },
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
  const [params,setParams]=useSearchParams();
  const [plans,setPlans]=useState<StudyPlan[]>([]);
  const [blocks,setBlocks]=useState<QuestionBlock[]>([]);
  const [note,setNote]=useState("");
  const [noteReady,setNoteReady]=useState("");
  const [noteDirty,setNoteDirty]=useState(false);
  const [materialChoice,setMaterialChoice]=useState("");
  const [contextBusy,setContextBusy]=useState(false);
  const [contextFeedback,setContextFeedback]=useState("");
  const [sessionScope,setSessionScope]=useState<{ref:PlanTopicRef;date:string}|null>(null);
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
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    Promise.all([listConcepts(), listErrors(), listLearningSessions(),listPlans(),listQuestionBlocks()])
      .then(([nextConcepts, nextErrors, nextHistory,nextPlans,nextBlocks]) => { setConcepts(nextConcepts); setErrors(nextErrors); setHistory(nextHistory);setPlans(nextPlans);setBlocks(nextBlocks); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);
  const today=dateKey(),sessionDate=params.get("date")||today;
  const selectablePlans=plans.filter(p=>p.status==="active"||p.id===params.get("plan"));
  const defaultPlan=selectablePlans.find(p=>getSelectedLeaves(p.tree).some(leaf=>topicScheduled(p,leaf.id,today)&&!p.assignments.find(a=>a.nodeId===leaf.id)?.completedDates?.includes(today)));
  const planId=params.get("plan")||(defaultPlan?.id||"");
  const plan=selectablePlans.find(p=>p.id===planId);
  const leaves=plan?getSelectedLeaves(plan.tree):[];
  const scheduled=plan?leaves.filter(leaf=>topicScheduled(plan,leaf.id,sessionDate)):[];
  const chosen=params.get("topic");
  const leaf=chosen?leaves.find(l=>l.id===chosen):scheduled.find(l=>!plan?.assignments.find(a=>a.nodeId===l.id)?.completedDates?.includes(sessionDate))||scheduled[0]||leaves[0];
  const scope=plan&&leaf?{planId:plan.id,nodeId:leaf.id}:null;
  const scopeKey=scope?JSON.stringify([scope.planId,scope.nodeId]):"";
  const isScheduled=Boolean(scope&&plan&&topicScheduled(plan,scope.nodeId,sessionDate));
  const studied=Boolean(scope&&plan?.assignments.find(a=>a.nodeId===scope.nodeId)?.completedDates?.includes(sessionDate));
  useEffect(()=>{
    let active=true;setNote("");setNoteReady("");setNoteDirty(false);setMaterialChoice("");setContextFeedback("");
    if(scope){readTopicNote(scope).then(value=>{if(active){setNote(value);setNoteReady(scopeKey);}}).catch(()=>{if(active)setContextFeedback("Não foi possível carregar suas anotações.");});}
    return()=>{active=false};
  },[scopeKey]);
  function chooseScope(p:string,n?:string,date=sessionDate){
    if(noteDirty&&!window.confirm("Descartar as alterações não salvas das anotações?"))return;
    const next=new URLSearchParams({plan:p});if(n)next.set("topic",n);if(p!=="free")next.set("date",date);setParams(next);
  }
  async function saveNotes(){if(!scope||contextBusy||noteReady!==scopeKey)return;setContextBusy(true);try{await saveTopicNote(scope,note);setNoteDirty(false);setContextFeedback("Anotações salvas.");}catch{setContextFeedback("Não foi possível salvar as anotações.");}finally{setContextBusy(false);}}
  async function finish(){if(!scope||contextBusy||!isScheduled||sessionDate>today||studied)return;setContextBusy(true);try{const saved=await finishTopicStudy(scope,sessionDate);setPlans(old=>old.map(p=>p.id===saved.id?saved:p));setContextFeedback("Sessão concluída na Agenda e no plano.");}catch{setContextFeedback("Não foi possível concluir esta sessão.");}finally{setContextBusy(false);}}
  async function attachMaterial(){if(!scope||!materialChoice||contextBusy)return;const split=materialChoice.indexOf(":");const kind=materialChoice.slice(0,split) as MaterialKind,id=materialChoice.slice(split+1);setContextBusy(true);try{await linkStudyMaterial(kind,id,scope);const [c,e,b]=await Promise.all([listConcepts(),listErrors(),listQuestionBlocks()]);setConcepts(c);setErrors(e);setBlocks(b);setMaterialChoice("");setContextFeedback("Material vinculado a este assunto.");}catch{setContextFeedback("Não foi possível vincular o material.");}finally{setContextBusy(false);}}
  const current = queue[index];
  const scopedHistory=history.filter(item=>scope?!!item.planTopic&&sameTopic(item.planTopic,scope):planId&&planId!=="free"?false:subject==="all"||item.subject===subject);
  const recentHistory = scopedHistory.slice(0, 6);
  const inScope=(item:{planTopics?:PlanTopicRef[];subject:StudySubject})=>scope?linkedTo(item,scope):planId&&planId!=="free"?false:subject==="all"||item.subject===subject;
  const eligibleConcepts = concepts.filter(concept => concept.status === "published" && !concept.suspended && concept.variants.some(variant => variant.status === "approved") && inScope(concept));
  const eligibleErrors = errors.filter(error => error.status !== "dominado" && inScope(error));
  const available = (type: LearningMode) => type === "errors" ? eligibleErrors.length : type === "interleave" ? eligibleConcepts.length + eligibleErrors.length : eligibleConcepts.length;

  function start(selectedMode: LearningMode) {
    const conceptItems = eligibleConcepts.map(concept => buildConceptItem(concept, selectedMode)).filter((item): item is LearningItem => !!item);
    const errorItems = eligibleErrors.map(buildErrorItem);
    let items = selectedMode === "errors" ? errorItems : selectedMode === "interleave" ? interleave(conceptItems, errorItems) : conceptItems;
    items = items.slice(0, 12);
    if (!items.length) { setFeedback(selectedMode === "errors" ? "Registre erros no caderno para usar esta técnica." : "Cadastre famílias de flashcards para construir esta atividade."); return; }
    setSessionScope(scope?{ref:scope,date:sessionDate}:null);setMode(selectedMode); setQueue(items); setIndex(0); setResponse(""); setRevealed(false); setStartedAt(Date.now()); setComplete(false); setFeedback("");
  }

  async function grade(value: "complete" | "partial" | "retry") {
    if (!current || !response.trim() || saving) { setFeedback("Escreva sua tentativa antes de registrar a atividade."); return; }
    setSaving(true);
    const record: LearningSession = {
      id: crypto.randomUUID(), mode: mode || "recall", sourceType: current.sourceType, sourceId: current.sourceId,
      subject: current.subject, topic: current.topic, at: Date.now(), startedAt,
      grade: value, response, autoGraded: false, prompt: current.prompt,
      ...(sessionScope?{planTopic:sessionScope.ref,sessionDate:sessionScope.date}:{}),
    };
    try {
      await saveLearningSession(record);
      setHistory(items => [record, ...items]);
      setFeedback("");
      if (index + 1 >= queue.length) {
        setComplete(true);
      } else {
        setIndex(value => value + 1); setResponse(""); setRevealed(false);
      }
    } catch {
      setFeedback("Não foi possível salvar esta atividade. Sua resposta continua na tela; tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function leave() {
    setSessionScope(null);setMode(null); setQueue([]); setIndex(0); setResponse(""); setRevealed(false); setComplete(false); setFeedback("");
  }

  if (loading) return <div className="loading-panel">Preparando suas atividades…</div>;
  if (loadError) return <div className="loading-panel" role="alert">Não foi possível carregar seus materiais. <button className="secondary-button compact" onClick={()=>window.location.reload()}>Tentar novamente</button></div>;
  if (mode && complete) return <div className="stack ritmo-learning">
    <header className="heading"><div><small>RITMO / APRENDER</small><h1>Atividade concluída</h1></div></header>
    <section className="rl-finish"><span className="rl-finish-icon"><Check size={26}/></span><h2>{queue.length} {queue.length===1?"item trabalhado":"itens trabalhados"}</h2><p>Suas autoavaliações foram salvas no histórico{sessionScope?" deste assunto":""}. {sessionScope?"Volte ao assunto para concluir a sessão quando terminar de estudar.":""}</p><button className="primary-button" onClick={leave}>Voltar às técnicas <ArrowRight size={14}/></button></section>
  </div>;
  if (mode && current) {
    const strategy=MODES.find(item=>item.id===mode)!;
    const StrategyIcon=strategy.icon;
    return <div className="stack ritmo-learning">
      <header className="heading"><div><small>RITMO / APRENDER</small><h1>Aprender</h1></div><button className="secondary-button" disabled={saving} onClick={()=>{if(response.trim()&&!window.confirm("Sair sem registrar a resposta atual?"))return;leave();}}><ArrowLeft size={15}/> Voltar</button></header>
      <section className="rl-session">
        <header className="rl-session-head" data-mode={mode}><span className="rl-mode-icon"><StrategyIcon size={20}/></span><div><b>{strategy.title}</b><small>{current.sourceType==="flashcard-family"?"Flashcard":"Caderno de erros"} · {sessionScope&&plan?plan.title:current.subject==="tae"?"TAE":"Física"}</small></div><strong>{index+1}/{queue.length}</strong></header>
        <div className="rl-progress" role="progressbar" aria-label="Itens registrados" aria-valuenow={index} aria-valuemin={0} aria-valuemax={queue.length}><i style={{width:index/queue.length*100+"%"}}/></div>
        <div className="rl-question"><small>ASSUNTO</small><h2>{current.topic}</h2>{current.context&&<details><summary>Fonte / contexto</summary><p>{current.context}</p></details>}<div className="rl-prompt">{current.prompt}</div></div>
        <div className={"rl-workspace "+(revealed?"revealed":"")}>
          <div className="rl-response"><label htmlFor="learning-response">{mode==="explain"?"Explique com suas palavras":mode==="errors"?"Como corrigiria o raciocínio?":"O que você conseguiu recuperar?"}</label><textarea id="learning-response" rows={5} value={response} onChange={event=>setResponse(event.target.value)} disabled={saving} placeholder="Registre sua tentativa…"/>{!revealed&&<button className="primary-button" disabled={!response.trim()} onClick={()=>setRevealed(true)}>Comparar com a referência <ArrowRight size={15}/></button>}</div>
          {revealed&&<div className="rl-reference"><h3>Referência do seu material</h3><p>{current.reference}</p></div>}
        </div>
        {revealed&&<div className="rl-grade"><div><b>Como foi sua tentativa?</b><small>Autoavaliação</small></div><div className="rl-grade-actions"><button type="button" data-grade="retry" disabled={saving||!response.trim()} onClick={()=>grade("retry")}>Preciso retomar</button><button type="button" data-grade="partial" disabled={saving||!response.trim()} onClick={()=>grade("partial")}>Parcialmente</button><button type="button" data-grade="complete" disabled={saving||!response.trim()} onClick={()=>grade("complete")}>Consegui explicar <Check size={13}/></button></div></div>}
        {feedback&&<p className="rl-feedback" role="alert">{feedback}</p>}
      </section>
    </div>;
  }
  return <div className="stack ritmo-learning">
    <header className="heading"><div><small>RITMO / APRENDIZAGEM</small><h1>Aprender</h1></div>{(!planId||planId==="free")&&<select className="rl-filter" aria-label="Filtrar área" value={subject} onChange={event=>{setSubject(event.target.value as "all"|StudySubject);setFeedback("");}}><option value="all">Todas as áreas</option><option value="tae">TAE</option><option value="fisica">Física</option></select>}</header>
    <section className="rl-context">
      <header className="rl-section-head"><h2>O que você vai estudar?</h2>{scope&&<Link to={"/plans/"+scope.planId}>Ver plano <ArrowRight size={13}/></Link>}</header>
      <div className="rl-context-selects"><label>Plano<select aria-label="Plano de estudo" value={planId||"free"} disabled={contextBusy} onChange={e=>chooseScope(e.target.value)}><option value="free">Estudo livre</option>{selectablePlans.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}{planId&&planId!=="free"&&!plan&&<option value={planId}>Plano indisponível</option>}</select></label>{plan&&<><label>Data da sessão<input aria-label="Data da sessão" type="date" value={sessionDate} disabled={contextBusy} onChange={e=>{if(e.target.value)chooseScope(plan.id,undefined,e.target.value);}}/></label><label>Assunto<select aria-label="Assunto do plano" value={leaf?.id||""} disabled={contextBusy} onChange={e=>chooseScope(plan.id,e.target.value)}><option value="" disabled>Selecione um assunto</option>{scheduled.length>0&&<optgroup label="Previstos para o dia">{scheduled.map(l=><option key={l.id} value={l.id}>{pieceTitle(l.name)}</option>)}</optgroup> }<optgroup label="Outros assuntos do plano">{leaves.filter(l=>!scheduled.some(s=>s.id===l.id)).sort((a,b)=>pieceTitle(a.name).localeCompare(pieceTitle(b.name),"pt-BR")).map(l=><option key={l.id} value={l.id}>{pieceTitle(l.name)}</option>)}</optgroup></select></label></>}</div>
      {scope&&leaf&&plan?<div className="rl-topic" data-tone={topicTone(leaf,plan.area)}><div><small>{areaDisplayName(topicPlacement(leaf,plan.area).groups[0]||"Assunto")} · {isScheduled?(studied?"Sessão concluída":"Previsto no cronograma"):"Estudo extra"}</small><h2>{pieceTitle(leaf.name)}</h2><details><summary>Conteúdo original do edital</summary><p>{displayNodeName(leaf.name)}{leaf.sourceRef?" · "+leaf.sourceRef:""}</p></details></div>{isScheduled&&<button className="primary-button compact" disabled={studied||contextBusy||sessionDate>today} onClick={finish}><Check size={14}/>{studied?"Concluído":sessionDate>today?"Sessão futura":"Concluir sessão"}</button>}</div>:planId&&planId!=="free"?<p className="rl-feedback">Selecione um assunto válido para acessar seus materiais.</p>:<small className="rl-free-hint">Estudo livre, sem vincular ao cronograma.</small>}
      {contextFeedback&&<p className="rl-feedback" role="status">{contextFeedback}</p>}
    </section>
    {scope&&<section className="rl-topic-tools"><div className="rl-panel"><header className="rl-section-head"><h2><BookOpen size={16}/> Teoria e anotações</h2><button className="secondary-button compact" disabled={!noteDirty||contextBusy||noteReady!==scopeKey} onClick={saveNotes}>Salvar</button></header><textarea key={scopeKey} aria-label="Anotações do assunto" rows={4} value={note} disabled={noteReady!==scopeKey||contextBusy} onChange={e=>{setNote(e.target.value);setNoteDirty(true);}} placeholder="Cole sua teoria, escreva um resumo ou registre referências. O Ritmo não gera teoria automaticamente."/></div><div className="rl-panel rl-linked-tools"><header className="rl-section-head"><h2>Materiais do assunto</h2></header>
     <Link to={topicUrl("/flashcards",scope,sessionDate)}><Layers3 size={16}/> Flashcards · {concepts.filter(c=>linkedTo(c,scope)).length} famílias <ArrowRight size={13}/></Link><Link to={topicUrl("/reviews",scope,sessionDate)}><History size={16}/> Revisões do assunto <ArrowRight size={13}/></Link><Link to={topicUrl("/questions",scope,sessionDate)}><Check size={16}/> Questões · {blocks.filter(b=>linkedTo(b,scope)).reduce((n,b)=>n+b.total,0)} resolvidas <ArrowRight size={13}/></Link><Link to={topicUrl("/errors",scope,sessionDate)}><NotebookPen size={16}/> Caderno de erros <ArrowRight size={13}/></Link>
     <details><summary>Vincular material já cadastrado</summary><div className="rl-link-form"><select aria-label="Material existente" value={materialChoice} onChange={e=>setMaterialChoice(e.target.value)}><option value="">Selecione um material</option><optgroup label="Flashcards">{concepts.filter(c=>!linkedTo(c,scope)).map(c=><option value={"concepts:"+c.id} key={c.id}>{c.topic}</option>)}</optgroup><optgroup label="Erros">{errors.filter(c=>!linkedTo(c,scope)).map(c=><option value={"errors:"+c.id} key={c.id}>{c.topic}</option>)}</optgroup><optgroup label="Questões">{blocks.filter(c=>!linkedTo(c,scope)).map(c=><option value={"blocks:"+c.id} key={c.id}>{c.topic} · {c.total} questões · {new Date(c.at).toLocaleDateString("pt-BR")}</option>)}</optgroup></select><button className="secondary-button compact" disabled={!materialChoice||contextBusy} onClick={attachMaterial}>Vincular</button></div></details></div></section>}
    <section className="rl-strategies" aria-label="Estratégias de estudo">
      <div className="rl-section-head"><h2>Escolha uma estratégia</h2><small>Até 12 itens por atividade</small></div>
      <div className="rl-mode-grid">{MODES.map(item=>{
        const Icon=item.icon,count=available(item.id);
        return <button type="button" className="rl-mode" data-mode={item.tone} key={item.id} disabled={!count} onClick={()=>start(item.id)}><span className="rl-mode-top"><span className="rl-mode-icon"><Icon size={19}/></span><ArrowRight size={15}/></span><strong>{item.title}</strong><small>{item.desc}</small><span className="rl-count">{count?count+" "+(count===1?"item disponível":"itens disponíveis"):"Sem material disponível"}</span></button>;
      })}</div>
      {feedback&&<p className="rl-feedback" role="status">{feedback}</p>}
    </section>
    <div className="rl-lower">
      <section className="rl-panel rl-history"><header className="rl-section-head"><h2><History size={17}/> Histórico recente</h2><small>{scopedHistory.length} registros</small></header>
        {recentHistory.length?<div className="rl-history-list">{recentHistory.map(item=><details className="rl-history-item" key={item.id}><summary><div><b>{item.topic}</b><small>{MODES.find(m=>m.id===item.mode)?.title||item.mode} · {new Date(item.at).toLocaleDateString("pt-BR")}</small></div><span className={"self-grade "+item.grade}>{item.grade==="complete"?"Consegui":item.grade==="partial"?"Parcial":"Retomar"}</span></summary>{item.prompt&&<p><b>Proposta:</b> {item.prompt}</p>}{item.response?<p><b>Sua tentativa:</b> {item.response}</p>:<p>Resposta não disponível neste registro.</p>}</details>)}</div>:<div className="rl-empty"><History size={23}/><div><b>Nenhum registro ainda</b><span>Suas tentativas aparecerão aqui.</span></div></div>}
      </section>
      <section className="rl-panel rl-material"><header className="rl-section-head"><h2>Seu material</h2></header>
        <Link to={scope?topicUrl("/flashcards",scope,sessionDate):"/flashcards"} className="rl-material-row"><span className="rl-material-icon" data-mode="recall"><Layers3 size={18}/></span><div><b>Flashcards</b><small>{eligibleConcepts.length} famílias disponíveis</small></div><ArrowRight size={14}/></Link>
        <Link to={scope?topicUrl("/errors",scope,sessionDate):"/errors"} className="rl-material-row"><span className="rl-material-icon" data-mode="errors"><NotebookPen size={18}/></span><div><b>Caderno de erros</b><small>{eligibleErrors.length} erros disponíveis</small></div><ArrowRight size={14}/></Link>
        {!eligibleConcepts.length&&!eligibleErrors.length&&<p>Adicione materiais para liberar as estratégias.</p>}
      </section>
    </div>
  </div>;
}
