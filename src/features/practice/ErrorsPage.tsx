import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, ExternalLink, NotebookPen, Paperclip, Plus, Search, Trash2 } from "lucide-react";
import type { Concept, ErrorAttachment, ErrorRecord, QuestionBlock, StudySubject } from "../../domain/study";
import { deleteError, deleteQuestionBlock, listConcepts, listErrors, listQuestionBlocks, saveError, saveQuestionBlock } from "../../data/study";
import { errorStage } from "../../domain/learningQueue";
import { useStudyContext } from "../study/useStudyContext";
import { MaterialScopePicker, useMaterialPlans } from "../study/MaterialScopePicker";
import { addTopicLink, linkedTo, linkedToPlan } from "../../domain/topicContext";
import "../study/materials.css";

const DAY = 86_400_000;
const REVIEW_STEPS = [1, 3, 7, 15, 30, 60, 90];
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const DISCIPLINE_DEFAULTS = [
  "Administração Pública",
  "Conhecimentos Pedagógicos",
  "Dados e Indicadores",
  "Física",
  "Legislação",
  "Matemática",
  "Português",
];
const EMPTY_BLOCK = {
  subject: "tae" as StudySubject,
  discipline: "",
  area: "",
  topic: "",
  total: 10,
  correct: 0,
  note: "",
};
const EMPTY_ERROR = {
  subject: "tae" as StudySubject,
  discipline: "",
  area: "",
  topic: "",
  type: "Lacuna",
  mistake: "",
  fix: "",
  reviewDays: 15,
  questionUrl: "",
  conceptId: "",
  questionText: "",
  optionsText: "",
  correctAnswer: "",
  attachments: [] as ErrorAttachment[],
};

function dateLabel(value: number) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function shortDateLabel(value: number) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function isDue(error: ErrorRecord) {
  return error.status !== "dominado" && error.nextReview <= Date.now();
}
function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
function sameDiscipline(a: string, b: string) {
  return a.trim().localeCompare(b.trim(), "pt-BR", { sensitivity: "base" }) === 0;
}

export function ErrorsPage() {
  const context = useStudyContext();
  const plans = useMaterialPlans();
  const [params, setParams] = useSearchParams();
  const requestedView = params.get("view") === "performance" ? "performance" : "errors";
  const [view, setView] = useState<"errors" | "performance">(requestedView);
  const [phase, setPhase] = useState<"all" | "pendente" | "recuperacao" | "superado">("all");
  const [disciplineTab, setDisciplineTab] = useState("Todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [blocks, setBlocks] = useState<QuestionBlock[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [form, setForm] = useState(EMPTY_ERROR);
  const [blockForm, setBlockForm] = useState(EMPTY_BLOCK);
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [applyId, setApplyId] = useState("");
  const [feedback, setFeedback] = useState("");

  async function reload() {
    const [nextErrors, nextConcepts, nextBlocks] = await Promise.all([listErrors(), listConcepts(), listQuestionBlocks()]);
    setErrors(nextErrors);
    setConcepts(nextConcepts);
    setBlocks(nextBlocks);
  }
  useEffect(() => { reload(); }, []);
  useEffect(() => { setView(requestedView); }, [requestedView]);

  const selectedPlan = plans.find(plan => plan.id === params.get("plan"));
  const inScope = <T extends { planTopics?: ErrorRecord["planTopics"] }>(item: T) =>
    context.requested
      ? context.valid && linkedTo(item, context.ref)
      : params.get("plan")
        ? !!selectedPlan && linkedToPlan(item, selectedPlan)
        : true;
  const scoped = errors.filter(inScope);
  const scopedBlocks = blocks.filter(inScope);
  const blockDiscipline = (block: QuestionBlock) => block.discipline?.trim() || (block.subject === "fisica" ? "Física" : "Geral");
  const dueOnly = params.get("due") === "1";
  const extraDisciplines = Array.from(new Set([
    ...scoped.map(error => error.discipline.trim()).filter(Boolean),
    ...scopedBlocks.map(blockDiscipline).filter(Boolean),
  ]))
    .filter(name => !["Geral", ...DISCIPLINE_DEFAULTS].some(defaultName => sameDiscipline(defaultName, name)))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const disciplineTabs = ["Todas", ...Array.from(new Set(["Geral", ...DISCIPLINE_DEFAULTS, ...extraDisciplines]))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))];
  const disciplineRows = scoped.filter(error =>
    disciplineTab === "Todas" || sameDiscipline(error.discipline, disciplineTab)
  );
  const performanceRows = scopedBlocks.filter(block =>
    disciplineTab === "Todas" || sameDiscipline(blockDiscipline(block), disciplineTab)
  );
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");
  const visible = disciplineRows.filter(error => {
    const matchesPhase = phase === "all" || errorStage(error) === phase;
    const matchesDue = !dueOnly || isDue(error);
    const haystack = [
      error.discipline, error.area, error.topic, error.type, error.mistake, error.fix,
      error.questionText, error.optionsText, error.correctAnswer,
    ].join(" ").toLocaleLowerCase("pt-BR");
    return matchesPhase && matchesDue && (!normalizedSearch || haystack.includes(normalizedSearch));
  });
  const due = disciplineRows.filter(isDue).length;
  const phaseCounts = {
    all: disciplineRows.length,
    pendente: disciplineRows.filter(error => errorStage(error) === "pendente").length,
    recuperacao: disciplineRows.filter(error => errorStage(error) === "recuperacao").length,
    superado: disciplineRows.filter(error => errorStage(error) === "superado").length,
  };
  const normalizedBlockSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");
  const visibleBlocks = performanceRows.filter(block => [
    blockDiscipline(block), block.area || "", block.topic, block.note || "",
  ].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedBlockSearch));
  const questionTotal = visibleBlocks.reduce((sum, block) => sum + block.total, 0);
  const correctTotal = visibleBlocks.reduce((sum, block) => sum + block.correct, 0);
  const accuracy = questionTotal ? Math.round(correctTotal / questionTotal * 100) : 0;

  function set<K extends keyof typeof EMPTY_ERROR>(key: K, value: typeof EMPTY_ERROR[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  function setBlock<K extends keyof typeof EMPTY_BLOCK>(key: K, value: typeof EMPTY_BLOCK[K]) {
    setBlockForm(current => ({ ...current, [key]: value }));
  }
  function changeView(next: "errors" | "performance") {
    const nextParams = new URLSearchParams(params);
    if (next === "performance") {
      nextParams.set("view", "performance");
      nextParams.delete("due");
    } else nextParams.delete("view");
    setParams(nextParams);
    setView(next);
    setDisciplineTab("Todas");
    setPhase("all");
    setShowForm(false);
    setFeedback("");
  }
  function edit(error: ErrorRecord) {
    setEditingId(error.id);
    setForm({
      subject: error.subject,
      discipline: error.discipline,
      area: error.area,
      topic: error.topic,
      type: error.type,
      mistake: error.mistake,
      fix: error.fix,
      reviewDays: error.reviewDays,
      questionUrl: error.questionUrl,
      conceptId: error.conceptId,
      questionText: error.questionText,
      optionsText: error.optionsText,
      correctAnswer: error.correctAnswer,
      attachments: error.attachments || [],
    });
    setShowForm(true);
    setFeedback("");
  }
  function newError() {
    if (params.get("plan") && !context.valid) {
      setFeedback("Escolha um assunto do plano para registrar o erro.");
      return;
    }
    const tabDiscipline = disciplineTab === "Todas" ? "" : disciplineTab;
    setEditingId("");
    setForm(context.valid
      ? {
          ...EMPTY_ERROR,
          topic: context.title,
          discipline: "",
          area: context.area,
          subject: /f[ií]sica/i.test(context.plan?.area || "") ? "fisica" : "tae",
        }
      : { ...EMPTY_ERROR, discipline: tabDiscipline });
    setShowForm(true);
    setFeedback("");
  }
  function newBlock() {
    if (params.get("plan") && !context.valid) {
      setFeedback("Escolha um assunto válido do plano antes de registrar o bloco.");
      return;
    }
    const selectedDiscipline = disciplineTab === "Todas" ? "" : disciplineTab;
    setBlockForm(context.valid
      ? {
          ...EMPTY_BLOCK,
          topic: context.title,
          discipline: "",
          area: context.area,
          subject: /f[ií]sica/i.test(context.plan?.area || "") ? "fisica" : "tae",
        }
      : { ...EMPTY_BLOCK, discipline: selectedDiscipline });
    setEditingId("");
    setShowForm(true);
    setFeedback("");
  }
  async function submitBlock(event: FormEvent) {
    event.preventDefault();
    setFeedback("");
    if (context.requested && !context.valid) {
      setFeedback("Assunto indisponível.");
      return;
    }
    if (!blockForm.discipline.trim() || !blockForm.topic.trim()) {
      setFeedback("Preencha disciplina e assunto.");
      return;
    }
    if (!Number.isInteger(blockForm.total) || blockForm.total < 1 || blockForm.total > 500 ||
        !Number.isInteger(blockForm.correct) || blockForm.correct < 0 || blockForm.correct > blockForm.total) {
      setFeedback("Confira o total de questões e a quantidade de acertos.");
      return;
    }
    const record: QuestionBlock = {
      id: crypto.randomUUID(),
      subject: blockForm.subject,
      discipline: blockForm.discipline.trim(),
      area: blockForm.area.trim(),
      topic: blockForm.topic.trim(),
      at: Date.now(),
      total: blockForm.total,
      correct: blockForm.correct,
      note: blockForm.note.trim(),
      ...(context.valid ? { planTopics: [context.ref] } : {}),
    };
    await saveQuestionBlock(record);
    setBlockForm(EMPTY_BLOCK);
    setShowForm(false);
    setFeedback("Bloco de questões registrado.");
    await reload();
  }
  async function removeBlock(id: string) {
    if (!confirm("Excluir este bloco de desempenho?")) return;
    await deleteQuestionBlock(id);
    await reload();
  }
  async function addAttachments(files: FileList | null) {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const invalid = selected.find(file =>
      !(file.type.startsWith("image/") || file.type === "application/pdf" || /\.(png|jpe?g|gif|webp|pdf)$/i.test(file.name))
    );
    if (invalid) {
      setFeedback("Anexe somente imagens ou arquivos PDF.");
      return;
    }
    const currentSize = (form.attachments || []).reduce((sum, file) => sum + file.size, 0);
    const addedSize = selected.reduce((sum, file) => sum + file.size, 0);
    if (currentSize + addedSize > MAX_ATTACHMENT_BYTES) {
      setFeedback("Os anexos deste registro podem somar, no máximo, 5 MB.");
      return;
    }
    try {
      const attachments = await Promise.all(selected.map(async file => ({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
      })));
      setForm(current => ({ ...current, attachments: [...(current.attachments || []), ...attachments] }));
      setFeedback("");
    } catch {
      setFeedback("Não foi possível anexar um dos arquivos. Tente novamente.");
    }
  }
  function removeAttachment(id: string) {
    setForm(current => ({ ...current, attachments: (current.attachments || []).filter(file => file.id !== id) }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setFeedback("");
    if (context.requested && !context.valid) {
      setFeedback("Assunto indisponível.");
      return;
    }
    if (!form.discipline.trim() || !form.area.trim() || !form.topic.trim()) {
      setFeedback("Preencha disciplina, área e assunto.");
      return;
    }
    if (!form.mistake.trim() || !form.fix.trim()) {
      setFeedback("Descreva o erro e sua correção fundamentada.");
      return;
    }
    if (form.questionUrl.trim() && !safeHttpUrl(form.questionUrl)) {
      setFeedback("Informe um link HTTP ou HTTPS válido.");
      return;
    }
    const old = errors.find(item => item.id === editingId);
    const now = Date.now();
    const record: ErrorRecord = {
      id: old?.id || crypto.randomUUID(),
      ...form,
      topic: form.topic.trim(),
      discipline: form.discipline.trim(),
      area: form.area.trim(),
      at: old?.at || now,
      nextReview: old?.nextReview || now + form.reviewDays * DAY,
      successes: old?.successes || 0,
      failures: old?.failures || 0,
      status: old?.status === "dominado" ? "pendente" : old?.status || "pendente",
      history: old?.history || [],
      ...(context.valid ? { planTopics: addTopicLink(old?.planTopics, context.ref) } : old?.planTopics ? { planTopics: old.planTopics } : {}),
    };
    await saveError(record);
    setForm(EMPTY_ERROR);
    setEditingId("");
    setShowForm(false);
    await reload();
    setFeedback("Registro salvo.");
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
      const hadSuccessToday = history.slice(0, -1).some(item =>
        item.grade === "right" && new Date(item.at).toDateString() === new Date(at).toDateString()
      );
      if (!hadSuccessToday) successes += 1;
      reviewDays = REVIEW_STEPS.find(step => step > reviewDays) || 90;
      status = successes >= 2 ? "dominado" : "pendente";
    } else {
      failures += 1;
      successes = 0;
      reviewDays = failures >= 2 ? 1 : 3;
    }
    await saveError({ ...record, history, successes, failures, reviewDays, status, nextReview: at + reviewDays * DAY });
    setApplyId("");
    await reload();
  }
  async function remove(id: string) {
    if (!confirm("Excluir este registro do caderno de erros e seus anexos?")) return;
    await deleteError(id);
    await reload();
  }

  return <div className="stack ritmo-materials rm-errors">
    <header className="heading">
      <div>
        <small>RITMO / PRÁTICA</small>
        <h1>Questões</h1>
        <p>Registre seu desempenho e transforme cada erro em um ponto de aprendizagem.</p>
      </div>
      <button className="primary-button" onClick={() => showForm ? setShowForm(false) : view === "errors" ? newError() : newBlock()}>
        <Plus size={16}/>{showForm ? "Fechar formulário" : view === "errors" ? "Registrar erro" : "Registrar bloco"}
      </button>
    </header>
    {context.requested && <p className="inline-feedback">
      {context.valid ? context.plan?.title + " · " + context.title : "Assunto indisponível ou carregando."}
      {" · "}<Link to={context.returnTo}>Voltar a Aprender</Link>
    </p>}
    {dueOnly && view === "errors" && <p className="inline-feedback">
      Mostrando erros com revisão prevista até agora.{" "}
      <Link to={"/errors?" + new URLSearchParams([...params].filter(([key]) => key !== "due")).toString()}>Ver todos</Link>
    </p>}

    <div className="rm-question-views" role="tablist" aria-label="Área de questões">
      <button type="button" role="tab" aria-selected={view === "errors"} onClick={() => changeView("errors")}>
        <NotebookPen size={15}/> Caderno de erros <small>{scoped.length}</small>
      </button>
      <button type="button" role="tab" aria-selected={view === "performance"} onClick={() => changeView("performance")}>
        <Check size={15}/> Desempenho <small>{scopedBlocks.length}</small>
      </button>
    </div>

    <div className="rm-toolbar rm-error-toolbar">
      <MaterialScopePicker plans={plans} disabled={showForm} onChange={() => { setPhase("all"); setDisciplineTab("Todas"); }}/>
      <label className="rm-error-search">
        <Search size={15}/>
        <input aria-label="Buscar no caderno de erros" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Buscar disciplina, assunto ou erro…"/>
      </label>
      <span className="rm-error-due-count">{view === "errors" ? due + " para retomar" : visibleBlocks.length + " blocos registrados"}</span>
    </div>

    <div className="rm-error-tabs rm-error-discipline-tabs" role="tablist" aria-label="Filtrar por disciplina">
      {disciplineTabs.map(name => {
        const count = view === "errors"
          ? (name === "Todas" ? scoped.length : scoped.filter(error => sameDiscipline(error.discipline, name)).length)
          : (name === "Todas" ? scopedBlocks.length : scopedBlocks.filter(block => sameDiscipline(blockDiscipline(block), name)).length);
        return <button key={name} type="button" role="tab" aria-selected={disciplineTab === name} onClick={() => setDisciplineTab(name)}>
          <span>{name}</span><small>{count}</small>
        </button>;
      })}
    </div>

    {view === "errors" ? <section className="panel rm-error-database">
      <div className="rm-error-filters">
        <div className="rm-error-phase-tabs" aria-label="Filtrar por situação">
          {([
            ["all", "Todos"],
            ["pendente", "Pendentes"],
            ["recuperacao", "Em recuperação"],
            ["superado", "Superados"],
          ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={phase === value} onClick={() => setPhase(value)}>
            {label}<small>{phaseCounts[value]}</small>
          </button>)}
        </div>
        <span>{visible.length} {visible.length === 1 ? "registro" : "registros"}</span>
      </div>

      {showForm && <form className="error-form rm-error-form" onSubmit={submit}>
        <div className="panel-title-row">
          <div>
            <span className="step-kicker">{editingId ? "EDITAR REGISTRO" : "NOVO REGISTRO"}</span>
            <h2>{editingId ? "Atualize o erro" : "O que aconteceu?"}</h2>
            <p>Registre a dificuldade real e a correção que permitirá resolvê-la depois.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Fechar formulário" onClick={() => setShowForm(false)}>×</button>
        </div>
        <div className="form-grid">
          {!context.valid && <div className="field-block">
            <label>Área de estudo</label>
            <select value={form.subject} onChange={event => set("subject", event.target.value as StudySubject)}>
              <option value="tae">Geral</option><option value="fisica">Física</option>
            </select>
          </div>}
          <div className="field-block">
            <label>Tipo de erro</label>
            <select value={form.type} onChange={event => set("type", event.target.value)}>
              {["Lacuna", "Revisar", "Interpretação", "Cálculo", "Distração", "Confusão de conceitos"].map(value => <option key={value}>{value}</option>)}
            </select>
          </div>
          {context.valid
            ? <div className="field-block"><label>Assunto do plano</label><input value={context.title} readOnly/></div>
            : <>
                <div className="field-block">
                  <label>Disciplina *</label>
                  <input list="error-disciplines" value={form.discipline} onChange={event => set("discipline", event.target.value)} placeholder="Ex.: Português"/>
                  <datalist id="error-disciplines">
                    {DISCIPLINE_DEFAULTS.map(value => <option key={value}>{value}</option>)}
                  </datalist>
                </div>
                <div className="field-block"><label>Área / eixo *</label><input value={form.area} onChange={event => set("area", event.target.value)} placeholder="Ex.: Sintaxe, Mecânica"/></div>
                <div className="field-block"><label>Assunto *</label><input value={form.topic} onChange={event => set("topic", event.target.value)} placeholder="Ex.: Período composto, Leis de Newton"/></div>
              </>}
          <div className="field-block">
            <label>Nova questão após</label>
            <select value={form.reviewDays} onChange={event => set("reviewDays", Number(event.target.value))}>
              {REVIEW_STEPS.map(days => <option key={days} value={days}>{days} dia(s)</option>)}
            </select>
          </div>
          <div className="field-block field-span"><label>O que errei? *</label><textarea rows={3} value={form.mistake} onChange={event => set("mistake", event.target.value)} placeholder="Registre o raciocínio que levou ao erro, a confusão ou o ponto que você não sabia."/></div>
          <div className="field-block field-span"><label>O que preciso aprender? *</label><textarea rows={3} value={form.fix} onChange={event => set("fix", event.target.value)} placeholder="Explique a regra, o conceito ou o procedimento correto."/></div>
          <details className="field-span error-extra">
            <summary>Enunciado e alternativas da questão original (opcional)</summary>
            <div className="field-block"><label>Enunciado</label><textarea rows={3} value={form.questionText} onChange={event => set("questionText", event.target.value)} placeholder="Cole o enunciado original."/></div>
            <div className="field-block"><label>Alternativas</label><textarea rows={3} value={form.optionsText} onChange={event => set("optionsText", event.target.value)} placeholder={"A) …\nB) …\nC) …"}/></div>
            <div className="field-block"><label>Gabarito</label><input value={form.correctAnswer} onChange={event => set("correctAnswer", event.target.value)} placeholder="Ex.: C"/></div>
          </details>
          <div className="field-block"><label>Link da questão (opcional)</label><input type="url" value={form.questionUrl} onChange={event => set("questionUrl", event.target.value)} placeholder="https://…"/></div>
          <div className="field-block">
            <label>Vincular a uma família de flashcards (opcional)</label>
            <select value={form.conceptId} onChange={event => set("conceptId", event.target.value)}>
              <option value="">Sem vínculo</option>
              {concepts.filter(concept => context.valid ? linkedTo(concept, context.ref) : concept.subject === form.subject).map(concept => <option key={concept.id} value={concept.id}>{concept.topic}</option>)}
            </select>
          </div>
          <div className="field-block field-span">
            <label>Arquivos e mídia (opcional)</label>
            <div className="rm-attachment-picker">
              <Paperclip size={16}/>
              <span>Imagens ou PDFs · até 5 MB por registro</span>
              <label className="secondary-button compact" htmlFor="error-attachments">Anexar</label>
              <input id="error-attachments" type="file" accept="image/*,application/pdf" multiple onChange={event => { void addAttachments(event.target.files); event.target.value = ""; }}/>
            </div>
            {!!form.attachments.length && <div className="rm-attachment-list">
              {form.attachments.map(file => <span className="rm-attachment-chip" key={file.id}>
                <a href={file.dataUrl} target="_blank" rel="noreferrer" download={file.name}>{file.name}</a>
                <button type="button" aria-label={"Remover " + file.name} onClick={() => removeAttachment(file.id)}>×</button>
              </span>)}
            </div>}
          </div>
        </div>
        {feedback && <p className="inline-feedback" role="alert">{feedback}</p>}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button>
          <button className="primary-button" type="submit">Salvar registro <Check size={15}/></button>
        </div>
      </form>}

      {!showForm && feedback && <p className="inline-feedback">{feedback}</p>}
      {visible.length ? <div className="rm-error-table-scroll">
        <table className="rm-error-table">
          <thead><tr>
            <th>Data</th><th>Tipo</th><th>Disciplina</th><th>Área</th><th>Assunto</th>
            <th>Erro</th><th>Correção</th><th>Revisão</th><th>Próxima revisão</th><th>Questão</th><th>Arquivos</th><th>Ações</th>
          </tr></thead>
          <tbody>{visible.map(error => {
            const concept = concepts.find(item => item.id === error.conceptId);
            const questionLink = safeHttpUrl(error.questionUrl);
            const attachments = error.attachments || [];
            const stage = errorStage(error);
            return <Fragment key={error.id}>
              <tr key={error.id}>
                <td className="rm-nowrap">{shortDateLabel(error.at)}</td>
                <td><span className="rm-error-type">{error.type}</span></td>
                <td><strong className="rm-error-discipline">{error.discipline || "—"}</strong></td>
                <td>{error.area || "—"}</td>
                <td><strong>{error.topic}</strong>{concept && <small className="rm-error-subject">Flashcard: {concept.topic}</small>}</td>
                <td><div className="rm-error-cell-text">{error.mistake}</div></td>
                <td><div className="rm-error-cell-text">{error.fix}</div></td>
                <td className="rm-nowrap">{error.reviewDays}d</td>
                <td><span className={"rm-review-state " + (stage === "superado" ? "done" : isDue(error) ? "due" : "scheduled")}>
                  {stage === "superado" ? "Superado" : isDue(error) ? "Retomar agora" : shortDateLabel(error.nextReview)}
                </span></td>
                <td>
                  {questionLink ? <a className="rm-question-link" href={questionLink} target="_blank" rel="noreferrer">Abrir questão <ExternalLink size={12}/></a> : <span>—</span>}
                  {error.questionText && <details className="rm-table-details"><summary>Enunciado</summary><p>{error.questionText}{error.optionsText ? "\n\n" + error.optionsText : ""}{error.correctAnswer ? "\nGabarito: " + error.correctAnswer : ""}</p></details>}
                </td>
                <td>
                  {attachments.length ? <details className="rm-table-details">
                    <summary><Paperclip size={12}/> {attachments.length} {attachments.length === 1 ? "arquivo" : "arquivos"}</summary>
                    <div className="rm-table-attachments">{attachments.map(file => <a key={file.id} href={file.dataUrl} target="_blank" rel="noreferrer" download={file.name}>{file.name}</a>)}</div>
                  </details> : <span>—</span>}
                </td>
                <td>
                  <div className="rm-error-row-actions">
                    <button className="text-button" onClick={() => edit(error)}>Editar</button>
                    <button className="text-button" onClick={() => setApplyId(applyId === error.id ? "" : error.id)}>Aplicar</button>
                    <button className="icon-button" aria-label="Excluir registro" onClick={() => remove(error.id)}><Trash2 size={14}/></button>
                  </div>
                </td>
              </tr>
              {applyId === error.id && <tr key={error.id + "-apply"} className="rm-error-expanded-row"><td colSpan={12}>
                <div className="rm-apply-panel">
                  <div><strong>Resolva uma questão inédita sobre este assunto.</strong><p>O resultado desta aplicação não altera o FSRS dos flashcards.</p></div>
                  {questionLink && <a href={questionLink} target="_blank" rel="noreferrer">Consultar questão original <ExternalLink size={12}/></a>}
                  <div className="button-row">
                    <button className="secondary-button compact" onClick={() => gradeApplication(error.id, "wrong")}>Errei novamente</button>
                    <button className="primary-button compact" onClick={() => gradeApplication(error.id, "right")}>Acertei uma inédita <Check size={14}/></button>
                  </div>
                </div>
              </td></tr>}
              {error.history.length > 0 && <tr key={error.id + "-history"} className="rm-error-history-row"><td colSpan={12}>
                <details><summary>Histórico de aplicações ({error.history.length}) · {error.successes} acerto(s) · {error.failures} novo(s) erro(s)</summary>
                  {error.history.map((entry, index) => <span key={index}>{dateLabel(entry.at)} · {entry.grade === "right" ? "Acerto em questão inédita" : "Erro novamente"}</span>)}
                </details>
              </td></tr>}
            </Fragment>;
          })}</tbody>
        </table>
      </div> : <div className="rm-error-empty">
        <NotebookPen size={26}/>
        <strong>{scoped.length ? "Nenhum registro neste filtro" : "Seu caderno começa aqui"}</strong>
        <span>{scoped.length ? "Experimente outra disciplina, situação ou termo de busca." : "Registre uma questão errada ou uma lacuna, explique a correção e acompanhe quando retomar."}</span>
        {!scoped.length && <button className="primary-button" onClick={newError}>Registrar primeiro erro</button>}
      </div>}
    </section> : <section className="panel rm-error-database rm-performance-database">
      <div className="rm-performance-summary">
        <div><small>QUESTÕES RESOLVIDAS</small><strong>{questionTotal}</strong></div>
        <div><small>ACERTOS</small><strong>{correctTotal}</strong></div>
        <div><small>APROVEITAMENTO</small><strong>{accuracy}%</strong></div>
      </div>
      {showForm && <form className="error-form rm-error-form rm-performance-form" onSubmit={submitBlock}>
        <div className="panel-title-row">
          <div><span className="step-kicker">NOVO REGISTRO DE DESEMPENHO</span><h2>Como foi sua sessão?</h2><p>Registre os resultados por disciplina e assunto. Os blocos antigos continuam disponíveis.</p></div>
          <button className="icon-button" type="button" aria-label="Fechar formulário" onClick={() => setShowForm(false)}>×</button>
        </div>
        <div className="form-grid">
          <div className="field-block"><label>Área de estudo</label><select value={blockForm.subject} onChange={event => setBlock("subject", event.target.value as StudySubject)}><option value="tae">Geral</option><option value="fisica">Física</option></select></div>
          <div className="field-block"><label>Disciplina *</label><input list="performance-disciplines" value={blockForm.discipline} onChange={event => setBlock("discipline", event.target.value)} placeholder="Ex.: Português"/><datalist id="performance-disciplines">{DISCIPLINE_DEFAULTS.map(value => <option key={value}>{value}</option>)}</datalist></div>
          <div className="field-block"><label>Área / eixo</label><input value={blockForm.area} onChange={event => setBlock("area", event.target.value)} placeholder="Ex.: Sintaxe, Mecânica"/></div>
          <div className="field-block"><label>Assunto *</label><input value={blockForm.topic} onChange={event => setBlock("topic", event.target.value)} placeholder="Ex.: Concordância nominal"/></div>
          <div className="field-block"><label>Questões resolvidas *</label><input type="number" min={1} max={500} value={blockForm.total} onChange={event => setBlock("total", Number(event.target.value))}/></div>
          <div className="field-block"><label>Acertos *</label><input type="number" min={0} max={500} value={blockForm.correct} onChange={event => setBlock("correct", Number(event.target.value))}/></div>
          <div className="field-block field-span"><label>Observação (opcional)</label><textarea rows={2} value={blockForm.note} onChange={event => setBlock("note", event.target.value)} placeholder="Banca, dificuldade, padrão dos erros…"/></div>
        </div>
        {feedback && <p className="inline-feedback" role="alert">{feedback}</p>}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar desempenho <Check size={15}/></button></div>
      </form>}
      <div className="rm-error-filters"><span>{visibleBlocks.length} {visibleBlocks.length === 1 ? "bloco registrado" : "blocos registrados"}</span></div>
      {visibleBlocks.length ? <div className="rm-error-table-scroll">
        <table className="rm-error-table rm-performance-table">
          <thead><tr><th>Data</th><th>Disciplina</th><th>Área / eixo</th><th>Assunto</th><th>Questões</th><th>Acertos</th><th>Aproveitamento</th><th>Observação</th><th>Ações</th></tr></thead>
          <tbody>{visibleBlocks.map(block => <tr key={block.id}>
            <td className="rm-nowrap">{shortDateLabel(block.at)}</td>
            <td><strong>{blockDiscipline(block)}</strong></td>
            <td>{block.area || "—"}</td>
            <td><strong>{block.topic}</strong></td>
            <td className="rm-nowrap">{block.total}</td>
            <td className="rm-nowrap">{block.correct}</td>
            <td className="rm-nowrap">{block.total ? Math.round(block.correct / block.total * 100) : 0}%</td>
            <td><div className="rm-error-cell-text">{block.note || "—"}</div></td>
            <td><button className="icon-button" aria-label="Excluir bloco" onClick={() => removeBlock(block.id)}><Trash2 size={14}/></button></td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="rm-error-empty"><Target size={26}/><strong>{scopedBlocks.length ? "Nenhum bloco neste filtro" : "Seu desempenho começa aqui"}</strong><span>{scopedBlocks.length ? "Experimente outra disciplina ou plano." : "Registre a quantidade de questões resolvidas e acertos para acompanhar sua evolução."}</span><button className="primary-button" onClick={newBlock}>Registrar primeiro bloco</button></div>}
    </section>}
  </div>;
}
