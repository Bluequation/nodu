import { useEffect, useMemo, useState, useRef, useCallback, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, AlertCircle, BookOpen, CalendarDays, Check, CheckCircle2, Clipboard,
  ChevronDown, ChevronRight, Clock3, Flame, FolderOpen, Info, Lightbulb, ListChecks,
  NotebookPen, Pencil, Plus, Sparkles, Target, TrendingUp, Upload, LoaderCircle,
} from "lucide-react";
import { getPlan, savePlan } from "../../data/plans";
import { listConcepts, listErrors, listQuestionBlocks } from "../../data/study";
import type { Concept, ErrorRecord, QuestionBlock } from "../../domain/study";
import type { DaySchedule, PlanAssignment, PlanNode, PlanStage, ScheduleConfig, StudyPlan } from "../../domain/models";
import {
  addManualChildToTree, buildVerticalPrompt, getNodeSelectionState,
  getPlanSections, getSelectedLeaves, parseVerticalMarkdown, renameNodeInTree, type SelectedPlanLeaf,
  toggleNodeInTree,
} from "../../domain/verticalization";

import {ScheduleStep} from "./planner/PlannerEditor";
import {WEEKDAYS,today,displayNodeName,durationFromTimes,minutesForDay,formatDuration,emptyDaySchedule,defaultSchedule,reconcileAssignments,pieceTitle,topicPlacement,topicTone,areaTone,areaDisplayName} from "./planner/plannerModel";
import "./plan-surfaces.css";

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions?: { workerSrc: string };
      getDocument: (input: { data: Uint8Array; disableWorker?: boolean }) => {
        promise: Promise<{
          numPages: number;
          getPage: (page: number) => Promise<{
            getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
          }>;
        }>;
      };
    };
  }
}

async function readPdf(file: File): Promise<string> {
  if (!window.pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Não foi possível carregar o leitor de PDF. Você pode colar o texto do edital."));
      document.head.appendChild(script);
    });
  }
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) throw new Error("O leitor de PDF não ficou disponível. Tente novamente ou cole o texto.");
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableWorker: true }).promise;
  const pages: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const items = await page.getTextContent();
    const line = items.items.map(item => item.str || "").filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (line) pages.push(`[Página ${pageNo}]\n${line}`);
  }
  const result = pages.join("\n\n");
  if (result.trim().length < 80) throw new Error("Este PDF parece escaneado ou não tem texto selecionável. Use OCR ou cole o conteúdo programático.");
  return result.slice(0, 180000);
}

function saveBlob(name: string, text: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

type BeforeLeave = (handler: (()=>Promise<boolean>) | null)=>void;
function Stepper({stage,hasTree,hasSelection,busy,onChange}: {stage:PlanStage;hasTree:boolean;hasSelection:boolean;busy:boolean;onChange:(stage:PlanStage)=>void}) {
  const stages=[{id:"source",label:"Edital",allowed:true},{id:"selection",label:"Seleção",allowed:hasTree},{id:"schedule",label:"Cronograma",allowed:hasSelection}] as const;
  const current=stages.findIndex(item=>item.id===stage);
  return <nav className="wizard-stepper" aria-label="Etapas do plano">
    {stages.map((step,index)=><button type="button" key={step.id} className={"wizard-step "+(index===current?"is-current":index<current?"is-complete":"")} aria-current={index===current?"step":undefined} aria-label={step.label} disabled={busy||!step.allowed} onClick={()=>onChange(step.id)}><span aria-hidden="true">{index<current?<Check size={14}/>:index+1}</span>{step.label}</button>)}
  </nav>;
}

function SelectionNode({
  node, depth, onToggle, onRename,
}: {
  node: PlanNode;
  depth: number;
  onToggle: (id: string, checked: boolean) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayNodeName(node.name));
  useEffect(() => setNameDraft(displayNodeName(node.name)), [node.name]);
  const state = getNodeSelectionState(node);
  const officialChildren = node.children.filter(child => child.origin !== "suggested");
  const suggestedChildren = node.children.filter(child => child.origin === "suggested");
  const hasOfficialChildren = officialChildren.length > 0;
  const suggested = node.origin === "suggested";
  return <div className={`selection-node depth-${Math.min(depth, 4)} ${suggested ? "is-suggested" : ""}`}>
    <div className="selection-node-main">
      {hasOfficialChildren
        ? <button
            className="selection-node-expand"
            type="button"
            aria-label={expanded ? `Recolher ${node.name}` : `Expandir ${node.name}`}
            aria-expanded={expanded}
            onClick={() => setExpanded(value => !value)}
          >{expanded ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button>
        : <span className="selection-node-disclosure-spacer" aria-hidden="true"/>}
      <input
        aria-label={`Selecionar ${node.name}`}
        type="checkbox"
        checked={state.all}
        ref={element => { if (element) element.indeterminate = state.some && !state.all; }}
        onChange={event => onToggle(node.id, event.target.checked)}
      />
      <div className="selection-node-copy">
        <div className="selection-node-meta">
          {node.origin !== "edital" && <span className={`origin-pill ${node.origin}`}>{suggested ? "Complementar" : "Adicionado por você"}</span>}
          {node.sourceRef && <span className="source-reference">{node.sourceRef}</span>}
          {hasOfficialChildren && <span className="selection-node-count">{officialChildren.length} subitem(ns)</span>}
        </div>
        {editing
          ? <div className="inline-node-edit"><input aria-label="Editar nome do conteúdo" value={nameDraft} maxLength={240} onChange={event => setNameDraft(event.target.value)}/><button type="button" aria-label="Salvar nome" onClick={() => { if (nameDraft.trim()) onRename(node.id, nameDraft); setEditing(false); }}><Check size={14}/></button><button type="button" aria-label="Cancelar edição" onClick={() => { setNameDraft(displayNodeName(node.name)); setEditing(false); }}>×</button></div>
          : <strong>{displayNodeName(node.name)}</strong>}
        {node.sourceText && !suggested && node.sourceText.trim() !== node.name.trim() && <details className="source-excerpt">
          <summary>Consultar trecho original</summary>
          <p>{node.sourceText}</p>
        </details>}
      </div>
      <button className="node-edit-button" type="button" title="Editar nome" aria-label={`Editar ${node.name}`} onClick={() => setEditing(true)}><Pencil size={13}/></button>
    </div>
    {hasOfficialChildren && expanded && <div className="selection-children">
      {officialChildren.map(child => <SelectionNode key={child.id} node={child} depth={depth + 1} onToggle={onToggle} onRename={onRename}/>)}
    </div>}
    {suggestedChildren.length > 0 && <div className="suggestion-area">
      <button type="button" className="suggestion-toggle" onClick={() => setSuggestionsOpen(open => !open)} aria-expanded={suggestionsOpen}>
        <span><Sparkles size={15}/>{suggestionsOpen ? "Ocultar" : "Ver"} {suggestedChildren.length} complemento(s) antigo(s)</span>
        <small>Não faz parte do edital · desmarcado por padrão</small>
        {suggestionsOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
      </button>
      {suggestionsOpen && <div className="suggestion-list">
        {suggestedChildren.map(child => <SelectionNode key={child.id} node={child} depth={depth + 1} onToggle={onToggle} onRename={onRename}/>)}
      </div>}
    </div>}
  </div>;
}

function SourceStep({ plan, onSave, registerBeforeLeave }: { plan: StudyPlan; onSave: (next: StudyPlan) => Promise<void>; registerBeforeLeave:BeforeLeave }) {
  const [sourceText, setSourceText] = useState(plan.sourceText);
  const [sourceFile, setSourceFile] = useState(plan.sourceFile);
  const [structureText, setStructureText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [savingSource, setSavingSource] = useState(false);
  const [savedSource, setSavedSource] = useState(false);
  useEffect(() => { setSourceText(plan.sourceText); setSourceFile(plan.sourceFile); }, [plan.id, plan.sourceText, plan.sourceFile]);

  useEffect(()=>{
    registerBeforeLeave(async()=>{
      if(busy||savingSource)return false;
      if(structureText.trim()&&!window.confirm("A estrutura ainda não foi importada. Sair desta etapa sem importá-la?"))return false;
      if(sourceText!==plan.sourceText||sourceFile!==plan.sourceFile)await onSave({...plan,sourceText,sourceFile});
      return true;
    });
    return ()=>registerBeforeLeave(null);
  },[registerBeforeLeave,plan,sourceText,sourceFile,structureText,busy,savingSource,onSave]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 25_000_000) { setMessage("O arquivo ultrapassa 25 MB. Escolha um arquivo menor."); return; }
    setBusy(true); setSavedSource(false); setMessage("");
    try {
      const text = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        ? await readPdf(file)
        : file.name.toLowerCase().endsWith(".txt") || file.name.toLowerCase().endsWith(".md")
          ? await file.text()
          : "";
      if (!text) throw new Error("Formato não reconhecido. Envie PDF, TXT ou Markdown.");
      setSourceText(text.slice(0, 180000));
      setSourceFile(file.name);
      setSavedSource(false);
      setMessage("Texto extraído. Confira se corresponde ao cargo e à área escolhidos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function saveSource() {
    if (savingSource) return;
    setSavingSource(true);
    setSavedSource(false);
    setMessage("");
    try {
      await onSave({ ...plan, sourceText, sourceFile, updatedAt: Date.now() });
      setSavedSource(true);
      setMessage("Dados do edital salvos neste navegador.");
    } catch {
      setMessage("Não foi possível salvar os dados. Tente novamente.");
    } finally {
      setSavingSource(false);
    }
  }
  async function copyPrompt() {
    const prompt = buildVerticalPrompt({ ...plan, sourceText });
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("Solicitação copiada. Agora cole-a no ChatGPT.");
    } catch {
      saveBlob("solicitacao-verticalizacao-ritmo.txt", prompt);
      setMessage("O navegador não permitiu copiar. Baixei a solicitação em TXT.");
    }
  }
  async function importStructure() {
    try {
      const parsed = parseVerticalMarkdown(structureText);
      if(plan.tree.length&&!window.confirm("Substituir a estrutura importada? Isso reinicia a seleção e a distribuição do edital atual."))return;
      await onSave({
        ...plan,
        sourceText,
        sourceFile,
        tree: parsed.tree,
        warnings: parsed.warnings,
        selectionIndex: 0,
        stage: "selection",
        assignments: [],
        updatedAt: Date.now(),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui ler a estrutura.");
    }
  }

  const ready=Boolean(sourceText.trim());
  const dirty=sourceText!==plan.sourceText||sourceFile!==plan.sourceFile;
  return <div className="rp-source-workspace">
    <section className="rp-flow-card">
      <header className="rp-flow-heading"><span><FolderOpen size={20}/></span><div><h2>Documento do concurso</h2><p>Adicione o arquivo ou cole o conteúdo programático.</p></div></header>
      <div className="rp-flow-meta">{[plan.position,plan.area,plan.organizer].filter(Boolean).map((value,i)=><span key={i}>{value}</span>)}</div>
      <div className="field-block"><label htmlFor="source-file">Arquivo do edital</label><div className="file-picker"><Upload size={18}/><span>{busy?"Lendo arquivo…":sourceFile||"PDF, TXT ou Markdown"}</span><label className="secondary-button" htmlFor="source-file">{sourceFile?"Trocar":"Procurar"}</label><input id="source-file" type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={handleFile} disabled={busy||savingSource}/></div><small>PDF textual. O arquivo permanece neste navegador.</small></div>
      <div className="field-block"><label htmlFor="source-text">Texto do edital</label><textarea id="source-text" rows={7} maxLength={180000} value={sourceText} onChange={event=>{setSourceText(event.target.value);setSavedSource(false);setMessage("Alterações não salvas.");}} placeholder="Cole o conteúdo correspondente ao cargo e à área."/></div>
      <div className="rp-flow-actions"><small>{dirty?"Alterações não salvas":ready?"Texto salvo neste navegador":"Aguardando documento"}</small><button className={`secondary-button source-save-button ${savingSource?"is-saving":savedSource?"is-saved":""}`} type="button" onClick={saveSource} disabled={savingSource||busy}>{savingSource?<><LoaderCircle size={15} className="save-spinner"/> Salvando…</>:savedSource?<><CheckCircle2 size={15}/> Salvo</>:<><Check size={15}/> Salvar edital</>}</button></div>
    </section>
    <section className="rp-flow-card rp-import-card">
      <header className="rp-flow-heading"><span className="purple"><Sparkles size={20}/></span><div><h2>Organize os assuntos</h2><p>Use a IA de sua preferência, sem conexão por API.</p></div></header>
      {plan.tree.length>0&&<div className="rp-import-ready"><CheckCircle2 size={18}/><div><b>Estrutura importada</b><small>{getSelectedLeaves(plan.tree).length} assuntos selecionados. Você pode continuar pela aba Seleção.</small></div></div>}
      <div className="rp-import-flow">
        <div><i>1</i><span><b>Copiar solicitação</b><small>Inclui o recorte e o texto disponível.</small></span><button type="button" className="secondary-button compact" disabled={!ready||busy} onClick={copyPrompt}><Clipboard size={15}/> Copiar</button></div>
        <div><i>2</i><span><b>Consultar a IA</b><small>Cole o pedido na IA e copie a resposta em Markdown.</small></span></div>
        <div><i>3</i><span><b>Importar a estrutura</b><small>Cole a resposta abaixo, sem acrescentar assuntos ao edital.</small></span></div>
      </div>
      <div className="field-block"><label htmlFor="structure-text">Estrutura verticalizada</label><textarea id="structure-text" rows={7} value={structureText} onChange={event=>setStructureText(event.target.value)} placeholder="Cole a resposta em Markdown aqui."/></div>
      <div className="rp-flow-actions"><button className="text-button" type="button" onClick={()=>setStructureText("# [EDITAL] Conhecimentos gerais\n## [EDITAL] Disciplina\n### [EDITAL] Assunto")}>Modelo manual</button><button className="text-button" type="button" onClick={()=>saveBlob("modelo-verticalizacao-ritmo.md","# [EDITAL] Disciplina\n## [EDITAL] Área ou eixo\n### [EDITAL] Assunto literal\n> Referência: página ou item, se disponível\n> Trecho literal: transcrição fiel, quando necessária\n")}>Baixar modelo</button><button className="primary-button" type="button" disabled={!structureText.trim()||busy||savingSource} onClick={importStructure}>Importar e selecionar <ArrowRight size={15}/></button></div>
    </section>
    {message&&<p className="rp-flow-feedback" role="status">{busy?"Lendo arquivo…":message}</p>}
  </div>;
}

function SelectionStep({ plan, onSave }: { plan: StudyPlan; onSave: (next: StudyPlan) => Promise<void> }) {
  const [manualName, setManualName] = useState("");
  const [showManual, setShowManual] = useState(false);
  const sections = useMemo(() => getPlanSections(plan.tree), [plan.tree]);
  const index = Math.max(0, Math.min(plan.selectionIndex, sections.length));
  const review = index >= sections.length;
  const current = sections[index];
  const leaves = getSelectedLeaves(plan.tree);
  const officialCount = leaves.filter(leaf => leaf.origin === "edital").length;
  const manualCount = leaves.filter(leaf => leaf.origin === "manual").length;
  const suggestedCount = leaves.filter(leaf => leaf.origin === "suggested").length;

  async function updateTree(tree: PlanNode[]) {
    await onSave({ ...plan, tree, updatedAt: Date.now() });
  }
  async function moveTo(next: number) {
    await onSave({ ...plan, selectionIndex: next, updatedAt: Date.now() });
  }
  async function finishSelection() {
    const schedule = plan.scheduleConfig || defaultSchedule(plan);
    await onSave({ ...plan, stage: "schedule", scheduleConfig: schedule, updatedAt: Date.now() });
  }

  const sectionInfo=sections.map((section,i)=>{
    const original=displayNodeName(section.node.name);
    const specific=/conhecimentos espec[ií]ficos/i.test([...section.path,section.node.name].map(displayNodeName).join(" "));
    const label=/^educação brasileira: temas educacionais/i.test(original)?"Educação brasileira":areaDisplayName(original);
    return {section,i,original,label,specific,tone:areaTone(specific?"specific":"general",original),selected:getSelectedLeaves([section.node])};
  });
  return <div className="rp-selection-workspace">
    <aside className="rp-selection-nav">
      <header><h2>Áreas do edital</h2><small>{leaves.length} selecionados</small></header>
      {[false,true].map(specific=>{const groups=sectionInfo.filter(item=>item.specific===specific);return groups.length>0&&<div className="rp-selection-category" key={String(specific)}><h3>{specific?"Conhecimentos específicos":"Conhecimentos gerais"}</h3>{groups.map(item=><button type="button" key={item.section.node.id} className={"rp-select-area "+(index===item.i?"active":"")} data-tone={item.tone} aria-pressed={index===item.i} title={item.original} onClick={()=>{setShowManual(false);void moveTo(item.i);}}><i/><span>{item.label}</span><b>{item.selected.length}</b><ChevronRight size={14}/></button>)}</div>})}
      <button className={"rp-review-link "+(review?"active":"")} type="button" aria-pressed={review} onClick={()=>moveTo(sections.length)}><ListChecks size={17}/><span>Revisão da seleção</span><ChevronRight size={14}/></button>
      <small className="rp-selection-saved"><CheckCircle2 size={13}/> Salvamento automático</small>
    </aside>
    <section className="rp-selection-main selection-progress">
      {!review&&current?<div className="rp-selection-editor" data-tone={sectionInfo[index].tone}>
        <header className="rp-selection-banner"><div><small>{sectionInfo[index].specific?"Conhecimentos específicos":"Conhecimentos gerais"}</small><h2 title={sectionInfo[index].original}>{sectionInfo[index].label}</h2><p>{sectionInfo[index].selected.length} assuntos selecionados</p></div><div className="rp-selection-tools"><button className="secondary-button compact" type="button" onClick={()=>updateTree(toggleNodeInTree(plan.tree,current.node.id,true,false))}>Selecionar todos</button><button className="text-button" type="button" onClick={()=>updateTree(toggleNodeInTree(plan.tree,current.node.id,false,true))}>Limpar</button><button className="text-button" type="button" onClick={()=>setShowManual(value=>!value)}><Plus size={14}/> Adicionar</button></div></header>
        {showManual&&<form className="manual-add-row" onSubmit={event=>{event.preventDefault();if(!manualName.trim())return;void updateTree(addManualChildToTree(plan.tree,current.node.id,manualName));setManualName("");setShowManual(false);}}><input aria-label="Novo conteúdo manual" value={manualName} onChange={event=>setManualName(event.target.value)} placeholder="Assunto ou subassunto"/><button className="secondary-button compact" type="submit" disabled={!manualName.trim()}>Adicionar</button></form>}
        <div className="rp-selection-tree"><SelectionNode key={current.node.id} node={current.node} depth={0} onToggle={(id,checked)=>updateTree(toggleNodeInTree(plan.tree,id,checked))} onRename={(id,name)=>updateTree(renameNodeInTree(plan.tree,id,name))}/></div>
      </div>:<div className="rp-selection-review">
        <header className="rp-review-heading"><div><h2>Sua seleção</h2><p>Confira as áreas antes de montar a semana.</p></div><div className="rp-review-total"><strong>{leaves.length}</strong><small>assuntos</small></div></header>
        <div className="rp-flow-meta"><span>{officialCount} do edital</span>{manualCount>0&&<span>{manualCount} manuais</span>}{suggestedCount>0&&<span>{suggestedCount} complementos antigos</span>}</div>
        <div className="rp-review-grid">{sectionInfo.map(item=><article className="rp-review-card" data-tone={item.tone} key={item.section.node.id}><header><i/><b title={item.original}>{item.label}</b><strong>{item.selected.length}</strong><button type="button" aria-label={`Editar seleção de ${item.label}`} onClick={()=>moveTo(item.i)}><Pencil size={14}/></button></header>{item.selected.length>0?<details className="rp-review-topics"><summary>Ver assuntos <ChevronDown size={13}/></summary><div>{item.selected.map(leaf=><span key={leaf.id} title={displayNodeName(leaf.name)}>{pieceTitle(leaf.name)}{leaf.origin!=="edital"?" · "+(leaf.origin==="manual"?"Manual":"Complementar"):""}</span>)}</div></details>:<small>Nenhum assunto selecionado</small>}</article>)}</div>
        {plan.warnings.length>0&&<details className="rp-review-warnings"><summary><Info size={15}/> Observações da análise ({plan.warnings.length})</summary>{plan.warnings.map((warning,i)=><p key={i}>{warning}</p>)}</details>}
      </div>}
    </section>
    <footer className="rp-selection-footer"><button className="secondary-button" type="button" onClick={()=>index===0?onSave({...plan,stage:"source"}):moveTo(index-1)}><ArrowLeft size={15}/>{index===0?"Edital":"Anterior"}</button><span>{leaves.length} assuntos · {review?"Revisão":`Área ${index+1} de ${sections.length}`}</span>{review?<button className="primary-button" type="button" disabled={!leaves.length} onClick={finishSelection}>Montar cronograma <ArrowRight size={15}/></button>:<button className="primary-button" type="button" onClick={()=>moveTo(index+1)}>{index===sections.length-1?"Revisar seleção":"Próxima área"} <ArrowRight size={15}/></button>}</footer>
  </div>;
}

// Compact display labels only; the original titles remain in the plan.
export function PlanWizardRoute() {
  const { id = "" } = useParams();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching,setSwitching]=useState(false);
  const [navigationError,setNavigationError]=useState("");
  const latest=useRef<StudyPlan|null>(null);
  const writes=useRef<Promise<unknown>>(Promise.resolve());
  const beforeLeave=useRef<(()=>Promise<boolean>)|null>(null);
  const registerBeforeLeave=useCallback<BeforeLeave>(handler=>{beforeLeave.current=handler;},[]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    getPlan(id).then(found => { if (active) {latest.current=found||null;setPlan(found || null);} }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const persist=useCallback(async(next:StudyPlan)=>{
    const previous=latest.current;
    latest.current=next;setPlan(next);
    const task=writes.current.catch(()=>{}).then(()=>savePlan(next));
    writes.current=task;
    try {const saved=await task;if(latest.current===next){latest.current=saved;setPlan(saved);}}
    catch(error){if(latest.current===next){latest.current=previous;setPlan(previous);}throw error;}
  },[]);
  async function navigateStage(stage:PlanStage){
    if(switching||!latest.current||latest.current.stage===stage)return;
    setSwitching(true);setNavigationError("");
    try {
      if(beforeLeave.current&&!(await beforeLeave.current()))return;
      await writes.current;
      const current=latest.current;
      if(!current||stage==="selection"&&!current.tree.length||stage==="schedule"&&!getSelectedLeaves(current.tree).length)return;
      const schedule=stage==="schedule"?(current.scheduleConfig||defaultSchedule(current)):current.scheduleConfig;
      await persist({...current,stage,scheduleConfig:schedule});
    }catch{setNavigationError("Não foi possível salvar antes de mudar de etapa. Tente novamente.");}
    finally{setSwitching(false);}
  }
  if (loading) return <div className="stack"><div className="loading-panel">Abrindo seu plano…</div></div>;
  if (!plan) return <div className="stack"><div className="panel empty-state"><FolderOpen size={28}/><strong>Não encontrei este plano.</strong><Link to="/plans" className="text-link">Voltar aos planos</Link></div></div>;

  return <div className="stack wizard-stack ritmo-plan-surface">
    <header className="heading wizard-heading">
      <div><small>MEUS PLANOS / {plan.stage==="schedule"?"CRONOGRAMA":plan.stage==="selection"?"CONTEÚDOS":"EDITAL"}</small><h1>{plan.title}</h1><p>{[plan.institution, plan.position, plan.area].filter(Boolean).join(" · ")}</p></div>
      <Link className="secondary-button" to="/plans"><ArrowLeft size={16}/>Meus planos</Link>
    </header>
    <Stepper stage={plan.stage} hasTree={plan.tree.length>0} hasSelection={getSelectedLeaves(plan.tree).length>0} busy={switching} onChange={navigateStage}/>
    {navigationError&&<p className="inline-feedback" role="alert">{navigationError}</p>}
    {plan.stage === "source"
      ? <SourceStep plan={plan} onSave={persist} registerBeforeLeave={registerBeforeLeave}/>
      : plan.stage === "selection"
        ? <SelectionStep plan={plan} onSave={persist}/>
        : <ScheduleStep key={plan.id} plan={plan} onSave={persist} registerBeforeLeave={registerBeforeLeave}/>}
    <div className="wizard-footnote">Seus dados permanecem neste navegador. A estrutura original do edital e as sugestões ficam identificadas separadamente.</div>
  </div>;
}

function planDateKey(date: Date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
function planDateFromKey(value: string) {
  const parts = value.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
function shiftPlanDate(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}
function mondayOfWeek(date: Date) {
  return shiftPlanDate(date, -((date.getDay() + 6) % 7));
}
function planDateLabel(date: Date, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long" }) {
  return date.toLocaleDateString("pt-BR", options);
}
function normalizePlanTopic(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function planSubjectFilter(plan: StudyPlan): "tae" | "fisica" | null {
  const area = normalizePlanTopic(plan.area);
  if (area.includes("fisica")) return "fisica";
  if (area.includes("tae") || area.includes("tecnico administrativo")) return "tae";
  return null;
}
function planDateIsActive(date: Date, config: ScheduleConfig) {
  const key = planDateKey(date);
  return (!config.startDate || key >= config.startDate) && (!config.examDate || key <= config.examDate);
}
function findNextPlanStudyDate(plan: StudyPlan, from = new Date()) {
  const config = plan.scheduleConfig;
  if (!config || !plan.assignments.length || plan.status === "completed") return null;
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const configuredStart = config.startDate ? planDateFromKey(config.startDate) : today;
  const start = configuredStart > today ? configuredStart : today;
  for (let offset = 0; offset <= 370; offset += 1) {
    const date = shiftPlanDate(start, offset);
    if (config.examDate && planDateKey(date) > config.examDate) break;
    if (!config.days.includes(date.getDay())) continue;
    const tasks = plan.assignments.filter(item => item.day === date.getDay());
    const key = planDateKey(date);
    const simulation = config.daySchedules?.[date.getDay()];
    const simulationPending = Boolean(simulation?.simulation && !(simulation.completedDates || []).includes(key));
    if (tasks.some(item => !(item.completedDates || []).includes(key)) || simulationPending) return date;
  }
  return null;
}

export function PlanDetailRoute() {
  const { id = "" } = useParams();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [questionBlocks, setQuestionBlocks] = useState<QuestionBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    Promise.all([getPlan(id), listConcepts(), listErrors(), listQuestionBlocks()])
      .then(([found, nextConcepts, nextErrors, nextQuestions]) => {
        if (!active) return;
        setPlan(found || null);
        setConcepts(nextConcepts);
        setErrors(nextErrors);
        setQuestionBlocks(nextQuestions);
      })
      .catch(() => { if (active) setLoadError("Não foi possível carregar os dados deste plano."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const today = new Date();
  const todayKey = planDateKey(today);
  const config = plan?.scheduleConfig || null;
  const selectedLeaves=useMemo(()=>plan?getSelectedLeaves(plan.tree):[],[plan]);
  const leafById=useMemo(()=>new Map(selectedLeaves.map(leaf=>[leaf.id,leaf])),[selectedLeaves]);
  const selectedAssignments=useMemo(()=>plan?reconcileAssignments(selectedLeaves,plan.assignments,config?.days||[]):[],[plan,selectedLeaves,config]);
  const toneFor=(item:PlanAssignment)=>{const leaf=leafById.get(item.nodeId);return leaf?topicTone(leaf,plan?.area):"neutral";};
  const areaFor=(item:PlanAssignment)=>{const leaf=leafById.get(item.nodeId);return leaf?areaDisplayName(topicPlacement(leaf,plan?.area).groups[0]||"Outros assuntos"):"Outros assuntos";};

  const weekEntries = useMemo(() => {
    if (!plan || !config) return [];
    const monday = mondayOfWeek(new Date());
    return WEEKDAYS.filter(day => config.days.includes(day.id)).map(day => {
      const date = shiftPlanDate(monday, day.id === 0 ? 6 : day.id - 1);
      const key = planDateKey(date);
      const items = selectedAssignments.filter(item => item.day === day.id);
      const completed = items.filter(item => (item.completedDates || []).includes(key)).length;
      const slot = config.daySchedules?.[day.id];
      const simulation = Boolean(slot?.simulation);
      const simulationDone = Boolean(simulation && (slot?.completedDates || []).includes(key));
      return { ...day, date, key, items, completed, slot, simulation, simulationDone, minutes: minutesForDay(config, day.id), active: planDateIsActive(date, config), isToday: key === todayKey };
    });
  }, [plan, config, todayKey, selectedAssignments]);

  const nextStudyDate = useMemo(() => plan ? findNextPlanStudyDate({...plan,assignments:selectedAssignments}) : null, [plan,selectedAssignments]);
  const nextStudyKey = nextStudyDate ? planDateKey(nextStudyDate) : "";
  const nextStudyItems = nextStudyDate && plan
    ? selectedAssignments.filter(item => item.day === nextStudyDate.getDay() && !(item.completedDates || []).includes(nextStudyKey))
    : [];
  const nextStudyMinutes = config && nextStudyDate ? minutesForDay(config, nextStudyDate.getDay()) : 0;
  const nextStudySlot = config && nextStudyDate ? config.daySchedules?.[nextStudyDate.getDay()] : undefined;
  const nextStudySimulation = Boolean(nextStudySlot?.simulation && !(nextStudySlot.completedDates || []).includes(nextStudyKey));
  const todayEntry = weekEntries.find(day => day.isToday);
  const todayFinished = Boolean(todayEntry && (todayEntry.items.length > 0 || todayEntry.simulation) &&
    todayEntry.completed === todayEntry.items.length && (!todayEntry.simulation || todayEntry.simulationDone));
  const weeklyPlanned = weekEntries.filter(day => day.active).reduce((sum, day) => sum + day.items.length, 0);
  const weeklyCompleted = weekEntries.filter(day => day.active).reduce((sum, day) => sum + day.completed, 0);
  const weeklyPercent = weeklyPlanned ? Math.round(weeklyCompleted / weeklyPlanned * 100) : 0;
  const firstUpcomingDayKey = weekEntries.find(day => day.active && day.key >= todayKey && (
    day.items.some(item => !(item.completedDates || []).includes(day.key)) || (day.simulation && !day.simulationDone)
  ))?.key || "";
  const unassignedCount = selectedAssignments.filter(item => !config?.days.includes(item.day)).length;

  const topicKeys = useMemo(() => new Set(selectedAssignments.map(item => normalizePlanTopic(displayNodeName(item.name)))), [selectedAssignments]);
  const subjectFilter = plan ? planSubjectFilter(plan) : null;
  const relevantConcepts = concepts.filter(item =>
    item.status === "published" && !item.suspended &&
    topicKeys.has(normalizePlanTopic(item.topic)) &&
    (!subjectFilter || item.subject === subjectFilter)
  );
  const dueConcepts = relevantConcepts.filter(item => item.fsrs.due <= Date.now());
  const relevantErrors = errors.filter(item =>
    item.status !== "dominado" &&
    topicKeys.has(normalizePlanTopic(item.topic)) &&
    (!subjectFilter || item.subject === subjectFilter)
  );
  const dueErrors = relevantErrors.filter(item => item.nextReview <= Date.now()).sort((a, b) => a.nextReview - b.nextReview);

  const performanceByTopic = new Map<string, { topic: string; subject: string; total: number; correct: number }>();
  questionBlocks.filter(item =>
    topicKeys.has(normalizePlanTopic(item.topic)) &&
    (!subjectFilter || item.subject === subjectFilter)
  ).forEach(block => {
    const key = block.subject + "|" + normalizePlanTopic(block.topic);
    const current = performanceByTopic.get(key) || { topic: block.topic, subject: block.subject, total: 0, correct: 0 };
    current.total += block.total;
    current.correct += block.correct;
    performanceByTopic.set(key, current);
  });
  const lowestPerformance = [...performanceByTopic.values()]
    .filter(item => item.total > 0)
    .map(item => ({ ...item, percent: Math.round(item.correct / item.total * 100) }))
    .sort((a, b) => a.percent - b.percent || b.total - a.total)
    .slice(0, 3);

  const coverageGroups = new Map<string, { total: number; studied: number; tone:string; column:string }>();
  selectedAssignments.forEach(item => {
    const leaf=leafById.get(item.nodeId);
    const column=leaf?topicPlacement(leaf,plan?.area).column:"general";
    const group=areaFor(item);
    const current = coverageGroups.get(group) || { total: 0, studied: 0,tone:toneFor(item),column };
    current.total += 1;
    if ((item.completedDates || []).length > 0) current.studied += 1;
    coverageGroups.set(group, current);
  });
  const coverageStudied = selectedAssignments.filter(item => (item.completedDates || []).length > 0).length;
  const coverageTotal = selectedAssignments.length;
  const coveragePercent = coverageTotal ? Math.round(coverageStudied / coverageTotal * 100) : 0;

  async function toggleSimulationCompletion(dayId: number, dateKey: string) {
    if (!plan || !plan.scheduleConfig || savingCompletion) return;
    setSavingCompletion(true);
    const current = plan.scheduleConfig.daySchedules?.[dayId] || { startTime: "", endTime: "", simulation: false };
    const dates = new Set(current.completedDates || []);
    if (dates.has(dateKey)) dates.delete(dateKey);
    else dates.add(dateKey);
    const scheduleConfig = {
      ...plan.scheduleConfig,
      daySchedules: {
        ...(plan.scheduleConfig.daySchedules || {}),
        [dayId]: { ...current, simulation: true, completedDates: [...dates].sort() },
      },
    };
    try {
      const saved = await savePlan({ ...plan, scheduleConfig });
      setPlan(saved);
    } catch {
      setLoadError("Não foi possível salvar a conclusão do simulado. Tente novamente.");
    } finally {
      setSavingCompletion(false);
    }
  }

  async function toggleStudyCompletion(nodeId: string, dateKey: string) {
    if (!plan || savingCompletion) return;
    setSavingCompletion(true);
    const assignments = plan.assignments.map(item => {
      if (item.nodeId !== nodeId) return item;
      const dates = new Set(item.completedDates || []);
      if (dates.has(dateKey)) dates.delete(dateKey);
      else dates.add(dateKey);
      return { ...item, completedDates: [...dates].sort() };
    });
    try {
      const saved = await savePlan({ ...plan, assignments });
      setPlan(saved);
    } catch {
      setLoadError("Não foi possível salvar a conclusão. Tente novamente.");
    } finally {
      setSavingCompletion(false);
    }
  }

  if (loading) return <div className="stack"><div className="loading-panel">Preparando seu painel de preparação…</div></div>;
  if (!plan) return <div className="stack"><div className="panel empty-state"><FolderOpen size={28}/><strong>{loadError || "Não encontrei este plano."}</strong><Link to="/plans" className="text-link">Voltar aos planos</Link></div></div>;

  const examDays = config?.examDate
    ? Math.ceil((planDateFromKey(config.examDate).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000)
    : null;
  const statusLabel = plan.status === "active" ? "Preparação em andamento" : plan.status === "completed" ? "Plano concluído" : "Plano em construção";
  const subjectMeta = [plan.institution, plan.position, plan.area, plan.organizer].filter(Boolean).join(" · ");
  const canStudy = Boolean(config && (
    selectedAssignments.some(item => config.days.includes(item.day)) ||
    config.days.some(day => config.daySchedules?.[day]?.simulation)
  ));

  return <div className="stack plan-detail-stack ritmo-plan-surface">
    <header className="heading plan-detail-header">
      <div>
        <small>RITMO / SUA PREPARAÇÃO</small>
        <div className="plan-detail-title-row"><h1>{plan.title}</h1><span className={"plan-status-pill " + plan.status}>{statusLabel}</span></div>
        <p>{subjectMeta}</p>
      </div>
      <div className="plan-detail-actions">
        <Link className="secondary-button" to="/plans"><ArrowLeft size={15}/>Meus planos</Link>
        <Link className="primary-button" to={"/plans/" + plan.id + "/verticalize"}><Pencil size={15}/>Editar percurso</Link>
      </div>
    </header>

    {!canStudy ? <section className="panel plan-build-state">
      <div className="plan-build-icon"><ListChecks size={25}/></div>
      <span className="step-kicker">PRÓXIMA ETAPA</span>
      <h2>Seu plano ainda precisa ganhar um cronograma.</h2>
      <p>Finalize a seleção dos conteúdos e defina seus dias de estudo. Depois disso, o Ritmo poderá acompanhar sua preparação de verdade.</p>
      <Link className="primary-button" to={"/plans/" + plan.id + "/verticalize"}>Continuar configuração <ArrowRight size={15}/></Link>
    </section> : <>
      <div className="plan-dashboard-grid">
        <section className="plan-next-session">
          <div className="plan-next-topline"><span><Target size={14}/> PRÓXIMO PASSO</span><span>{nextStudyDate ? (nextStudyKey === todayKey ? "HOJE" : "PRÓXIMA SESSÃO") : "CRONOGRAMA"}</span></div>
          {todayFinished && nextStudyDate && nextStudyKey !== todayKey && <div className="plan-today-success"><CheckCircle2 size={15}/> Você concluiu o que estava previsto para hoje. Bom trabalho!</div>}
          {nextStudyDate ? <>
            <div className="plan-next-date">{planDateLabel(nextStudyDate, { weekday: "long", day: "2-digit", month: "long" })}</div>
            <h2>{nextStudySimulation ? "Dia de simulado" : nextStudyKey === todayKey ? "Seu estudo de hoje" : "Sua próxima sessão"}</h2>
            <p className="plan-next-description">{nextStudySlot?.startTime && nextStudySlot?.endTime
              ? `Das ${nextStudySlot.startTime} às ${nextStudySlot.endTime} · ${formatDuration(nextStudyMinutes)}.`
              : nextStudyMinutes ? `${nextStudyMinutes} minutos reservados no seu cronograma.` : "O horário desta sessão ainda não foi definido."}</p>
            {nextStudySimulation && <div className="plan-week-simulation"><Target size={16}/><span>Dia reservado para simulado. Ao terminar, marque a realização na seção “Esta semana”.</span><Link to="/questions">Registrar resultado <ArrowRight size={12}/></Link></div>}
            <div className="plan-next-topic-list">
              {nextStudyItems.slice(0, 5).map(item => <div className="plan-next-topic" data-tone={toneFor(item)} key={item.nodeId} title={displayNodeName(item.name)}>
                <span className="plan-topic-bullet"/>
                <span><b>{pieceTitle(item.name)}</b><small>{areaFor(item)}</small></span>
              </div>)}
              {nextStudyItems.length > 5 && <span className="plan-more-topics">+ {nextStudyItems.length - 5} outros assuntos previstos nesta sessão</span>}
            </div>
            <div className="plan-next-actions">
              {nextStudySimulation ? <Link className="plan-light-button" to="/questions"><Target size={15}/>Registrar simulado</Link> : <Link className="plan-light-button" to="/learn"><BookOpen size={15}/>Abrir Aprender</Link>}
              <Link className="plan-hero-link" to="/agenda">Ver agenda <ArrowRight size={14}/></Link>
            </div>
          </> : <div className="plan-no-next"><CalendarDays size={28}/><h2>Não há sessões futuras no cronograma.</h2><p>Confira as datas da preparação e a distribuição dos assuntos.</p><Link className="plan-light-button" to={"/plans/" + plan.id + "/verticalize"}>Revisar cronograma</Link></div>}
        </section>

        <aside className="panel plan-deadline-card">
          <div className="plan-deadline-icon"><CalendarDays size={19}/></div>
          <span className="step-kicker">DATA DA PROVA</span>
          {examDays === null ? <>
            <strong className="plan-deadline-title">Ainda não definida</strong>
            <p>Adicionar a data ajuda a visualizar sua reta final e ajustar o cronograma.</p>
            <Link className="text-link" to={"/plans/" + plan.id + "/verticalize"}>Definir data <ArrowRight size={13}/></Link>
          </> : <>
            <strong className="plan-deadline-number">{examDays < 0 ? "Data passada" : examDays === 0 ? "É hoje!" : String(examDays)}</strong>
            <span className="plan-deadline-caption">{examDays < 0 ? "Confira se o plano ainda precisa de atualização." : examDays === 0 ? "Dia da avaliação" : "dias até a avaliação"}</span>
            <p>{planDateLabel(planDateFromKey(config?.examDate || ""), { day: "2-digit", month: "long", year: "numeric" })}</p>
            <Link className="text-link" to={"/plans/" + plan.id + "/verticalize"}>Ajustar cronograma <ArrowRight size={13}/></Link>
          </>}
          {plan.organizer && <div className="plan-deadline-banca"><span>BANCA</span><b>{plan.organizer}</b></div>}
        </aside>
      </div>

      <section className="panel plan-week-progress">
        <div className="plan-section-heading">
          <div><span className="step-kicker">ACOMPANHAMENTO REAL</span><h2>Como está sua semana?</h2><p>Sessões registradas nesta semana.</p></div>
          <strong className="plan-week-ratio">{weeklyCompleted}<small> / {weeklyPlanned}</small></strong>
        </div>
        <div className="plan-progress-track"><span style={{ width: weeklyPercent + "%" }}/></div>
        <div className="plan-progress-foot"><span>{weeklyPercent}% do cronograma semanal concluído</span><span>{weeklyPlanned - weeklyCompleted} assunto(s) ainda previsto(s)</span></div>
        <div className="plan-week-strip">
          {WEEKDAYS.map(day=>{const entry=weekEntries.find(item=>item.id===day.id);return <div className={"plan-week-chip "+(entry?.isToday?"today ":"")+(!entry?.active?"inactive":"")} key={day.id}><span>{day.short}</span><b>{!entry?.active?"—":entry.simulation?(entry.simulationDone?"OK":"SIM"):entry.items.length?entry.completed+"/"+entry.items.length:"—"}</b></div>;})}
        </div>
      </section>

      {unassignedCount > 0 && <div className="plan-unassigned-notice"><Info size={17}/><span><b>{unassignedCount} conteúdo(s) ainda sem dia.</b> Eles continuam no seu plano, mas não entram nas sessões até você organizá-los.</span><Link to={"/plans/" + plan.id + "/verticalize"}>Organizar <ArrowRight size={12}/></Link></div>}

      <div className="plan-detail-columns">
        <section className="panel plan-weekly-panel">
          <div className="plan-section-heading compact">
            <div><span className="step-kicker">SEU CRONOGRAMA</span><h2>Esta semana</h2><p>Abra um dia para marcar o que já estudou.</p></div>
            <Link className="text-link" to="/agenda">Calendário <ArrowRight size={13}/></Link>
          </div>
          <div className="plan-week-list">
            {weekEntries.map(day => <details className={"plan-week-day " + (day.isToday ? "is-today" : "")} key={day.id} open={day.key === (firstUpcomingDayKey || todayKey)}>
              <summary><span className="plan-week-day-name">{day.label}{day.isToday && <em>Hoje</em>}</span><span className="plan-week-day-count">{day.simulation ? `${day.simulationDone ? "Simulado realizado" : "Dia de simulado"}${day.items.length ? ` · ${day.completed}/${day.items.length} estudados` : ""}` : `${day.completed}/${day.items.length} estudados`}</span><ChevronDown size={15}/></summary>
              {(day.slot?.startTime || day.slot?.endTime) && <p className="plan-week-day-time">{day.slot?.startTime || "--:--"} às {day.slot?.endTime || "--:--"} · {formatDuration(day.minutes)}</p>}
              {day.simulation && <div className="plan-week-simulation"><Target size={16}/><span>Dia reservado para simulado.</span><label><input type="checkbox" checked={day.simulationDone} disabled={savingCompletion || !day.active} onChange={() => toggleSimulationCompletion(day.id, day.key)}/>{day.simulationDone ? "Realizado" : "Marcar como realizado"}</label><Link to="/questions">Registrar resultado <ArrowRight size={12}/></Link></div>}
              {day.items.length ? <div className="plan-week-topic-list">
                {day.items.map(item => {
                  const done = (item.completedDates || []).includes(day.key);
                  return <label className={"plan-week-topic " + (done ? "is-done" : "")} data-tone={toneFor(item)} title={displayNodeName(item.name)} key={item.nodeId}>
                    <input type="checkbox" checked={done} disabled={savingCompletion || !day.active} onChange={() => toggleStudyCompletion(item.nodeId, day.key)}/>
                    <span><b>{pieceTitle(item.name)}</b><small>{areaFor(item)}</small></span>
                    <em>{done ? "Estudado" : day.active ? "Marcar como estudado" : "Fora do período"}</em>
                  </label>;
                })}
              </div> : !day.simulation ? <p className="plan-week-empty">Nenhum assunto distribuído para este dia.</p> : null}
            </details>)}
          </div>
        </section>

        <section className="panel plan-attention-panel">
          <div className="plan-section-heading compact">
            <div><span className="step-kicker">SINAIS DE ATENÇÃO</span><h2>Onde vale retomar?</h2><p>Revisões e desempenho nos assuntos deste plano.</p></div>
            <AlertCircle size={20}/>
          </div>
          <div className="plan-attention-stats">
            <div className="plan-attention-stat"><span>Flashcards vencidos</span><strong>{dueConcepts.length}</strong><Link to="/reviews">Revisar <ArrowRight size={12}/></Link></div>
            <div className="plan-attention-stat"><span>Erros vencidos</span><strong>{dueErrors.length}</strong><Link to="/errors">Abrir caderno <ArrowRight size={12}/></Link></div>
          </div>
          {lowestPerformance.length ? <div className="plan-performance">
            <div className="plan-performance-title"><TrendingUp size={15}/> Menor aproveitamento em questões</div>
            {lowestPerformance.map(item => <div className="plan-performance-row" key={item.topic}>
              <div><b>{item.topic}</b><small>{item.subject === "tae" ? "TAE" : "Física"} · {item.correct} de {item.total} acertos</small></div>
              <div className="plan-performance-track"><span style={{ width: item.percent + "%" }}/></div>
              <strong>{item.percent}%</strong>
            </div>)}
            <Link className="text-link" to="/questions">Ver desempenho em questões <ArrowRight size={13}/></Link>
          </div> : <div className="plan-attention-empty">
            <Lightbulb size={19}/><p>Ainda não há blocos de questões registrados para os assuntos deste plano. Registre suas tentativas para descobrir onde concentrar a revisão.</p>
            <Link to="/questions">Registrar questões <ArrowRight size={12}/></Link>
          </div>}
          {dueErrors.length > 0 && <div className="plan-due-error-list">
            <b>Erros vencidos</b>
            {dueErrors.slice(0, 3).map(item => <div key={item.id}><span>{item.topic}</span><small>{item.discipline} · {planDateLabel(new Date(item.nextReview))}</small></div>)}
          </div>}
        </section>
      </div>

      <section className="panel plan-coverage-panel">
        <div className="plan-section-heading">
          <div><span className="step-kicker">VISÃO DO EDITAL</span><h2>Conteúdos que você já trabalhou</h2><p>Assuntos estudados por área, sem estimar domínio.</p></div>
          <strong className="plan-coverage-total">{coverageStudied}<small> / {coverageTotal}</small></strong>
        </div>
        <div className="plan-coverage-overall"><span style={{ width: coveragePercent + "%" }}/></div>
        <div className="plan-coverage-grid">
          {[...coverageGroups.entries()].map(([name, value]) => {
            const percent = value.total ? Math.round(value.studied / value.total * 100) : 0;
            return <div className="plan-coverage-item" data-tone={value.tone} key={name}>
              <div><b>{name}</b><small>{value.column==="specific"?"Específicos":"Gerais"} · {value.studied}/{value.total}</small></div>
              <div className="plan-coverage-track"><span style={{ width: percent + "%" }}/></div>
            </div>;
          })}
        </div>
      </section>
    </>}

    <section className="plan-quick-actions">
      <Link to="/learn"><BookOpen size={17}/><span><b>Aprender</b><small>Estudar seus materiais</small></span><ArrowRight size={15}/></Link>
      <Link to="/reviews"><Clock3 size={17}/><span><b>Revisões</b><small>Retomar o que está vencido</small></span><ArrowRight size={15}/></Link>
      <Link to="/questions"><NotebookPen size={17}/><span><b>Questões</b><small>Medir seu aproveitamento</small></span><ArrowRight size={15}/></Link>
      <Link to="/errors"><Flame size={17}/><span><b>Caderno de erros</b><small>Trabalhar suas dificuldades</small></span><ArrowRight size={15}/></Link>
    </section>
    {loadError && <p className="plan-detail-error" role="alert">{loadError}</p>}
    <p className="plan-detail-note">O Ritmo acompanha o que você registra. Ele não prevê aprovação nem transforma tempo de estudo em domínio automático.</p>
  </div>;
}
