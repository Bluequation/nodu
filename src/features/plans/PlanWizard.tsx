import { useEffect, useMemo, useState, type ChangeEvent, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, AlertCircle, BookOpen, CalendarDays, Check, CheckCircle2, Clipboard,
  ChevronDown, ChevronRight, Clock3, Flame, FolderOpen, Info, Lightbulb, ListChecks,
  NotebookPen, Pencil, Plus, Sparkles, Target, TrendingUp, Upload, GripVertical, LoaderCircle,
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

const WEEKDAYS = [
  { id: 1, label: "Segunda", short: "Seg" },
  { id: 2, label: "Terça", short: "Ter" },
  { id: 3, label: "Quarta", short: "Qua" },
  { id: 4, label: "Quinta", short: "Qui" },
  { id: 5, label: "Sexta", short: "Sex" },
  { id: 6, label: "Sábado", short: "Sáb" },
  { id: 0, label: "Domingo", short: "Dom" },
];
const MINUTES = [30, 45, 60, 90, 120, 150, 180, 240];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function displayNodeName(name: string) {
  return name.replace(/^\s*\[EDITAL\]\s*/i, "").trim();
}
function durationFromTimes(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end < start) end += 24 * 60;
  return end - start;
}
function minutesForDay(config: ScheduleConfig, dayId: number) {
  const slot = config.daySchedules?.[dayId];
  if (slot) return durationFromTimes(slot.startTime, slot.endTime);
  if (config.daySchedules) return 0;
  return config.sameMinutes === false ? (config.dayMinutes?.[dayId] ?? config.minutes) : config.minutes;
}
function formatDuration(minutes: number) {
  if (!minutes) return "Horário ainda não definido";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h ${remainder}min disponíveis`;
  if (hours) return `${hours}h disponíveis`;
  return `${remainder}min disponíveis`;
}
function emptyDaySchedule(): DaySchedule {
  return { startTime: "", endTime: "", simulation: false };
}
function assignmentFromLeaf(leaf: SelectedPlanLeaf, day = -1): PlanAssignment {
  return {
    nodeId: leaf.id,
    name: displayNodeName(leaf.name),
    path: leaf.path.map(displayNodeName),
    origin: leaf.origin,
    sourceRef: leaf.sourceRef,
    day,
  };
}
function reconcileAssignments(leaves: SelectedPlanLeaf[], existing: PlanAssignment[], days: number[]) {
  const byId = new Map(existing.map(item => [item.nodeId, item]));
  return leaves.map(leaf => {
    const current = byId.get(leaf.id);
    if (!current) return assignmentFromLeaf(leaf, -1);
    return { ...assignmentFromLeaf(leaf, current.day), ...current,
      day: current.day >= 0 && days.includes(current.day) ? current.day : -1 };
  });
}
const defaultSchedule = (plan: StudyPlan): ScheduleConfig => ({
  startDate: today(),
  examDate: plan.examDate || "",
  days: [],
  minutes: 0,
  sameMinutes: false,
  dayMinutes: {},
  daySchedules: {},
  priorityOrder: [],
  mode: "alternate",
});

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

function Stepper({ stage }: { stage: PlanStage }) {
  const current = stage === "source" ? 1 : stage === "selection" ? 2 : 3;
  return <div className="wizard-stepper" aria-label="Etapas do plano">
    {["Edital", "Seleção", "Cronograma"].map((label, index) => (
      <div className={index + 1 <= current ? "wizard-step is-current" : "wizard-step"} key={label}>
        <span>{index + 1 < current ? <Check size={14}/> : index + 1}</span>{label}
      </div>
    ))}
  </div>;
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

function distribute(plan: StudyPlan, config: ScheduleConfig) {
  const leaves = getSelectedLeaves(plan.tree);
  const days = WEEKDAYS
    .filter(day => config.days.includes(day.id) && !config.daySchedules?.[day.id]?.simulation)
    .map(day => day.id);
  if (!leaves.length || !days.length || days.some(day => minutesForDay(config, day) <= 0)) return [];
  const byId = new Map(leaves.map(leaf => [leaf.id, leaf]));
  const ranked = config.mode === "priority"
    ? (config.priorityOrder || []).map(id => byId.get(id)).filter((leaf): leaf is (typeof leaves)[number] => Boolean(leaf))
    : [];
  const ordered = config.mode === "priority"
    ? [...ranked, ...leaves.filter(leaf => !ranked.some(item => item.id === leaf.id))]
    : leaves;
  const capacity = new Map(days.map(day => [day, minutesForDay(config, day)]));
  const load = new Map(days.map(day => [day, 0]));
  const assigned = new Map<string, number>();
  if (config.mode === "sequence") {
    let offset = 0;
    days.forEach((day, index) => {
      const remainingTopics = ordered.length - offset;
      if (remainingTopics <= 0) return;
      const remainingCapacity = days.slice(index).reduce((sum, item) => sum + (capacity.get(item) || 1), 0);
      const count = index === days.length - 1 ? remainingTopics : Math.min(remainingTopics, Math.max(1, Math.round(remainingTopics * (capacity.get(day) || 1) / remainingCapacity)));
      ordered.slice(offset, offset + count).forEach(leaf => assigned.set(leaf.id, day));
      offset += count;
    });
  } else {
    ordered.forEach(leaf => {
      const day = days.reduce((best, candidate) => {
        const candidateRatio = (load.get(candidate) || 0) / (capacity.get(candidate) || 1);
        const bestRatio = (load.get(best) || 0) / (capacity.get(best) || 1);
        return candidateRatio < bestRatio ? candidate : best;
      }, days[0]);
      assigned.set(leaf.id, day);
      load.set(day, (load.get(day) || 0) + 1);
    });
  }
  return ordered.map(leaf => assignmentFromLeaf(leaf, assigned.get(leaf.id) ?? 0));
}

function buildPriorityPrompt(plan: StudyPlan, leaves: SelectedPlanLeaf[]) {
  const topics = leaves.map(leaf => `ID: ${leaf.id}\nTÍTULO LITERAL: ${displayNodeName(leaf.name)}\nREFERÊNCIA: ${leaf.sourceRef || "não informada"}`).join("\n\n");
  return [
    "Analise a prioridade de estudo dos tópicos abaixo para um concurso.",
    `Banca organizadora: ${plan.organizer || "não informada"}.`,
    `Cargo/área: ${plan.position} · ${plan.area || "não informada"}.`,
    "Ordene somente os tópicos já selecionados, considerando recorrência verificável em provas anteriores da banca e relevância no edital.",
    "Não acrescente, remova, renomeie ou divida tópicos. Não invente percentuais nem frequência. Diferencie evidência documentada de estimativa. Se não houver dados suficientes, declare isso claramente.",
    "Responda com TODOS os IDs abaixo, cada um exatamente uma vez e em uma linha própria, na ordem de prioridade. Depois, acrescente evidências com anos/fontes verificáveis quando disponíveis. O Ritmo importará apenas a ordem dos IDs.",
    "",
    topics,
  ].join("\n");
}

function parsePriorityOrder(response: string, leaves: SelectedPlanLeaf[]) {
  const found: string[] = [];
  response.split(/\r?\n/).forEach(line => {
    const match = leaves.find(leaf => line.includes(leaf.id));
    if (match && !found.includes(match.id)) found.push(match.id);
  });
  return found;
}

function SourceStep({ plan, onSave }: { plan: StudyPlan; onSave: (next: StudyPlan) => Promise<void> }) {
  const [sourceText, setSourceText] = useState(plan.sourceText);
  const [sourceFile, setSourceFile] = useState(plan.sourceFile);
  const [structureText, setStructureText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [savingSource, setSavingSource] = useState(false);
  const [savedSource, setSavedSource] = useState(false);
  useEffect(() => { setSourceText(plan.sourceText); setSourceFile(plan.sourceFile); }, [plan.id, plan.sourceText, plan.sourceFile]);

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

  return <div className="wizard-content">
    <section className="panel wizard-panel">
      <div className="panel-title-row"><div><span className="step-kicker">ETAPA 1 · EDITAL</span><h2>Prepare o conteúdo do concurso</h2><p>O Ritmo organiza o material, mas você confere e decide o que entra no plano.</p></div><span className="soft-tag">Seu recorte</span></div>
      <div className="plan-context-grid">
        <div><small>Concurso</small><strong>{plan.title}</strong></div>
        <div><small>Instituição</small><strong>{plan.institution || "Não informada"}</strong></div>
        <div><small>Cargo</small><strong>{plan.position}</strong></div>
        <div><small>Área de estudo</small><strong>{plan.area || "Não definida"}</strong></div>
      </div>
      <div className="field-block">
        <label htmlFor="source-file">Arquivo do edital (PDF, TXT ou MD)</label>
        <div className="file-picker"><Upload size={18}/><span>{sourceFile || "Escolha um arquivo do seu dispositivo"}</span><label className="secondary-button" htmlFor="source-file">Procurar</label><input id="source-file" type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={handleFile}/></div>
        <small>PDF textual: o Ritmo extrai o texto no navegador. PDF escaneado pode exigir OCR. O arquivo não é enviado a um servidor.</small>
      </div>
      <div className="field-block">
        <label htmlFor="source-text">Conteúdo programático do cargo/área</label>
        <textarea id="source-text" rows={9} maxLength={180000} value={sourceText} onChange={event => { setSourceText(event.target.value); setSavedSource(false); setMessage("Alterações não salvas."); }} placeholder="Cole aqui somente o conteúdo programático pertinente ao cargo e à área escolhidos."/>
        <small>Evite inserir dados pessoais. Se o edital tiver várias áreas, mantenha aqui apenas o recorte que pertence a este plano.</small>
      </div>
      <div className="button-row">
        <button className={`secondary-button source-save-button ${savingSource ? "is-saving" : savedSource ? "is-saved" : ""}`} type="button" onClick={saveSource} disabled={savingSource || busy}>
          {savingSource ? <><LoaderCircle size={15} className="save-spinner"/> Salvando dados...</> : savedSource ? <><CheckCircle2 size={15} className="save-success-icon"/> Dados salvos</> : <><Check size={15}/> Salvar dados do edital</>}
        </button>
      </div>
    </section>

    {sourceText.trim().length > 0 && <section className="panel wizard-panel">
      <div className="panel-title-row"><div><span className="step-kicker">ASSISTÊNCIA OPCIONAL</span><h2><Sparkles size={20}/> Verticalize com IA</h2><p>Use o ChatGPT ou outra IA de sua preferência. O Ritmo não precisa de chave de API para este fluxo.</p></div><span className="soft-tag">Sem API conectada</span></div>
      <div className="ai-instructions">
        <div className="ai-instruction-heading"><Info size={17}/> Como funciona</div>
        <ol>
          <li>Salve os dados do edital.</li>
          <li>Copie a solicitação preparada com o cargo e a área selecionados.</li>
          <li>Envie a solicitação junto com o conteúdo para a IA.</li>
          <li>Copie a resposta em Markdown e cole no campo abaixo.</li>
        </ol>
        <button className="primary-button" type="button" onClick={copyPrompt}><Clipboard size={16}/> Copiar solicitação para IA</button>
      </div>
      <div className="field-block">
        <label htmlFor="structure-text">Estrutura verticalizada recebida da IA</label>
        <textarea id="structure-text" rows={10} value={structureText} onChange={event => setStructureText(event.target.value)} placeholder={"# [EDITAL] Conhecimentos específicos\n## [EDITAL] Física\n### [EDITAL] Mecânica\n> Referência: p. 14, item 1\n> Trecho literal: Mecânica"}/>
        <small>O formato é Markdown legível, não JSON. A IA deve retornar somente o que estiver expresso no edital, sem criar subassuntos ou conteúdos extras.</small>
      </div>
      <div className="button-row">
        <button className="primary-button" type="button" disabled={!structureText.trim()} onClick={importStructure}>Importar estrutura e selecionar <ArrowRight size={16}/></button>
        <button className="secondary-button" type="button" onClick={() => setStructureText("# [EDITAL] Conhecimentos gerais\n## [EDITAL] Disciplina\n### [EDITAL] Assunto") }>Usar modelo manual</button>
        <button className="text-button" type="button" onClick={() => saveBlob("modelo-verticalizacao-ritmo.md", "# [EDITAL] Disciplina\n## [EDITAL] Área ou eixo\n### [EDITAL] Assunto literal\n> Referência: página ou item, se disponível\n> Trecho literal: transcrição fiel, quando necessária\n") }>Baixar modelo</button>
      </div>
      <div className="note-strip">A IA apenas organiza o que está no edital. Não deve acrescentar assuntos, exemplos, pré-requisitos ou subtemas. O que não estiver no documento só pode entrar se você adicionar manualmente.</div>
    </section>}
    {message && <p className={`inline-feedback source-save-feedback ${savedSource ? "is-saved" : ""}`} role="status">{busy ? "Lendo arquivo…" : message}</p>}
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
  const progress = review ? 100 : Math.round(((index + 1) / Math.max(1, sections.length)) * 100);

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

  return <div className="wizard-content">
    <section className="panel selection-progress">
      <div className="panel-title-row"><div><span className="step-kicker">ETAPA 2 · SELEÇÃO DO CONTEÚDO</span><h2>{review ? "Revise suas escolhas" : "Vamos por partes"}</h2><p>Avance no seu ritmo. Suas escolhas ficam salvas automaticamente neste navegador.</p></div><span className="soft-tag">{review ? "Revisão final" : `Seção ${index + 1} de ${sections.length}`}</span></div>
      <div className="progress-track"><span style={{ width: `${progress}%` }}/></div>
      <div className="progress-caption"><span><Check size={14}/> Salvamento automático</span><strong>{leaves.length} conteúdo(s) selecionado(s)</strong></div>
    </section>

    {!review && current && <section className="panel selection-panel">
      <div className="selection-heading">
        <span className="step-kicker">SEÇÃO {index + 1}</span>
        {current.path.length > 0 && <p className="selection-breadcrumb">{current.path.map(displayNodeName).join(" / ")}</p>}
        <h2>{displayNodeName(current.node.name)}</h2>
        <p>Abra os grupos para visualizar os subitens. Marcar um grupo seleciona seus conteúdos; você também pode escolher itens individualmente.</p>
      </div>
      <div className="selection-toolbar">
        <span>{getSelectedLeaves([current.node]).length} selecionado(s) nesta seção</span>
        <div className="button-row">
          <button className="secondary-button compact" type="button" onClick={() => updateTree(toggleNodeInTree(plan.tree, current.node.id, true, false))}>Selecionar itens da seção</button>
          <button className="secondary-button compact" type="button" onClick={() => updateTree(toggleNodeInTree(plan.tree, current.node.id, false, true))}>Limpar seção</button>
          <button className="text-button" type="button" onClick={() => setShowManual(value => !value)}><Pencil size={13}/>Adicionar conteúdo</button>
        </div>
      </div>
      {showManual && <form className="manual-add-row" onSubmit={event => { event.preventDefault(); if (!manualName.trim()) return; updateTree(addManualChildToTree(plan.tree, current.node.id, manualName)); setManualName(""); setShowManual(false); }}><input aria-label="Novo conteúdo manual" value={manualName} onChange={event => setManualName(event.target.value)} placeholder="Digite o assunto ou subassunto"/><button className="secondary-button compact" type="submit" disabled={!manualName.trim()}><Plus size={14}/>Adicionar</button></form>}
      <div className="selection-content">
        <div className="selection-list-heading"><strong>Conteúdos identificados no edital</strong><small>Abra os grupos para consultar os subitens sem alongar a lista inteira.</small></div>
        <SelectionNode node={current.node} depth={0} onToggle={(id, checked) => updateTree(toggleNodeInTree(plan.tree, id, checked))} onRename={(id, name) => updateTree(renameNodeInTree(plan.tree, id, name))}/>
      </div>
      <div className="selection-scope-note"><Info size={16}/><span>O Ritmo não acrescenta assuntos automaticamente. O plano mantém os itens do edital; conteúdos extras só entram se você os adicionar manualmente.</span></div>
      <div className="wizard-navigation">
        <button className="secondary-button" type="button" onClick={() => index === 0 ? onSave({ ...plan, stage: "source" }) : moveTo(index - 1)}><ArrowLeft size={16}/>{index === 0 ? "Voltar ao edital" : "Seção anterior"}</button>
        <button className="primary-button" type="button" onClick={() => moveTo(index + 1)}>{index === sections.length - 1 ? "Salvar e revisar seleção" : "Salvar e avançar"}<ArrowRight size={16}/></button>
      </div>
    </section>}

    {review && <section className="panel selection-panel">
      <div className="selection-heading"><span className="step-kicker">ÚLTIMA ETAPA DA SELEÇÃO</span><h2>Confira o que vai entrar no seu plano</h2><p>O cronograma será montado com os itens selecionados. Conteúdos adicionados manualmente ficam identificados à parte.</p></div>
      <div className="selection-summary-grid">
        <div><strong>{officialCount}</strong><span>Itens do edital</span></div>
        {manualCount > 0 && <div><strong>{manualCount}</strong><span>Adicionados por você</span></div>}
        {suggestedCount > 0 && <div><strong>{suggestedCount}</strong><span>Complementos antigos</span></div>}
        <div><strong>{leaves.length}</strong><span>Total selecionado</span></div>
      </div>
      <div className="review-sections">
        {sections.map(section => {
          const selected = getSelectedLeaves([section.node]);
          if (!selected.length) return null;
          return <details className="review-section" key={section.node.id}>
            <summary><span>{displayNodeName(section.node.name)}</span><strong>{selected.length} item(ns)</strong></summary>
            <ul>{selected.map(leaf => <li key={leaf.id}><span className={`origin-pill ${leaf.origin}`}>{leaf.origin === "suggested" ? "Sugerido" : leaf.origin === "manual" ? "Manual" : "Edital"}</span>{displayNodeName(leaf.name)}</li>)}</ul>
          </details>;
        })}
      </div>
      {plan.warnings.length > 0 && <div className="note-strip warning-strip"><strong>Observações da análise</strong>{plan.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
      <div className="wizard-navigation">
        <button className="secondary-button" type="button" onClick={() => moveTo(Math.max(0, sections.length - 1))}><ArrowLeft size={16}/>Voltar à última seção</button>
        <button className="primary-button" type="button" disabled={!leaves.length} onClick={finishSelection}>Concluir seleção e montar cronograma<ArrowRight size={16}/></button>
      </div>
      {!leaves.length && <p className="inline-feedback">Selecione pelo menos um conteúdo para continuar.</p>}
    </section>}
  </div>;
}

// Compact display labels only; the original titles remain in the plan.
function plannerShortTitle(value:string) {
  let name=displayNodeName(value).replace(/^\d+(?:\.\d+)*\.?\s*/,"").replace(/\s+/g," ").trim();
  const rules: Array<[RegExp,string]> = [
    [/lei\s+federal\s+n[º°o.]?\s*9[.\s]?394\s*\/\s*96/i,"LDB — Lei 9.394/96"],
    [/lei\s+federal\s+n[º°o.]?\s*10[.\s]?639\s*\/\s*2003/i,"Lei 10.639/2003 — Cultura afro-brasileira e africana"],
    [/lei\s+federal\s+n[º°o.]?\s*11[.\s]?645\s*\/\s*2008/i,"Lei 11.645/2008 — Cultura afro-brasileira e indígena"],
    [/^as bases empíricas, metodológicas e epistemológicas das diversas teorias de aprendizagem/i,"Fundamentos das teorias de aprendizagem"],
    [/^a didática como fundamento epistemológico do fazer docente/i,"Didática e prática docente"],
    [/^fundamentos e princípios que orientam a BNCC/i,"Fundamentos e princípios da BNCC"],
  ];
  for(const [pattern,label] of rules) if(pattern.test(name))return label;
  name=name.replace(/^(?:noções gerais de|noções de|aspectos gerais de)\s+/i,"").replace(/\.$/,"");
  if(name.length<=68)return name||displayNodeName(value);
  const clause=name.split(/[:;] /)[0];
  if(clause.length>=20&&clause.length<=62)return clause+"…";
  const limit=name.lastIndexOf(" ",65);
  return name.slice(0,limit>35?limit:65).trimEnd()+"…";
}
function ScheduleStep({ plan, onSave }: { plan: StudyPlan; onSave: (next: StudyPlan) => Promise<void> }) {
  const leaves = getSelectedLeaves(plan.tree);
  const [config, setConfig] = useState<ScheduleConfig>(plan.scheduleConfig || defaultSchedule(plan));
  const [assignments, setAssignments] = useState<PlanAssignment[]>(() => reconcileAssignments(leaves, plan.assignments, (plan.scheduleConfig || defaultSchedule(plan)).days));
  const [priorityText, setPriorityText] = useState("");
  const [priorityFeedback, setPriorityFeedback] = useState("");
  const [scheduleFeedback, setScheduleFeedback] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDay, setBulkDay] = useState<number>((plan.scheduleConfig?.days || [])[0] ?? 1);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [point, setPoint] = useState({x:0,y:0});
  const drag = useRef<{id:string; pointer:number; x:number; y:number; moving:boolean} | null>(null);
  const [openDay, setOpenDay] = useState<number>(WEEKDAYS[0].id);
  const [block, setBlock] = useState("all");
  const [discipline, setDiscipline] = useState("all");
  const [dayFilter, setDayFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [original, setOriginal] = useState<string | null>(null);
  const [moveFeedback, setMoveFeedback] = useState("");
  const [undo, setUndo] = useState<{ assignments: PlanAssignment[]; config: ScheduleConfig } | null>(null);

  useEffect(() => {
    const nextConfig = plan.scheduleConfig || defaultSchedule(plan);
    setConfig(nextConfig);
    setAssignments(reconcileAssignments(getSelectedLeaves(plan.tree), plan.assignments, nextConfig.days));
    setSelectedIds([]);
    setBulkDay(nextConfig.days[0] ?? 1);
    setOpenDay(WEEKDAYS.find(day=>nextConfig.days.includes(day.id))?.id ?? 1); setDayFilter("all"); setBlock("all"); setDiscipline("all"); setSearch("");
  }, [plan.id]);

  function persist(nextAssignments: PlanAssignment[], nextConfig = config) {
    setAssignments(nextAssignments);
    void onSave({ ...plan, scheduleConfig: nextConfig, assignments: nextAssignments, updatedAt: Date.now() });
  }
  function changeConfig(patch: Partial<ScheduleConfig>) {
    const next = { ...config, ...patch };
    setConfig(next); setUndo(null);
    void onSave({ ...plan, scheduleConfig: next, assignments, updatedAt: Date.now() });
  }
  function changeDays(selectedDays: number[]) {
    const days = WEEKDAYS.filter(day => selectedDays.includes(day.id)).map(day => day.id);
    const daySchedules = { ...(config.daySchedules || {}) };
    days.forEach(day => { if (!daySchedules[day]) daySchedules[day] = emptyDaySchedule(); });
    const nextConfig = { ...config, days, daySchedules };
    const nextAssignments = assignments.map(item => item.day >= 0 && !days.includes(item.day) ? { ...item, day: -1 } : item);
    setConfig(nextConfig);
    setAssignments(nextAssignments);
    setSelectedIds([]); setUndo(null);
    if (dayFilter !== "all" && dayFilter !== "-1" && !days.includes(Number(dayFilter))) setDayFilter("all");
    setBulkDay(current => days.includes(current) ? current : (days[0] ?? 1));
    void onSave({ ...plan, scheduleConfig: nextConfig, assignments: nextAssignments, updatedAt: Date.now() });
  }
  function setDaySchedule(dayId: number, patch: Partial<DaySchedule>) {
    const current = config.daySchedules?.[dayId] || emptyDaySchedule();
    changeConfig({ daySchedules: { ...(config.daySchedules || {}), [dayId]: { ...current, ...patch } } });
  }
  function moveTopics(ids: string[], dayId: number) {
    if (dayId !== -1 && !WEEKDAYS.some(day=>day.id===dayId)) return;
    const keys = new Set(ids);
    const next = assignments.map(item => keys.has(item.nodeId) ? {...item, day:dayId} : item);
    const count=next.filter((item,i)=>item.day!==assignments[i].day).length;
    if(!count)return;
    const nextConfig=dayId>=0&&!config.days.includes(dayId)?{...config,
      days:WEEKDAYS.filter(day=>config.days.includes(day.id)||day.id===dayId).map(day=>day.id),
      daySchedules:{...(config.daySchedules||{}),[dayId]:config.daySchedules?.[dayId]||emptyDaySchedule()},
    }:config;
    setUndo({assignments,config});
    setConfig(nextConfig); persist(next,nextConfig);
    if(dayId>=0)setOpenDay(dayId);
    setSelectedIds(current=>current.filter(id=>!keys.has(id)));
    setMoveFeedback(`${count} ${count===1?"conteúdo movido":"conteúdos movidos"} → ${dayId===-1?"Sem dia":WEEKDAYS.find(d=>d.id===dayId)?.label}`);
    setScheduleFeedback("");
  }
  function toggleAssignment(id: string, checked: boolean) {
    setSelectedIds(current => checked ? [...new Set([...current,id])] : current.filter(item => item !== id));
  }
  function moveSelected() { moveTopics(selectedIds, bulkDay); }
  function dropTarget(x:number,y:number) {
    const el = document.elementFromPoint(x,y)?.closest<HTMLElement>("[data-planner-drop]");
    if (!el) return null;
    const day = Number(el.dataset.plannerDrop);
    return day === -1 || WEEKDAYS.some(item=>item.id===day) ? day : null;
  }
  function pointerDown(event: ReactPointerEvent<HTMLElement>, id:string) {
    if (!event.isPrimary || event.button !== 0 || drag.current) return;
    drag.current = {id,pointer:event.pointerId,x:event.clientX,y:event.clientY,moving:false};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.pointer !== event.pointerId) return;
    if (!d.moving && Math.hypot(event.clientX-d.x,event.clientY-d.y)<6) return;
    d.moving=true; setDraggedId(d.id); setPoint({x:event.clientX,y:event.clientY});
    setDragOverDay(dropTarget(event.clientX,event.clientY));
  }
  function pointerEnd(event: ReactPointerEvent<HTMLElement>, cancel=false) {
    const d=drag.current;
    if (!d || d.pointer !== event.pointerId) return;
    drag.current=null;
    if (!cancel && d.moving) {
      const day=dropTarget(event.clientX,event.clientY);
      if (day!==null) moveTopics(selectedIds.includes(d.id)?selectedIds:[d.id],day);
      else setMoveFeedback("Solte sobre um dia da semana ou sobre Sem dia.");
    }
    setDraggedId(null); setDragOverDay(null);
  }
  function generate() {
    const availableDays = config.days.filter(day => !config.daySchedules?.[day]?.simulation);
    const completeTimeRanges = availableDays.length > 0 && availableDays.every(day => minutesForDay(config, day) > 0);
    if (!completeTimeRanges) {
      setPriorityFeedback("Defina o horário de início e fim de cada dia de estudo antes de pedir uma sugestão automática. Dias de simulado ficam reservados.");
      return;
    }
    if (config.mode === "priority" && (config.priorityOrder?.length || 0) !== leaves.length) {
      setPriorityFeedback("Antes de distribuir por prioridade, copie a solicitação para a IA e importe a ordem de todos os tópicos.");
      return;
    }
    const next = distribute(plan, config);
    if (!next.length) {
      setPriorityFeedback("Não encontrei dias de estudo com horário disponível para distribuir os conteúdos.");
      return;
    }
    persist(next.map(item => ({...assignments.find(old => old.nodeId === item.nodeId), ...item})));
    setUndo(null); setSelectedIds([]);
    setPriorityFeedback("Sugestão aplicada. Confira a carga de cada dia e ajuste manualmente o que precisar.");
  }
  async function copyPriorityPrompt() {
    const prompt = buildPriorityPrompt(plan, leaves);
    try {
      await navigator.clipboard.writeText(prompt);
      setPriorityFeedback("Solicitação copiada. Cole no ChatGPT e depois traga a lista de IDs ordenada.");
    } catch {
      saveBlob("prioridade-dos-conteudos-ritmo.txt", prompt);
      setPriorityFeedback("Não foi possível copiar. Baixei a solicitação em TXT.");
    }
  }
  function importPriority() {
    const rankedIds = parsePriorityOrder(priorityText, leaves);
    if (rankedIds.length !== leaves.length) {
      setPriorityFeedback(`Encontrei ${rankedIds.length} de ${leaves.length} IDs. Peça à IA para devolver todos os IDs, uma vez cada, e tente novamente.`);
      return;
    }
    const nextConfig = { ...config, priorityOrder: rankedIds };
    setConfig(nextConfig);
    setPriorityFeedback("Prioridade importada. A sugestão automática continuará usando somente os conteúdos selecionados.");
    void onSave({ ...plan, scheduleConfig: nextConfig, assignments, updatedAt: Date.now() });
  }
  async function finish() {
    if (!config.days.length) {
      setScheduleFeedback("Selecione pelo menos um dia para montar seu cronograma.");
      return;
    }
    const normalized = reconcileAssignments(leaves, assignments, config.days);
    const hasAssignedTopics = normalized.some(item => item.day >= 0 && config.days.includes(item.day));
    const hasSimulationDay = config.days.some(day => config.daySchedules?.[day]?.simulation);
    if (!hasAssignedTopics && !hasSimulationDay) {
      setScheduleFeedback("Distribua pelo menos um conteúdo ou reserve um dia para simulado antes de salvar.");
      return;
    }
    const unassignedCount = normalized.filter(item => item.day === -1).length;
    await onSave({ ...plan, scheduleConfig: config, assignments: normalized, status: "active", stage: "schedule", updatedAt: Date.now() });
    setAssignments(normalized);
    setScheduleFeedback(unassignedCount
      ? `Plano salvo. ${unassignedCount} conteúdo(s) ficaram sem dia e poderão ser organizados depois.`
      : "Plano salvo com todos os conteúdos organizados.");
  }

  const assignmentById = new Map(assignments.map(item => [item.nodeId, item]));
  const unassigned = leaves.filter(leaf => {
    const assignment = assignmentById.get(leaf.id);
    return !assignment || assignment.day === -1 || !config.days.includes(assignment.day);
  });
  const grouped = WEEKDAYS.filter(day => config.days.includes(day.id)).map(day => {
    const slot = config.daySchedules?.[day.id] || emptyDaySchedule();
    return {
      ...day,
      slot,
      minutes: durationFromTimes(slot.startTime, slot.endTime),
      items: leaves.filter(leaf => assignmentById.get(leaf.id)?.day === day.id),
    };
  });
  const simulationDays = grouped.filter(day => day.slot.simulation).length;
  const autoDays = grouped.filter(day => !day.slot.simulation);
  const autoReady = autoDays.length > 0 && autoDays.every(day => day.minutes > 0);
  const assignedCount = grouped.reduce((sum, day) => sum + day.items.length, 0);
  const blockOf = (leaf: SelectedPlanLeaf) => displayNodeName(leaf.path[0] || "Outros");
  const disciplineOf = (leaf: SelectedPlanLeaf) => displayNodeName(leaf.path.length > 2 ? leaf.path[1] : leaf.path[0] || "Outros");
  const blocks = [...new Set(leaves.map(blockOf))];
  const disciplines = [...new Set(leaves.filter(leaf => block==="all" || blockOf(leaf)===block).map(disciplineOf))];
  const visible = leaves.filter(leaf => (block==="all" || blockOf(leaf)===block) && (discipline==="all" || disciplineOf(leaf)===discipline) &&
    (dayFilter==="all" || (assignmentById.get(leaf.id)?.day ?? -1)===Number(dayFilter)) &&
    (!search.trim() || normalizePlanTopic(leaf.path.join(" ")+" "+plannerShortTitle(leaf.name)).includes(normalizePlanTopic(search))));
  const allVisibleSelected = visible.length>0 && visible.every(leaf => selectedIds.includes(leaf.id));
  const editing = WEEKDAYS.find(day=>day.id===openDay)!;
  const editingSlot=config.daySchedules?.[openDay] || emptyDaySchedule();
  const editingTopics=grouped.find(day=>day.id===openDay)?.items || [];
  const editingEnabled=config.days.includes(openDay);
  const weeklyMinutes=grouped.reduce((sum,day)=>sum+day.minutes,0);
  const durationLabel=(minutes:number)=>minutes?`${Math.floor(minutes/60)?Math.floor(minutes/60)+"h ":""}${minutes%60?minutes%60+"min":""}`.trim():"Definir";
  const blockLabel=(value:string)=>{const normalized=normalizePlanTopic(value);return normalized.includes("basicos")?"Básicos":normalized.includes("especificos")?"Específicos":value;};
  const dragging = leaves.find(leaf => leaf.id===draggedId);
  return <div className="wizard-content">
    <section className="hybrid-planner planner-workspace">
      <div className="hybrid-planner-heading"><div><h2>Organizar semana</h2><span>{assignedCount} de {leaves.length} conteúdos organizados</span></div><details className="hybrid-dates"><summary><CalendarDays size={15}/> Datas do plano</summary><div className="hybrid-date-fields"><label>Início<input type="date" aria-label="Início do plano" value={config.startDate} onChange={event=>changeConfig({startDate:event.target.value})}/></label><label>Prova (opcional)<input type="date" aria-label="Data da prova" value={config.examDate} onChange={event=>changeConfig({examDate:event.target.value})}/></label></div></details></div>
      <div className="planner-week hybrid-week">
        <div className="planner-days">{WEEKDAYS.map(day=>{
          const enabled=config.days.includes(day.id), slot=config.daySchedules?.[day.id];
          const count=grouped.find(item=>item.id===day.id)?.items.length||0;
          return <div key={day.id} data-planner-drop={day.id} className={`planner-day ${enabled?"enabled":""} ${openDay===day.id?"editing":""} ${dragOverDay===day.id?"drop-active":""} ${enabled&&slot?.simulation?"simulation":""}`}>
            <button type="button" className="planner-day-main" aria-pressed={openDay===day.id} aria-label={`${day.label}: ${enabled?count+" conteúdos":"dia livre"}`} onClick={()=>setOpenDay(day.id)}><i className="hybrid-day-dot"/><b>{day.short}</b><strong>{enabled?slot?.simulation&&!count?<Target size={20}/>:count:"–"}</strong><small>{enabled?slot?.simulation?"Simulado":durationLabel(durationFromTimes(slot?.startTime,slot?.endTime)):"Livre"}</small></button>
          </div>;
        })}</div>
        <div className="planner-week-meta"><span>{config.days.length} dias · {weeklyMinutes?durationLabel(weeklyMinutes):"0h"} semanais{simulationDays?` · ${simulationDays} simulado(s)`:""}</span><button type="button" data-planner-drop={-1} className={`planner-unassigned-drop ${dragOverDay===-1?"drop-active":""}`} onClick={()=>setDayFilter(current=>current==="-1"?"all":"-1")}>Sem dia <b>{unassigned.length}</b></button></div>
      </div>
      <section className="hybrid-inspector" aria-label="Configurar dia selecionado">
        <div className="hybrid-inspector-head"><h3>{editing.id>=1&&editing.id<=5?editing.label+"-feira":editing.label}</h3><span>{editingEnabled?`${durationLabel(durationFromTimes(editingSlot.startTime,editingSlot.endTime))} · ${editingTopics.length} assuntos`:"Dia livre"}</span></div>
        <div className="hybrid-dayconfig">
          <label className="hybrid-check"><input type="checkbox" checked={editingEnabled} onChange={event=>changeDays(event.target.checked?[...config.days,openDay]:config.days.filter(day=>day!==openDay))}/> Estudar</label>
          {editingEnabled&&<><input type="time" aria-label={`Horário inicial de ${editing.label}`} value={editingSlot.startTime} onChange={event=>setDaySchedule(openDay,{startTime:event.target.value})}/><span>–</span><input type="time" aria-label={`Horário final de ${editing.label}`} value={editingSlot.endTime} onChange={event=>setDaySchedule(openDay,{endTime:event.target.value})}/><label className="hybrid-check hybrid-sim"><input type="checkbox" checked={editingSlot.simulation} onChange={event=>setDaySchedule(openDay,{simulation:event.target.checked})}/> Simulado</label></>}
        </div>
        {editingEnabled&&<div className="hybrid-chips">{editingTopics.length?editingTopics.map(leaf=><span key={leaf.id} title={displayNodeName(leaf.name)}>{plannerShortTitle(leaf.name)}<button type="button" aria-label={`Retirar ${displayNodeName(leaf.name)} do dia`} onClick={()=>moveTopics([leaf.id],-1)}>×</button></span>):<small>{editingSlot.simulation?"Simulado reservado":"Arraste conteúdos para este dia"}</small>}</div>}
      </section>
      <section className="planner-library hybrid-library">
        <div className="planner-library-heading"><h3>Conteúdos</h3><span>{visible.length} assuntos</span></div>
        <div className="hybrid-filters">
          <div className="hybrid-block-tabs" aria-label="Área"><button type="button" className={block==="all"?"on":""} onClick={()=>{setBlock("all");setDiscipline("all");}}>Todos</button>{blocks.map(name=><button type="button" key={name} className={block===name?"on":""} title={name} onClick={()=>{setBlock(name);setDiscipline("all");}}>{blockLabel(name)}</button>)}</div>
          <select aria-label="Disciplina" value={discipline} onChange={event=>setDiscipline(event.target.value)}><option value="all">Todas as disciplinas</option>{disciplines.map(name=><option key={name} value={name}>{name}</option>)}</select>
          <select aria-label="Distribuição" value={dayFilter} onChange={event=>setDayFilter(event.target.value)}><option value="all">Todos os dias</option><option value="-1">Sem dia</option>{WEEKDAYS.map(day=><option key={day.id} value={day.id}>{day.short}</option>)}</select>
          <input aria-label="Buscar conteúdo" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar assunto…"/>
        </div>
        <div className="planner-bulk"><label className="inline-check"><input type="checkbox" checked={allVisibleSelected} onChange={event=>setSelectedIds(current=>event.target.checked?[...new Set([...current,...visible.map(leaf=>leaf.id)])]:current.filter(id=>!visible.some(leaf=>leaf.id===id)))}/> Selecionar visíveis</label><span>{selectedIds.length?selectedIds.length+" selecionados":"Arraste um assunto"}</span><select aria-label="Destino dos selecionados" value={bulkDay} onChange={event=>setBulkDay(Number(event.target.value))}><option value={-1}>Sem dia</option>{WEEKDAYS.map(day=><option key={day.id} value={day.id}>{day.short}</option>)}</select><button type="button" className="secondary-button compact" disabled={!selectedIds.length} onClick={moveSelected}>Mover</button></div>
        <div className="planner-topic-list">{visible.map(leaf=>{
          const day=assignmentById.get(leaf.id)?.day??-1;
          return <article key={leaf.id} className={`planner-topic ${draggedId===leaf.id?"drag-origin":""} ${selectedIds.includes(leaf.id)?"topic-selected":""}`}>
            <input type="checkbox" aria-label={`Selecionar ${displayNodeName(leaf.name)}`} checked={selectedIds.includes(leaf.id)} onChange={event=>toggleAssignment(leaf.id,event.target.checked)}/>
            <div className="planner-grab" title={displayNodeName(leaf.name)} onPointerDown={event=>pointerDown(event,leaf.id)} onPointerMove={pointerMove} onPointerUp={event=>pointerEnd(event)} onPointerCancel={event=>pointerEnd(event,true)} onLostPointerCapture={event=>pointerEnd(event,true)}><GripVertical size={17}/><div><strong>{plannerShortTitle(leaf.name)}</strong><small>{disciplineOf(leaf)}</small></div></div>
            <button type="button" className="planner-topic-info" aria-label="Ver texto original do edital" aria-expanded={original===leaf.id} onClick={()=>setOriginal(current=>current===leaf.id?null:leaf.id)}><Info size={15}/></button>
            <select aria-label={`Dia para ${displayNodeName(leaf.name)}`} value={day} onChange={event=>moveTopics([leaf.id],Number(event.target.value))}><option value={-1}>Sem dia</option>{WEEKDAYS.map(option=><option key={option.id} value={option.id}>{option.short}</option>)}</select>
            {original===leaf.id&&<div className="planner-original"><b>{displayNodeName(leaf.name)}</b>{leaf.sourceRef&&<small>{leaf.sourceRef}</small>}</div>}
          </article>;
        })}{!visible.length&&<div className="planner-no-results">Nenhum conteúdo neste filtro.</div>}</div>
      </section>
      <div className="planner-feedback hybrid-feedback" role="status"><span>{moveFeedback||"Segure o título e solte sobre um dia acima."}</span>{undo&&<button type="button" className="text-button" onClick={()=>{setConfig(undo.config);persist(undo.assignments,undo.config);setUndo(null);setMoveFeedback("Movimentação desfeita.");}}>Desfazer</button>}</div>
      {dragging&&<div className="planner-drag-ghost" style={{left:point.x+12,top:point.y+12}}><GripVertical size={16}/><span>{selectedIds.includes(dragging.id)&&selectedIds.length>1?`${selectedIds.length} conteúdos`:plannerShortTitle(dragging.name)}</span></div>}
    </section>

    <details className="panel wizard-panel auto-distribute-panel">
      <summary><span><Sparkles size={17}/> Quer uma sugestão de distribuição automática?</span><ChevronDown size={17}/></summary>
      <p>A sugestão é opcional. Ela considera a duração dos seus horários, mas não conhece a dificuldade de cada assunto nem seu cansaço. Revise a proposta e ajuste manualmente. Dias reservados para simulado não recebem assuntos automaticamente.{assignedCount > 0 ? " Ao aplicar, a distribuição atual será substituída." : ""}</p>
      <div className="field-block schedule-mode-field"><label htmlFor="schedule-mode">Critério da sugestão</label><select id="schedule-mode" value={config.mode} onChange={event => { setPriorityFeedback(""); changeConfig({ mode: event.target.value as ScheduleConfig["mode"] }); }}>
        <option value="alternate">Equilibrar assuntos entre os dias</option><option value="sequence">Seguir a sequência do edital</option><option value="priority">Priorizar recorrência da banca (com IA)</option>
      </select></div>
      {config.mode === "priority" && <div className="priority-ai-panel">
        <div><strong><Sparkles size={16}/> Prioridade sugerida pela IA</strong><small>Somente os conteúdos selecionados entram na análise. A IA deve separar evidência de estimativa.</small></div>
        <button className="secondary-button compact" type="button" onClick={copyPriorityPrompt}><Clipboard size={14}/> Copiar solicitação</button>
        <div className="field-block"><label htmlFor="priority-response">Cole aqui a resposta da IA com os IDs em ordem de prioridade</label><textarea id="priority-response" rows={4} value={priorityText} onChange={event => setPriorityText(event.target.value)} placeholder={leaves.map((leaf, index) => `${index + 1}. ID: ${leaf.id} — ${displayNodeName(leaf.name)}`).join("\n")}/></div>
        <div className="button-row"><button className="primary-button compact" type="button" disabled={!priorityText.trim()} onClick={importPriority}>Importar prioridade</button><span className="soft-tag">{config.priorityOrder?.length || 0}/{leaves.length} classificados</span></div>
      </div>}
      <div className="button-row"><button className="secondary-button" type="button" disabled={!autoReady || (config.mode === "priority" && (config.priorityOrder?.length || 0) !== leaves.length)} onClick={generate}>{assignedCount > 0 ? "Substituir distribuição atual" : "Aplicar sugestão automática"} <ArrowRight size={15}/></button><small className="field-hint">{autoReady ? "A sugestão usará apenas dias com horário definido." : "Defina os horários de todos os dias sem simulado para habilitar a sugestão."}</small></div>
      {priorityFeedback && <p className="inline-feedback" role="status">{priorityFeedback}</p>}
    </details>

    <section className="panel wizard-panel">
      <div className="wizard-navigation"><button className="secondary-button" type="button" onClick={() => onSave({ ...plan, stage: "selection" })}><ArrowLeft size={16}/>Voltar à seleção</button>
        <button className="primary-button" type="button" disabled={!config.days.length || !leaves.length || (!assignments.some(item => item.day >= 0 && config.days.includes(item.day)) && !config.days.some(day => config.daySchedules?.[day]?.simulation))} onClick={finish}>Salvar meu cronograma <Check size={16}/></button></div>
      {scheduleFeedback && <p className="inline-feedback" role="status">{scheduleFeedback}</p>}
      {unassigned.length > 0 && <p className="field-hint">{unassigned.length} conteúdo(s) ainda estão sem dia. Você pode salvar o cronograma e organizá-los depois, sem perder sua seleção.</p>}
    </section>
  </div>;
}

export function PlanWizardRoute() {
  const { id = "" } = useParams();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    getPlan(id).then(found => { if (active) setPlan(found || null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function persist(next: StudyPlan) {
    const saved = await savePlan(next);
    setPlan(saved);
  }
  if (loading) return <div className="stack"><div className="loading-panel">Abrindo seu plano…</div></div>;
  if (!plan) return <div className="stack"><div className="panel empty-state"><FolderOpen size={28}/><strong>Não encontrei este plano.</strong><Link to="/plans" className="text-link">Voltar aos planos</Link></div></div>;

  return <div className="stack wizard-stack">
    <header className="heading wizard-heading">
      <div><small>MEUS PLANOS / {plan.stage==="schedule"?"CRONOGRAMA":plan.stage==="selection"?"CONTEÚDOS":"EDITAL"}</small><h1>{plan.title}</h1><p>{[plan.institution, plan.position, plan.area].filter(Boolean).join(" · ")}</p></div>
      <Link className="secondary-button" to="/plans"><ArrowLeft size={16}/>Meus planos</Link>
    </header>
    <Stepper stage={plan.stage}/>
    {plan.stage === "source"
      ? <SourceStep plan={plan} onSave={persist}/>
      : plan.stage === "selection"
        ? <SelectionStep plan={plan} onSave={persist}/>
        : <ScheduleStep plan={plan} onSave={persist}/>}
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

  const weekEntries = useMemo(() => {
    if (!plan || !config) return [];
    const monday = mondayOfWeek(new Date());
    return WEEKDAYS.filter(day => config.days.includes(day.id)).map(day => {
      const date = shiftPlanDate(monday, day.id === 0 ? 6 : day.id - 1);
      const key = planDateKey(date);
      const items = plan.assignments.filter(item => item.day === day.id);
      const completed = items.filter(item => (item.completedDates || []).includes(key)).length;
      const slot = config.daySchedules?.[day.id];
      const simulation = Boolean(slot?.simulation);
      const simulationDone = Boolean(simulation && (slot?.completedDates || []).includes(key));
      return { ...day, date, key, items, completed, slot, simulation, simulationDone, minutes: minutesForDay(config, day.id), active: planDateIsActive(date, config), isToday: key === todayKey };
    });
  }, [plan, config, todayKey]);

  const nextStudyDate = useMemo(() => plan ? findNextPlanStudyDate(plan) : null, [plan]);
  const nextStudyKey = nextStudyDate ? planDateKey(nextStudyDate) : "";
  const nextStudyItems = nextStudyDate && plan
    ? plan.assignments.filter(item => item.day === nextStudyDate.getDay() && !(item.completedDates || []).includes(nextStudyKey))
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
  const unassignedCount = (plan?.assignments || []).filter(item => !config?.days.includes(item.day)).length;

  const topicKeys = useMemo(() => new Set((plan?.assignments || []).map(item => normalizePlanTopic(displayNodeName(item.name)))), [plan]);
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

  const coverageGroups = new Map<string, { total: number; studied: number }>();
  (plan?.assignments || []).forEach(item => {
    const group = displayNodeName(item.path[0] || "Outros");
    const current = coverageGroups.get(group) || { total: 0, studied: 0 };
    current.total += 1;
    if ((item.completedDates || []).length > 0) current.studied += 1;
    coverageGroups.set(group, current);
  });
  const coverageStudied = (plan?.assignments || []).filter(item => (item.completedDates || []).length > 0).length;
  const coverageTotal = plan?.assignments.length || 0;
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
    plan.assignments.some(item => config.days.includes(item.day)) ||
    config.days.some(day => config.daySchedules?.[day]?.simulation)
  ));

  return <div className="stack plan-detail-stack">
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
            <h2>{nextStudySimulation ? "Dia de simulado: chegou a hora de testar sua preparação." : nextStudyKey === todayKey ? "Vamos avançar um assunto de cada vez." : "Sua próxima sessão já está organizada."}</h2>
            <p className="plan-next-description">{nextStudySlot?.startTime && nextStudySlot?.endTime
              ? `Das ${nextStudySlot.startTime} às ${nextStudySlot.endTime} · ${formatDuration(nextStudyMinutes)}.`
              : nextStudyMinutes ? `${nextStudyMinutes} minutos reservados no seu cronograma.` : "O horário desta sessão ainda não foi definido."} {nextStudySimulation ? "Faça o simulado no tempo previsto e registre o resultado." : "Escolha um assunto, estude com atenção e registre o que conseguiu aprender."}</p>
            {nextStudySimulation && <div className="plan-week-simulation"><Target size={16}/><span>Dia reservado para simulado. Ao terminar, marque a realização na seção “Esta semana”.</span><Link to="/questions">Registrar resultado <ArrowRight size={12}/></Link></div>}
            <div className="plan-next-topic-list">
              {nextStudyItems.slice(0, 5).map(item => <label className="plan-next-topic" key={item.nodeId}>
                <span className="plan-topic-bullet"/>
                <span><b>{displayNodeName(item.name)}</b><small>{item.path.slice(0, -1).map(displayNodeName).join(" / ")}</small></span>
              </label>)}
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
          <div><span className="step-kicker">ACOMPANHAMENTO REAL</span><h2>Como está sua semana?</h2><p>Marque os assuntos depois de estudá-los. O progresso é seu, não uma estimativa automática.</p></div>
          <strong className="plan-week-ratio">{weeklyCompleted}<small> / {weeklyPlanned}</small></strong>
        </div>
        <div className="plan-progress-track"><span style={{ width: weeklyPercent + "%" }}/></div>
        <div className="plan-progress-foot"><span>{weeklyPercent}% do cronograma semanal concluído</span><span>{weeklyPlanned - weeklyCompleted} assunto(s) ainda previsto(s)</span></div>
        <div className="plan-week-strip">
          {weekEntries.map(day => <div className={"plan-week-chip " + (day.isToday ? "today" : "") + (day.active ? "" : " inactive")} key={day.id}>
            <span>{day.short}</span><b>{day.simulation ? (day.simulationDone ? "OK" : "SIM") : day.items.length ? day.completed + "/" + day.items.length : "—"}</b>
          </div>)}
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
                  return <label className={"plan-week-topic " + (done ? "is-done" : "")} key={item.nodeId}>
                    <input type="checkbox" checked={done} disabled={savingCompletion || !day.active} onChange={() => toggleStudyCompletion(item.nodeId, day.key)}/>
                    <span><b>{displayNodeName(item.name)}</b><small>{item.path.slice(0, -1).map(displayNodeName).join(" / ")}</small></span>
                    <em>{done ? "Estudado" : day.active ? "Marcar como estudado" : "Fora do período"}</em>
                  </label>;
                })}
              </div> : !day.simulation ? <p className="plan-week-empty">Nenhum assunto distribuído para este dia.</p> : null}
            </details>)}
          </div>
        </section>

        <section className="panel plan-attention-panel">
          <div className="plan-section-heading compact">
            <div><span className="step-kicker">SINAIS DE ATENÇÃO</span><h2>Onde vale retomar?</h2><p>Registros de questões, flashcards e erros com nomes de assuntos correspondentes ao seu plano.</p></div>
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
          <div><span className="step-kicker">VISÃO DO EDITAL</span><h2>Conteúdos que você já trabalhou</h2><p>Um assunto entra aqui depois que você marca pelo menos uma sessão como estudada. Isso não significa domínio do conteúdo.</p></div>
          <strong className="plan-coverage-total">{coverageStudied}<small> / {coverageTotal}</small></strong>
        </div>
        <div className="plan-coverage-overall"><span style={{ width: coveragePercent + "%" }}/></div>
        <div className="plan-coverage-grid">
          {[...coverageGroups.entries()].map(([name, value]) => {
            const percent = value.total ? Math.round(value.studied / value.total * 100) : 0;
            return <div className="plan-coverage-item" key={name}>
              <div><b>{name}</b><small>{value.studied} de {value.total} assuntos</small></div>
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
