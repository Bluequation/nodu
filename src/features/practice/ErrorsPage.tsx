import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bell, BellOff, BellRing, ChevronDown, ChevronUp, ExternalLink,
  FileText, Image as ImageIcon, NotebookPen, Paperclip, Plus, Search,
  Settings2, Trash2, X,
} from "lucide-react";
import type {
  ErrorAttachment, ErrorNotebookColumn, ErrorNotebookSettings,
  ErrorRecord, StudySubject,
} from "../../domain/study";
import {
  deleteError, getErrorNotebookSettings, listErrors,
  saveError, saveErrorNotebookSettings,
} from "../../data/study";
import { addTopicLink, linkedTo } from "../../domain/topicContext";
import { useStudyContext } from "../study/useStudyContext";
import "../study/materials.css";

const DAY = 86_400_000;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const REVIEW_STEPS = [1, 3, 7, 15, 30, 60, 90];
const DISCIPLINE_DEFAULTS = [
  "Física",
  "Português",
  "Legislação",
  "Administração Pública",
  "Conhecimentos Pedagógicos",
  "Dados e Indicadores",
  "Matemática",
  "Geral",
];
const ERROR_TYPES = [
  "Chute",
  "Falta de atenção",
  "Falha de memória",
  "Interpretação",
  "Cálculo",
  "Desconhecimento",
  "Confusão conceitual",
  "Pressa",
  "Leitura desatenta",
  "Lacuna de conteúdo",
  "Outro",
];
const EMPTY_SETTINGS: ErrorNotebookSettings = { columns: [], disciplines: [] };

function dateInputValue(value: number) {
  const date = new Date(value || Date.now());
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
function dateFromInput(value: string) {
  if (!value) return Date.now();
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}
function shortDate(value: number) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function sameDiscipline(a: string, b: string) {
  return a.trim().localeCompare(b.trim(), "pt-BR", { sensitivity: "base" }) === 0;
}
function recordDiscipline(error: ErrorRecord) {
  return error.discipline?.trim() || (error.subject === "fisica" ? "Física" : "Geral");
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
function isDue(error: ErrorRecord) {
  return error.status !== "dominado" && error.nextReview <= Date.now();
}
function reviewState(value: number) {
  const today = dateInputValue(Date.now());
  const target = dateInputValue(value);
  if (target < today) return "Atrasada";
  if (target === today) return "Hoje";
  return "Agendada";
}

export function ErrorsPage() {
  const context = useStudyContext();
  const [params] = useSearchParams();
  const dueOnly = params.get("due") === "1";
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const errorsRef = useRef<ErrorRecord[]>([]);
  const settingsRef = useRef<ErrorNotebookSettings>(EMPTY_SETTINGS);
  const [settings, setSettings] = useState<ErrorNotebookSettings>(EMPTY_SETTINGS);
  const [disciplineTab, setDisciplineTab] = useState("Todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [lastSavedId, setLastSavedId] = useState("");
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [alarmPermission, setAlarmPermission] = useState<NotificationPermission | "unsupported">(
    () => typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  async function reload() {
    const [nextErrors, nextSettings] = await Promise.all([listErrors(), getErrorNotebookSettings()]);
    errorsRef.current = nextErrors;
    settingsRef.current = nextSettings;
    setErrors(nextErrors);
    setSettings(nextSettings);
    setLoading(false);
  }
  useEffect(() => { void reload(); }, []);

  const scopedErrors = context.requested
    ? context.valid ? errors.filter(error => linkedTo(error, context.ref)) : []
    : errors;
  const disciplines = [
    "Todas",
    ...DISCIPLINE_DEFAULTS,
    ...settings.disciplines,
    ...errors.map(recordDiscipline),
  ].filter((name, index, all) =>
    all.findIndex(item => sameDiscipline(item, name)) === index
  );
  const tabErrors = scopedErrors.filter(error =>
    disciplineTab === "Todas" || sameDiscipline(recordDiscipline(error), disciplineTab)
  );
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");
  const visible = tabErrors
    .filter(error => !dueOnly || isDue(error))
    .filter(error => {
      if (!normalizedSearch) return true;
      const custom = Object.values(error.customFields || {}).join(" ");
      const haystack = [
        recordDiscipline(error), error.type, error.area, error.topic,
        error.mistake, error.fix, error.questionUrl, custom,
      ].join(" ").toLocaleLowerCase("pt-BR");
      return haystack.includes(normalizedSearch);
    })
    .sort((a, b) => b.at - a.at);
  const dueCount = tabErrors.filter(isDue).length;
  const columns = settings.columns.filter(column =>
    column.kind !== "discipline" || disciplineTab === "Todas"
  );

  function checkDueNotifications() {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const error of errorsRef.current) {
      if (error.status === "dominado" || error.nextReview > Date.now()) continue;
      const key = "ritmo:error-reminder:" + error.id + ":" + dateInputValue(error.nextReview);
      try {
        if (localStorage.getItem(key)) continue;
        new Notification("Hora de retomar uma questão", {
          body: [recordDiscipline(error), error.topic || "Questão sem assunto"].filter(Boolean).join(" · "),
          tag: key,
        });
        localStorage.setItem(key, "1");
      } catch {
        // The table still shows the due reminder if browser notifications are unavailable.
      }
    }
  }
  useEffect(() => {
    checkDueNotifications();
    const timer = window.setInterval(checkDueNotifications, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function updateError(id: string, patch: Partial<ErrorRecord>) {
    const current = errorsRef.current.find(item => item.id === id);
    if (!current) return;
    const next: ErrorRecord = { ...current, ...patch };
    if (patch.discipline !== undefined) {
      next.subject = sameDiscipline(patch.discipline, "Física") ? "fisica" : "tae";
    }
    if (patch.reviewDays !== undefined && patch.nextReview === undefined) {
      next.nextReview = Date.now() + Number(patch.reviewDays) * DAY;
    }
    const nextErrors = errorsRef.current.map(item => item.id === id ? next : item);
    errorsRef.current = nextErrors;
    setErrors(nextErrors);
    setLastSavedId("");
    try {
      await saveError(next);
      setLastSavedId(id);
      setFeedback("");
    } catch {
      setFeedback("Não foi possível salvar uma alteração. Tente novamente.");
    }
  }
  function saveColumnSettings(next: ErrorNotebookSettings) {
    settingsRef.current = next;
    setSettings(next);
    void saveErrorNotebookSettings(next);
  }
  function draftColumnLabel(id: string, label: string) {
    const next = {
      ...settingsRef.current,
      columns: settingsRef.current.columns.map(column =>
        column.id === id ? { ...column, label } : column
      ),
    };
    settingsRef.current = next;
    setSettings(next);
  }
  function moveColumn(id: string, direction: -1 | 1) {
    const next = [...settingsRef.current.columns];
    const index = next.findIndex(column => column.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    saveColumnSettings({ ...settingsRef.current, columns: next });
  }
  function addColumn() {
    const label = newColumnName.trim();
    if (!label) return;
    const column: ErrorNotebookColumn = {
      id: "custom-" + crypto.randomUUID(),
      label,
      kind: "custom",
      custom: true,
    };
    saveColumnSettings({
      ...settingsRef.current,
      columns: [...settingsRef.current.columns, column],
    });
    setNewColumnName("");
  }
  async function removeColumn(column: ErrorNotebookColumn) {
    if (!column.custom || !confirm("Excluir a coluna " + column.label + "? Os valores dessa coluna também serão removidos.")) return;
    const nextSettings = {
      ...settingsRef.current,
      columns: settingsRef.current.columns.filter(item => item.id !== column.id),
    };
    saveColumnSettings(nextSettings);
    const nextErrors = errorsRef.current.map(error => {
      if (!error.customFields || !(column.id in error.customFields)) return error;
      const customFields = { ...error.customFields };
      delete customFields[column.id];
      return { ...error, customFields };
    });
    errorsRef.current = nextErrors;
    setErrors(nextErrors);
    await Promise.all(nextErrors.map(error => saveError(error)));
  }
  function addDiscipline() {
    const value = window.prompt("Nome da nova disciplina:");
    const name = value?.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (disciplines.some(item => sameDiscipline(item, name))) {
      setDisciplineTab(disciplines.find(item => sameDiscipline(item, name)) || name);
      return;
    }
    const next = {
      ...settingsRef.current,
      disciplines: [...settingsRef.current.disciplines, name],
    };
    saveColumnSettings(next);
    setDisciplineTab(name);
  }

  async function addRow() {
    if (context.requested && !context.valid) {
      setFeedback("O assunto do plano ainda não está disponível.");
      return;
    }
    const discipline = disciplineTab === "Todas" ? "" : disciplineTab;
    const now = Date.now();
    const subject: StudySubject = sameDiscipline(discipline, "Física") ? "fisica" : "tae";
    const record: ErrorRecord = {
      id: crypto.randomUUID(),
      subject,
      discipline,
      area: context.valid ? context.area : "",
      topic: context.valid ? context.title : "",
      type: "",
      mistake: "",
      fix: "",
      reviewDays: 15,
      questionUrl: "",
      conceptId: "",
      questionText: "",
      optionsText: "",
      correctAnswer: "",
      at: now,
      nextReview: now + 15 * DAY,
      successes: 0,
      failures: 0,
      status: "pendente",
      history: [],
      attachments: [],
      customFields: {},
      ...(context.valid ? { planTopics: addTopicLink([], context.ref) } : {}),
    };
    const nextErrors = [record, ...errorsRef.current];
    errorsRef.current = nextErrors;
    setErrors(nextErrors);
    await saveError(record);
    setLastSavedId(record.id);
    setFeedback("Nova linha criada. Preencha as células diretamente na tabela.");
  }
  async function removeRow(id: string) {
    if (!confirm("Excluir este registro e seus anexos?")) return;
    await deleteError(id);
    const nextErrors = errorsRef.current.filter(item => item.id !== id);
    errorsRef.current = nextErrors;
    setErrors(nextErrors);
    setLastSavedId("");
  }
  async function addAttachments(id: string, files: FileList | null) {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const current = errorsRef.current.find(item => item.id === id);
    if (!current) return;
    const invalid = selected.find(file =>
      !(file.type.startsWith("image/") || file.type === "application/pdf" || /\.(png|jpe?g|gif|webp|pdf)$/i.test(file.name))
    );
    if (invalid) {
      setFeedback("Anexe somente imagens ou arquivos PDF.");
      return;
    }
    const currentSize = (current.attachments || []).reduce((sum, file) => sum + file.size, 0);
    const addedSize = selected.reduce((sum, file) => sum + file.size, 0);
    if (currentSize + addedSize > MAX_ATTACHMENT_BYTES) {
      setFeedback("Os anexos de cada registro podem somar, no máximo, 5 MB.");
      return;
    }
    try {
      const attachments: ErrorAttachment[] = await Promise.all(selected.map(async file => ({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
      })));
      await updateError(id, { attachments: [...(current.attachments || []), ...attachments] });
    } catch {
      setFeedback("Não foi possível anexar um dos arquivos. Tente novamente.");
    }
  }
  async function removeAttachment(id: string, attachmentId: string) {
    const current = errorsRef.current.find(item => item.id === id);
    if (!current) return;
    await updateError(id, {
      attachments: (current.attachments || []).filter(file => file.id !== attachmentId),
    });
  }
  async function enableAlarms() {
    if (typeof Notification === "undefined") {
      setAlarmPermission("unsupported");
      setFeedback("Este navegador não oferece notificações para o Ritmo.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setAlarmPermission(permission);
      if (permission === "granted") {
        checkDueNotifications();
        setFeedback("Alarmes ativados. O Ritmo avisará quando uma revisão vencer enquanto estiver aberto.");
      } else {
        setFeedback("A permissão de notificações não foi concedida. As datas continuam visíveis no caderno.");
      }
    } catch {
      setFeedback("Não foi possível ativar as notificações neste navegador.");
    }
  }

  function renderCell(error: ErrorRecord, column: ErrorNotebookColumn) {
    const common = { "data-row-id": error.id, "data-column": column.id };
    switch (column.kind) {
      case "date":
        return <input {...common} className="rm-cell-input rm-cell-date" type="date"
          aria-label={column.label} defaultValue={dateInputValue(error.at)}
          onBlur={event => void updateError(error.id, { at: dateFromInput(event.currentTarget.value) })}/>;
      case "type":
        return <input {...common} className="rm-cell-input" list="rm-error-types"
          aria-label={column.label} defaultValue={error.type}
          placeholder="Tipo de erro" onBlur={event => void updateError(error.id, { type: event.currentTarget.value })}/>;
      case "discipline":
        return <select {...common} className="rm-cell-select" aria-label={column.label}
          defaultValue={error.discipline} onChange={event => void updateError(error.id, { discipline: event.currentTarget.value })}>
          <option value="">Selecionar disciplina</option>
          {disciplines.filter(name => name !== "Todas").map(name => <option key={name} value={name}>{name}</option>)}
        </select>;
      case "text":
        return <input {...common} className="rm-cell-input" aria-label={column.label}
          defaultValue={column.id === "area" ? error.area : error.topic}
          placeholder={column.id === "area" ? "Área / eixo" : "Assunto"}
          onBlur={event => void updateError(error.id, column.id === "area"
            ? { area: event.currentTarget.value } : { topic: event.currentTarget.value })}/>;
      case "longtext":
        return <textarea {...common} className="rm-cell-textarea" rows={2}
          aria-label={column.label}
          defaultValue={column.id === "mistake" ? error.mistake : column.id === "fix" ? error.fix : error.customFields?.[column.id] || ""}
          placeholder={column.id === "mistake" ? "O que levou ao erro?" : "Qual é o raciocínio correto?"}
          onBlur={event => void updateError(error.id, column.id === "mistake"
            ? { mistake: event.currentTarget.value }
            : column.id === "fix" ? { fix: event.currentTarget.value }
              : { customFields: { ...(error.customFields || {}), [column.id]: event.currentTarget.value } })}/>;
      case "interval":
        return <select {...common} className="rm-cell-select rm-cell-interval"
          aria-label={column.label} value={error.reviewDays || 15}
          onChange={event => void updateError(error.id, { reviewDays: Number(event.currentTarget.value) })}>
          {![...REVIEW_STEPS].includes(error.reviewDays) && <option value={error.reviewDays}>{error.reviewDays} dias</option>}
          {REVIEW_STEPS.map(days => <option key={days} value={days}>{days} dias</option>)}
        </select>;
      case "reviewDate":
        return <div className="rm-cell-review-date" data-column={column.id}>
          <Bell size={13} aria-hidden="true"/>
          <input {...common} className="rm-cell-input rm-cell-date" type="date"
            aria-label={column.label} defaultValue={dateInputValue(error.nextReview)}
            onBlur={event => void updateError(error.id, { nextReview: dateFromInput(event.currentTarget.value) })}/>
          <small className={isDue(error) ? "is-due" : "is-scheduled"}>{reviewState(error.nextReview)}</small>
        </div>;
      case "url":
        return <div className="rm-cell-url">
          <input {...common} className="rm-cell-input" type="url" aria-label={column.label}
            defaultValue={error.questionUrl} placeholder="https://..."
            onBlur={event => {
              const value = event.currentTarget.value.trim();
              if (value && !safeHttpUrl(value)) {
                setFeedback("Use um endereço HTTP ou HTTPS válido para a questão.");
                return;
              }
              void updateError(error.id, { questionUrl: value });
            }}/>
          {safeHttpUrl(error.questionUrl) && <a href={safeHttpUrl(error.questionUrl)} target="_blank" rel="noreferrer" title="Abrir questão"><ExternalLink size={13}/></a>}
        </div>;
      case "attachment":
        return <div className="rm-cell-attachments">
          <label className="rm-cell-attach-button" htmlFor={"rm-attach-" + error.id} title="Anexar imagem ou PDF">
            <Paperclip size={14}/><span>Anexar</span>
          </label>
          <input id={"rm-attach-" + error.id} type="file" accept="image/*,application/pdf" multiple
            onChange={event => { void addAttachments(error.id, event.currentTarget.files); event.currentTarget.value = ""; }}/>
          <div className="rm-cell-attachment-list">
            {(error.attachments || []).map(file => <span className="rm-cell-attachment" key={file.id}>
              <a href={file.dataUrl} target="_blank" rel="noreferrer" download={file.name}
                title={file.name}>{file.type === "application/pdf" ? <FileText size={12}/> : <ImageIcon size={12}/>}
                <span>{file.name}</span></a>
              <button type="button" aria-label={"Remover " + file.name}
                onClick={() => void removeAttachment(error.id, file.id)}><X size={11}/></button>
            </span>)}
          </div>
        </div>;
      case "custom":
        return <input {...common} className="rm-cell-input" aria-label={column.label}
          defaultValue={error.customFields?.[column.id] || ""} placeholder="Preencher"
          onBlur={event => void updateError(error.id, {
            customFields: { ...(error.customFields || {}), [column.id]: event.currentTarget.value },
          })}/>;
      default:
        return <span>—</span>;
    }
  }

  return <div className="stack ritmo-materials rm-errors rm-notion-errors">
    <header className="heading">
      <div>
        <small>RITMO / PRÁTICA</small>
        <h1>Caderno de erros</h1>
        <p>Seu banco pessoal de questões: registre, corrija e programe quando retomar.</p>
      </div>
      <div className="rm-notebook-header-actions">
        <button className="secondary-button" type="button" onClick={() => setShowColumnSettings(value => !value)}>
          <Settings2 size={15}/>{showColumnSettings ? "Fechar propriedades" : "Propriedades"}
        </button>
        <button className="primary-button" type="button" onClick={() => void addRow()}>
          <Plus size={16}/>Nova linha
        </button>
      </div>
    </header>

    {context.requested && <p className="inline-feedback">
      {context.valid ? context.plan?.title + " · " + context.title : "Assunto do plano indisponível ou carregando."}
      {" · "}<Link to={context.returnTo}>Voltar a Aprender</Link>
    </p>}
    {dueOnly && <p className="inline-feedback">
      Mostrando registros com revisão prevista até agora.{" "}
      <Link to="/errors">Ver todos</Link>
    </p>}

    <div className="rm-notebook-toolbar">
      <label className="rm-error-search">
        <Search size={15}/>
        <input aria-label="Buscar no caderno" value={searchTerm}
          onChange={event => setSearchTerm(event.target.value)}
          placeholder="Buscar assunto, erro, tipo ou correção..."/>
      </label>
      <div className="rm-notebook-summary">
        <span>{scopedErrors.length} {scopedErrors.length === 1 ? "registro" : "registros"}</span>
        <span className="rm-notebook-due">{dueCount} para retomar</span>
        <button type="button" className={"rm-alarm-button " + (alarmPermission === "granted" ? "is-active" : "")}
          onClick={() => void enableAlarms()}
          title="Notificações quando a data de revisão chegar. O Ritmo precisa estar aberto.">
          {alarmPermission === "granted" ? <BellRing size={15}/> : alarmPermission === "denied" ? <BellOff size={15}/> : <Bell size={15}/>}
          {alarmPermission === "granted" ? "Alarmes ativos" : alarmPermission === "denied" ? "Notificações bloqueadas" : "Ativar alarmes"}
        </button>
      </div>
    </div>

    {showColumnSettings && <section className="rm-column-settings">
      <div className="rm-column-settings-heading">
        <div><strong>Propriedades da tabela</strong><span>Renomeie, reorganize ou adicione colunas. As alterações ficam salvas neste dispositivo.</span></div>
        <button type="button" className="icon-button" aria-label="Fechar propriedades" onClick={() => setShowColumnSettings(false)}><X size={15}/></button>
      </div>
      <div className="rm-column-settings-list">
        {settings.columns.map((column, index) => <div className="rm-column-setting-row" key={column.id}>
          <input aria-label={"Nome da coluna " + column.label} value={column.label}
            onChange={event => draftColumnLabel(column.id, event.currentTarget.value)}
            onBlur={() => void saveErrorNotebookSettings(settingsRef.current)}/>
          <span>{column.custom ? "Personalizada" : "Padrão"}</span>
          <div>
            <button type="button" className="icon-button" title="Mover para cima" aria-label="Mover para cima"
              disabled={index === 0} onClick={() => moveColumn(column.id, -1)}><ChevronUp size={14}/></button>
            <button type="button" className="icon-button" title="Mover para baixo" aria-label="Mover para baixo"
              disabled={index === settings.columns.length - 1} onClick={() => moveColumn(column.id, 1)}><ChevronDown size={14}/></button>
            {column.custom && <button type="button" className="icon-button danger" title="Excluir coluna" aria-label="Excluir coluna"
              onClick={() => void removeColumn(column)}><Trash2 size={14}/></button>}
          </div>
        </div>)}
      </div>
      <div className="rm-add-column-row">
        <input value={newColumnName} onChange={event => setNewColumnName(event.currentTarget.value)}
          onKeyDown={event => { if (event.key === "Enter") addColumn(); }}
          placeholder="Nome da nova coluna..."/>
        <button type="button" className="secondary-button compact" onClick={addColumn} disabled={!newColumnName.trim()}>
          <Plus size={14}/>Adicionar coluna
        </button>
      </div>
    </section>}

    <div className="rm-error-tabs rm-notebook-discipline-tabs" role="tablist" aria-label="Disciplinas do caderno">
      {disciplines.map(name => {
        const count = name === "Todas"
          ? scopedErrors.length
          : scopedErrors.filter(error => sameDiscipline(recordDiscipline(error), name)).length;
        return <button key={name} type="button" role="tab" aria-selected={disciplineTab === name}
          onClick={() => setDisciplineTab(name)}>
          <span>{name}</span><small>{count}</small>
        </button>;
      })}
      <button type="button" className="rm-add-discipline" onClick={addDiscipline}><Plus size={13}/> Disciplina</button>
    </div>

    <section className="panel rm-error-database rm-notion-database">
      <div className="rm-notion-database-head">
        <div><strong>{disciplineTab === "Todas" ? "Todos os registros" : disciplineTab}</strong>
          <span>{visible.length} {visible.length === 1 ? "linha" : "linhas"} · edição direta nas células</span></div>
        <button type="button" className="secondary-button compact" onClick={() => void addRow()}><Plus size={14}/>Nova linha</button>
      </div>
      {feedback && <p className="rm-notebook-feedback" role="status">{feedback}</p>}
      {loading ? <div className="rm-error-empty">Carregando seu caderno...</div> :
        <div className="rm-error-table-scroll rm-notion-table-scroll">
          <table className="rm-error-table rm-notion-table">
            <thead><tr>
              {columns.map(column => <th key={column.id} data-column={column.id}>
                <span>{column.label}</span>
                <small title="Edite o nome em Propriedades">✎</small>
              </th>)}
              <th className="rm-notion-actions-heading">Ações</th>
            </tr></thead>
            <tbody>
              {visible.map(error => <tr key={error.id} className={isDue(error) ? "rm-notion-row-due" : ""}>
                {columns.map(column => <td key={column.id} data-column={column.id}>
                  {renderCell(error, column)}
                </td>)}
                <td className="rm-notion-actions">
                  {lastSavedId === error.id && <small className="rm-row-saved">Salvo</small>}
                  <button type="button" className="icon-button danger" title="Excluir registro"
                    aria-label="Excluir registro" onClick={() => void removeRow(error.id)}><Trash2 size={14}/></button>
                </td>
              </tr>)}
              {!visible.length && <tr><td colSpan={columns.length + 1} className="rm-notion-empty">
                <NotebookPen size={25}/>
                <strong>{scopedErrors.length ? "Nenhum registro nesta visualização" : "Seu caderno começa aqui"}</strong>
                <span>{scopedErrors.length ? "Experimente outra disciplina ou termo de busca." : "Adicione uma linha e preencha cada informação diretamente na tabela."}</span>
                {!scopedErrors.length && <button type="button" className="primary-button" onClick={() => void addRow()}><Plus size={15}/>Adicionar primeira linha</button>}
              </td></tr>}
            </tbody>
          </table>
        </div>
      }
      <div className="rm-notion-table-footer">
        <button type="button" onClick={() => void addRow()}><Plus size={14}/> Nova linha</button>
        <span>Os campos são salvos automaticamente ao sair de cada célula.</span>
      </div>
    </section>

    <datalist id="rm-error-types">
      {ERROR_TYPES.map(type => <option key={type} value={type}/>)}
    </datalist>
    <p className="rm-notebook-note"><Bell size={13}/> Os alarmes aparecem como notificações enquanto o Ritmo estiver aberto. A data e o estado da revisão permanecem registrados no caderno.</p>
  </div>;
}
