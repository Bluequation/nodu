import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronRight,
  Clipboard, FolderOpen, Info, Pencil, Plus, Sparkles, Upload,
} from "lucide-react";
import { getPlan, savePlan } from "../../data/plans";
import type { PlanNode, PlanStage, ScheduleConfig, StudyPlan } from "../../domain/models";
import {
  addManualChildToTree, buildVerticalPrompt, getNodeSelectionState,
  getPlanSections, getSelectedLeaves, parseVerticalMarkdown, renameNodeInTree,
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
function minutesForDay(config: ScheduleConfig, dayId: number) {
  return config.sameMinutes === false ? (config.dayMinutes?.[dayId] ?? config.minutes) : config.minutes;
}
const defaultSchedule = (plan: StudyPlan): ScheduleConfig => ({
  startDate: today(),
  examDate: plan.examDate || "",
  days: [1, 2, 3, 4, 5],
  minutes: 90,
  sameMinutes: true,
  dayMinutes: { 1: 90, 2: 90, 3: 90, 4: 90, 5: 90 },
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
  const days = WEEKDAYS.filter(day => config.days.includes(day.id)).map(day => day.id);
  if (!leaves.length || !days.length) return [];
  const byId = new Map(leaves.map(leaf => [leaf.id, leaf]));
  const ranked = config.mode === "priority"
    ? (config.priorityOrder || []).map(id => byId.get(id)).filter((leaf): leaf is (typeof leaves)[number] => Boolean(leaf))
    : [];
  const ordered = config.mode === "priority"
    ? [...ranked, ...leaves.filter(leaf => !ranked.some(item => item.id === leaf.id))]
    : leaves;
  const capacity = new Map(days.map(day => [day, Math.max(30, minutesForDay(config, day))]));
  const load = new Map(days.map(day => [day, 0]));
  const assigned = new Map<string, number>();
  if (config.mode === "sequence") {
    let offset = 0;
    days.forEach((day, index) => {
      const remainingTopics = ordered.length - offset;
      if (remainingTopics <= 0) return;
      const remainingCapacity = days.slice(index).reduce((sum, item) => sum + (capacity.get(item) || 30), 0);
      const count = index === days.length - 1 ? remainingTopics : Math.min(remainingTopics, Math.max(1, Math.round(remainingTopics * (capacity.get(day) || 30) / remainingCapacity)));
      ordered.slice(offset, offset + count).forEach(leaf => assigned.set(leaf.id, day));
      offset += count;
    });
  } else {
    ordered.forEach(leaf => {
      const day = days.reduce((best, candidate) => {
        const candidateRatio = (load.get(candidate) || 0) / (capacity.get(candidate) || 30);
        const bestRatio = (load.get(best) || 0) / (capacity.get(best) || 30);
        return candidateRatio < bestRatio ? candidate : best;
      }, days[0]);
      assigned.set(leaf.id, day);
      load.set(day, (load.get(day) || 0) + 1);
    });
  }
  return ordered.map(leaf => ({
    nodeId: leaf.id, name: displayNodeName(leaf.name), path: leaf.path.map(displayNodeName),
    origin: leaf.origin, sourceRef: leaf.sourceRef, day: assigned.get(leaf.id) ?? days[0],
  }));
}

function buildPriorityPrompt(plan: StudyPlan, leaves: PlanNode[]) {
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

function parsePriorityOrder(response: string, leaves: PlanNode[]) {
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
  useEffect(() => { setSourceText(plan.sourceText); setSourceFile(plan.sourceFile); }, [plan.id, plan.sourceText, plan.sourceFile]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 25_000_000) { setMessage("O arquivo ultrapassa 25 MB. Escolha um arquivo menor."); return; }
    setBusy(true); setMessage("");
    try {
      const text = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        ? await readPdf(file)
        : file.name.toLowerCase().endsWith(".txt") || file.name.toLowerCase().endsWith(".md")
          ? await file.text()
          : "";
      if (!text) throw new Error("Formato não reconhecido. Envie PDF, TXT ou Markdown.");
      setSourceText(text.slice(0, 180000));
      setSourceFile(file.name);
      setMessage("Texto extraído. Confira se corresponde ao cargo e à área escolhidos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function saveSource() {
    await onSave({ ...plan, sourceText, sourceFile, updatedAt: Date.now() });
    setMessage("Dados do edital salvos neste navegador.");
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
        <textarea id="source-text" rows={9} maxLength={180000} value={sourceText} onChange={event => setSourceText(event.target.value)} placeholder="Cole aqui somente o conteúdo programático pertinente ao cargo e à área escolhidos."/>
        <small>Evite inserir dados pessoais. Se o edital tiver várias áreas, mantenha aqui apenas o recorte que pertence a este plano.</small>
      </div>
      <div className="button-row">
        <button className="secondary-button" type="button" onClick={saveSource}>Salvar dados do edital</button>
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
    {message && <p className="inline-feedback" role="status">{busy ? "Lendo arquivo…" : message}</p>}
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

function ScheduleStep({ plan, onSave }: { plan: StudyPlan; onSave: (next: StudyPlan) => Promise<void> }) {
  const [config, setConfig] = useState<ScheduleConfig>(plan.scheduleConfig || defaultSchedule(plan));
  const [assignments, setAssignments] = useState(plan.assignments);
  const [priorityText, setPriorityText] = useState("");
  const [priorityFeedback, setPriorityFeedback] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDay, setBulkDay] = useState<number>(config.days[0] ?? 1);
  const leaves = getSelectedLeaves(plan.tree);

  useEffect(() => {
    setConfig(plan.scheduleConfig || defaultSchedule(plan));
    setAssignments(plan.assignments);
    setSelectedIds([]);
  }, [plan.id]);

  function changeConfig(patch: Partial<ScheduleConfig>) {
    const next = { ...config, ...patch };
    setConfig(next);
    void onSave({ ...plan, scheduleConfig: next, updatedAt: Date.now() });
  }
  function changeDays(days: number[]) {
    const dayMinutes = { ...(config.dayMinutes || {}) };
    days.forEach(day => { if (!dayMinutes[day]) dayMinutes[day] = config.minutes; });
    const nextConfig = { ...config, days, dayMinutes };
    const nextAssignments = days.length ? assignments.map((item, index) => days.includes(item.day) ? item : { ...item, day: days[index % days.length] }) : assignments;
    setConfig(nextConfig); setAssignments(nextAssignments); setSelectedIds([]);
    void onSave({ ...plan, scheduleConfig: nextConfig, assignments: nextAssignments, updatedAt: Date.now() });
  }
  function setSharedMinutes(minutes: number) {
    changeConfig({ minutes, sameMinutes: true, dayMinutes: Object.fromEntries(config.days.map(day => [day, minutes])) });
  }
  function setIndividualMinutes(dayId: number, minutes: number) {
    changeConfig({ sameMinutes: false, dayMinutes: { ...(config.dayMinutes || {}), [dayId]: minutes } });
  }
  function toggleSharedTime(shared: boolean) {
    if (shared) {
      const firstDay = config.days[0];
      const minutes = firstDay === undefined ? config.minutes : minutesForDay(config, firstDay);
      changeConfig({ sameMinutes: true, minutes, dayMinutes: Object.fromEntries(config.days.map(day => [day, minutes])) });
    } else {
      changeConfig({ sameMinutes: false, dayMinutes: Object.fromEntries(config.days.map(day => [day, minutesForDay(config, day)])) });
    }
  }
  function generate() {
    if (config.mode === "priority" && (config.priorityOrder?.length || 0) !== leaves.length) {
      setPriorityFeedback("Antes de distribuir por prioridade, copie a solicitação para a IA e importe a ordem de todos os tópicos.");
      return;
    }
    const next = distribute(plan, config);
    setAssignments(next); setSelectedIds([]);
    void onSave({ ...plan, scheduleConfig: config, assignments: next, updatedAt: Date.now() });
  }
  function moveAssignment(nodeId: string, day: number) {
    const next = assignments.map(item => item.nodeId === nodeId ? { ...item, day } : item);
    setAssignments(next);
    void onSave({ ...plan, assignments: next, updatedAt: Date.now() });
  }
  function toggleAssignment(id: string, checked: boolean) {
    setSelectedIds(current => checked ? [...new Set([...current, id])] : current.filter(item => item !== id));
  }
  function moveSelected() {
    if (!selectedIds.length || !config.days.includes(bulkDay)) return;
    const next = assignments.map(item => selectedIds.includes(item.nodeId) ? { ...item, day: bulkDay } : item);
    setAssignments(next); setSelectedIds([]);
    void onSave({ ...plan, assignments: next, updatedAt: Date.now() });
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
    setPriorityFeedback("Prioridade importada. A distribuição continuará usando somente os conteúdos selecionados.");
    void onSave({ ...plan, scheduleConfig: nextConfig, updatedAt: Date.now() });
  }
  async function finish() {
    const uniqueIds = new Set(assignments.map(item => item.nodeId));
    if (!assignments.length || uniqueIds.size !== leaves.length || assignments.some(item => !config.days.includes(item.day))) return;
    await onSave({ ...plan, scheduleConfig: config, assignments, status: "active", stage: "schedule", updatedAt: Date.now() });
  }

  const grouped = WEEKDAYS.filter(day => config.days.includes(day.id)).map(day => ({
    ...day, minutes: minutesForDay(config, day.id), items: assignments.filter(item => item.day === day.id),
  }));
  const allSelected = assignments.length > 0 && selectedIds.length === assignments.length;

  return <div className="wizard-content">
    <section className="panel wizard-panel">
      <div className="panel-title-row"><div><span className="step-kicker">ETAPA 3 · CRONOGRAMA</span><h2>Defina sua disponibilidade</h2><p>Configure cada dia e escolha como os conteúdos serão distribuídos. Você poderá ajustar tudo depois.</p></div><span className="soft-tag">Decisão do estudante</span></div>
      <div className="form-grid">
        <div className="field-block"><label htmlFor="schedule-start">Início do plano</label><input id="schedule-start" type="date" value={config.startDate} onChange={event => changeConfig({ startDate: event.target.value })}/></div>
        <div className="field-block"><label htmlFor="schedule-exam">Data da prova (opcional)</label><input id="schedule-exam" type="date" value={config.examDate} onChange={event => changeConfig({ examDate: event.target.value })}/></div>
      </div>
      <div className="field-block"><label>Em quais dias você pode estudar?</label><div className="weekday-grid">
        {WEEKDAYS.map(day => <label className={config.days.includes(day.id) ? "weekday-choice selected" : "weekday-choice"} key={day.id}><input type="checkbox" checked={config.days.includes(day.id)} onChange={event => changeDays(event.target.checked ? [...config.days, day.id] : config.days.filter(id => id !== day.id))}/><span>{day.short}</span></label>)}
      </div></div>
      <div className="availability-heading"><strong>Tempo disponível</strong><label className="inline-check"><input type="checkbox" checked={config.sameMinutes !== false} onChange={event => toggleSharedTime(event.target.checked)}/> Mesmo tempo em todos os dias</label></div>
      {config.sameMinutes !== false
        ? <div className="field-block compact-field"><label htmlFor="schedule-minutes">Tempo por dia</label><select id="schedule-minutes" value={config.minutes} onChange={event => setSharedMinutes(Number(event.target.value))}>{MINUTES.map(minutes => <option key={minutes} value={minutes}>{minutes} minutos</option>)}</select></div>
        : <div className="day-time-grid">{WEEKDAYS.filter(day => config.days.includes(day.id)).map(day => <label className="day-time-row" key={day.id}><span>{day.label}</span><select aria-label={`Tempo disponível na ${day.label}`} value={minutesForDay(config, day.id)} onChange={event => setIndividualMinutes(day.id, Number(event.target.value))}>{MINUTES.map(minutes => <option key={minutes} value={minutes}>{minutes} min</option>)}</select></label>)}</div>}
      <div className="field-block schedule-mode-field"><label htmlFor="schedule-mode">Distribuição inicial</label><select id="schedule-mode" value={config.mode} onChange={event => { setPriorityFeedback(""); changeConfig({ mode: event.target.value as ScheduleConfig["mode"] }); }}>
        <option value="alternate">Equilibrar assuntos entre os dias</option><option value="sequence">Seguir a sequência do edital</option><option value="priority">Priorizar recorrência da banca (com IA)</option>
      </select><small>A distribuição considera sua disponibilidade. Nenhum tópico será acrescentado ou removido.</small></div>
      {config.mode === "priority" && <div className="priority-ai-panel">
        <div><strong><Sparkles size={16}/> Prioridade sugerida pela IA</strong><small>Somente os conteúdos selecionados entram na análise. A IA deve separar evidência de estimativa.</small></div>
        <button className="secondary-button compact" type="button" onClick={copyPriorityPrompt}><Clipboard size={14}/> Copiar solicitação</button>
        <div className="field-block"><label htmlFor="priority-response">Cole aqui a resposta da IA com os IDs em ordem de prioridade</label><textarea id="priority-response" rows={4} value={priorityText} onChange={event => setPriorityText(event.target.value)} placeholder={leaves.map((leaf, index) => `${index + 1}. ID: ${leaf.id} — ${displayNodeName(leaf.name)}`).join("\n")}/></div>
        <div className="button-row"><button className="primary-button compact" type="button" disabled={!priorityText.trim()} onClick={importPriority}>Importar prioridade</button><span className="soft-tag">{config.priorityOrder?.length || 0}/{leaves.length} classificados</span></div>
        {priorityFeedback && <p className="inline-feedback" role="status">{priorityFeedback}</p>}
      </div>}
      <button className="primary-button" type="button" disabled={!config.days.length || !leaves.length || (config.mode === "priority" && (config.priorityOrder?.length || 0) !== leaves.length)} onClick={generate}>Distribuir conteúdos na semana <ArrowRight size={16}/></button>
      <p className="field-hint">{leaves.length} tópico(s) selecionado(s). O tempo é sua disponibilidade, não uma estimativa de domínio do assunto.</p>
      {!config.days.length && <p className="inline-feedback">Selecione pelo menos um dia para organizar a distribuição.</p>}
    </section>

    <section className="panel wizard-panel">
      <div className="panel-title-row"><div><h2>Revise a distribuição</h2><p>{assignments.length} de {leaves.length} tópico(s) distribuído(s). Você pode mover um ou vários conteúdos.</p></div>{assignments.length > 0 && <span className="soft-tag">Rascunho editável</span>}</div>
      {assignments.length === 0
        ? <div className="empty-state"><CalendarDays size={28}/><strong>Monte sua primeira distribuição</strong><span>Escolha os dias disponíveis e gere a distribuição inicial.</span></div>
        : <>
          <div className="assignment-toolbar"><label className="inline-check"><input type="checkbox" checked={allSelected} onChange={event => setSelectedIds(event.target.checked ? assignments.map(item => item.nodeId) : [])}/> Selecionar todos</label>
            <div className="button-row"><select aria-label="Dia de destino dos conteúdos selecionados" value={bulkDay} onChange={event => setBulkDay(Number(event.target.value))}>{WEEKDAYS.filter(day => config.days.includes(day.id)).map(day => <option key={day.id} value={day.id}>{day.label}</option>)}</select><button className="secondary-button compact" type="button" disabled={!selectedIds.length} onClick={moveSelected}>Mover {selectedIds.length ? `(${selectedIds.length})` : "selecionados"}</button><button className="text-button" type="button" onClick={generate}>Redistribuir</button></div>
          </div>
          <div className="assignment-groups">{grouped.map(day => <section className="assignment-day" key={day.id}>
            <div className="assignment-day-heading"><strong>{day.label}</strong><span>{day.items.length} tópico(s) · {day.minutes} min disponíveis</span></div>
            {day.items.length ? day.items.map(item => <div className="assignment-row" key={item.nodeId}>
              <input type="checkbox" aria-label={`Selecionar ${displayNodeName(item.name)}`} checked={selectedIds.includes(item.nodeId)} onChange={event => toggleAssignment(item.nodeId, event.target.checked)}/>
              <div><strong>{displayNodeName(item.name)}</strong><small>{item.path.map(displayNodeName).join(" / ")}</small></div>
              <select aria-label={`Dia de estudo para ${displayNodeName(item.name)}`} value={item.day} onChange={event => moveAssignment(item.nodeId, Number(event.target.value))}>{WEEKDAYS.filter(option => config.days.includes(option.id)).map(option => <option key={option.id} value={option.id}>{option.short}</option>)}</select>
            </div>) : <p className="empty-day">Sem tópicos.</p>}
          </section>)}</div>
        </>}
      <div className="wizard-navigation"><button className="secondary-button" type="button" onClick={() => onSave({ ...plan, stage: "selection" })}><ArrowLeft size={16}/>Voltar à seleção</button>
        <button className="primary-button" type="button" disabled={!assignments.length || assignments.length !== leaves.length || new Set(assignments.map(item => item.nodeId)).size !== leaves.length || !config.days.length || assignments.some(item => !config.days.includes(item.day))} onClick={finish}>Salvar meu plano <Check size={16}/></button></div>
    </section>
  </div>;
}

function CalendarDaysIcon() {
  return <CalendarDays size={28}/>;
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
      <div><small>RITMO / VERTICALIZAR EDITAL</small><h1>{plan.title}</h1><p>{[plan.institution, plan.position, plan.area].filter(Boolean).join(" · ")}</p></div>
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

export function PlanDetailRoute() {
  const { id = "" } = useParams();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  useEffect(() => { getPlan(id).then(found => setPlan(found || null)); }, [id]);
  if (!plan) return <div className="loading-panel">Abrindo plano…</div>;
  const leaves = getSelectedLeaves(plan.tree);
  const done = plan.assignments.length;
  return <div className="stack">
    <header className="heading"><div><small>RITMO / MEUS PLANOS</small><h1>{plan.title}</h1><p>{[plan.institution, plan.position, plan.area].filter(Boolean).join(" · ")}</p></div><Link className="secondary-button" to="/plans"><ArrowLeft size={16}/>Meus planos</Link></header>
    <section className="panel plan-overview">
      <span className="soft-tag">{plan.status === "active" ? "Plano ativo" : "Rascunho"}</span>
      <h2>Seu percurso de estudos</h2>
      <div className="selection-summary-grid"><div><strong>{leaves.length}</strong><span>Conteúdos selecionados</span></div><div><strong>{done}</strong><span>Conteúdos distribuídos</span></div><div><strong>{plan.scheduleConfig?.days.length || 0}</strong><span>Dias por semana</span></div></div>
      <Link className="primary-button" to={`/plans/${plan.id}/verticalize`}>{plan.status === "active" ? "Editar plano" : "Continuar configuração"}<Pencil size={16}/></Link>
    </section>
  </div>;
}
