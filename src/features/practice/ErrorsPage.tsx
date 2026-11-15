import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bell, BellOff, BellRing, Check, ChevronDown, ChevronUp, ExternalLink,
  FileText, Image as ImageIcon, NotebookPen, Paperclip, Plus, Search,
  Pencil, Settings2, Trash2, X,
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
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}
function addCalendarDays(value: number, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function sameDiscipline(a: string, b: string) {
  return a.trim().localeCompare(b.trim(), "pt-BR", { sensitivity: "base" }) === 0;
}
function uniqueLabels(values: string[]) {
  const unique: string[] = [];
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, " ");
    if (value && !unique.some(item => sameDiscipline(item, value))) unique.push(value);
  }
  return unique.sort((a, b) => a.localeCompare(b, "pt-BR"));
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
  return error.status !== "dominado" && dateInputValue(error.nextReview) <= dateInputValue(Date.now());
}
function reviewState(value: number) {
  const today = dateInputValue(Date.now());
  const target = dateInputValue(value);
  if (target < today) return "Atrasada";
  if (target === today) return "Hoje";
  return "Agendada";
}

function disciplineTone(name: string) {
  const value = name.trim().toLocaleLowerCase("pt-BR");
  if (value === "todas") return "all";
  if (value.includes("física")) return "physics";
  if (value.includes("portugu")) return "language";
  if (value.includes("legisla")) return "law";
  if (value.includes("administra")) return "administration";
  if (value.includes("pedag")) return "pedagogy";
  if (value.includes("dados") || value.includes("indicadores")) return "data";
  if (value.includes("matem")) return "math";
  return "neutral";
}

function errorTypeTone(type: string) {
  const value = type.toLocaleLowerCase("pt-BR");
  if (value.includes("chute") || value.includes("pressa")) return "amber";
  if (value.includes("atenção") || value.includes("leitura")) return "orange";
  if (value.includes("memória")) return "violet";
  if (value.includes("interpretação")) return "blue";
  if (value.includes("cálculo")) return "teal";
  if (value.includes("desconhecimento") || value.includes("lacuna")) return "rose";
  if (value.includes("confusão")) return "purple";
  return "neutral";
}

type CellAttributes = { "data-row-id": string; "data-column": string };
type CreatableCellProps = {
  common: CellAttributes;
  value: string;
  options: string[];
  tone: string;
  label: string;
  placeholder: string;
  onCommit: (value: string) => void;
};

function CreatableCell({ common, value, options, tone, label, placeholder, onCommit }: CreatableCellProps) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const committed = useRef(value);
  useEffect(() => {
    setDraft(value);
    committed.current = value;
  }, [value]);

  const normalized = draft.trim().replace(/\s+/g, " ");
  const matches = options.filter(option =>
    option.toLocaleLowerCase("pt-BR").includes(normalized.toLocaleLowerCase("pt-BR"))
  ).slice(0, 6);
  const exact = options.some(option => option.localeCompare(normalized, "pt-BR", { sensitivity: "base" }) === 0);
  const canCreate = Boolean(normalized && !exact);
  const itemCount = matches.length + (canCreate ? 1 : 0);

  function commit(nextValue: string) {
    const next = nextValue.trim().replace(/\s+/g, " ");
    setDraft(next);
    setOpen(false);
    if (next !== committed.current) {
      committed.current = next;
      onCommit(next);
    }
  }

  return <div className="rm-cell-combobox" data-tone={tone}>
    <input {...common} className="rm-cell-combobox-input" type="text"
      aria-label={label} aria-autocomplete="list" aria-expanded={open}
      autoComplete="off" value={draft} placeholder={placeholder}
      onFocus={() => { setOpen(true); setActiveIndex(0); }}
      onChange={event => { setDraft(event.currentTarget.value); setOpen(true); setActiveIndex(0); }}
      onBlur={() => commit(draft)}
      onKeyDown={event => {
        if (event.key === "Escape") { setOpen(false); return; }
        if (event.key === "ArrowDown" && itemCount) {
          event.preventDefault();
          setOpen(true);
          setActiveIndex(index => Math.min(index + 1, itemCount - 1));
        }
        if (event.key === "ArrowUp" && itemCount) {
          event.preventDefault();
          setActiveIndex(index => Math.max(0, index - 1));
        }
        if (event.key === "Enter") {
          event.preventDefault();
          if (open && activeIndex < matches.length) commit(matches[activeIndex]);
          else commit(normalized);
        }
      }}/>
    <ChevronDown className="rm-combobox-chevron" size={14} aria-hidden="true"/>
    {open && itemCount > 0 && <div className="rm-combobox-menu" role="listbox">
      {matches.map((option, index) => <button type="button" role="option"
        aria-selected={activeIndex === index} key={option}
        onMouseDown={event => event.preventDefault()}
        onClick={() => commit(option)}>
        <span className="rm-combobox-option-dot"/>{option}
      </button>)}
      {canCreate && <button type="button" className="rm-combobox-create" role="option"
        aria-selected={activeIndex === matches.length}
        onMouseDown={event => event.preventDefault()}
        onClick={() => commit(normalized)}>
        <Plus size={13}/> Criar “{normalized}”
      </button>}
    </div>}
  </div>;
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
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [editingColumnId, setEditingColumnId] = useState("");
  const [editingColumnLabel, setEditingColumnLabel] = useState("");
  const [showAddDiscipline, setShowAddDiscipline] = useState(false);
  const [newDisciplineName, setNewDisciplineName] = useState("");
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
    checkDueNotifications();
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
      if (error.status === "dominado" || dateInputValue(error.nextReview) > dateInputValue(Date.now())) continue;
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
    if (patch.nextReview === undefined && (patch.reviewDays !== undefined || patch.at !== undefined)) {
      next.nextReview = addCalendarDays(next.at, Number(next.reviewDays || 15));
    }
    const nextErrors = errorsRef.current.map(item => item.id === id ? next : item);
    errorsRef.current = nextErrors;
    setErrors(nextErrors);
    try {
      await saveError(next);
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
  function beginColumnRename(column: ErrorNotebookColumn) {
    setEditingColumnId(column.id);
    setEditingColumnLabel(column.label);
  }
  function finishColumnRename() {
    const label = editingColumnLabel.trim();
    if (label) {
      const next = {
        ...settingsRef.current,
        columns: settingsRef.current.columns.map(column =>
          column.id === editingColumnId ? { ...column, label } : column
        ),
      };
      saveColumnSettings(next);
    }
    setEditingColumnId("");
    setEditingColumnLabel("");
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
    const name = newDisciplineName.trim().replace(/\s+/g, " ");
    if (!name) return;
    const existing = disciplines.find(item => sameDiscipline(item, name));
    if (existing) setDisciplineTab(existing);
    else {
      saveColumnSettings({
        ...settingsRef.current,
        disciplines: [...settingsRef.current.disciplines, name],
      });
      setDisciplineTab(name);
    }
    setNewDisciplineName("");
    setShowAddDiscipline(false);
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
      nextReview: addCalendarDays(now, 15),
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
    window.requestAnimationFrame(() => {
      const firstField = disciplineTab === "Todas" ? "discipline" : "type";
      document.querySelector<HTMLInputElement | HTMLSelectElement>(
        `[data-row-id="${record.id}"][data-column="${firstField}"]`
      )?.focus();
    });
  }
  async function removeRow(id: string) {
    if (!confirm("Excluir este registro e seus anexos?")) return;
    await deleteError(id);
    const nextErrors = errorsRef.current.filter(item => item.id !== id);
    errorsRef.current = nextErrors;
    setErrors(nextErrors);
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
    const matchingDiscipline = scopedErrors.filter(item =>
      !error.discipline || sameDiscipline(recordDiscipline(item), recordDiscipline(error))
    );
    const areaOptions = uniqueLabels(matchingDiscipline.map(item => item.area));
    const topicOptions = uniqueLabels(matchingDiscipline
      .filter(item => !error.area || sameDiscipline(item.area, error.area))
      .map(item => item.topic));
    switch (column.kind) {
      case "date":
        return <input {...common} className="rm-cell-input rm-cell-date" type="date"
          aria-label={column.label} value={dateInputValue(error.at)}
          onChange={event => void updateError(error.id, { at: dateFromInput(event.currentTarget.value) })}/>;
      case "type":
        return <div className="rm-cell-select-shell" data-tone={errorTypeTone(error.type)}>
          <select {...common} className="rm-cell-select rm-cell-type"
            aria-label={column.label} value={error.type}
            onChange={event => void updateError(error.id, { type: event.currentTarget.value })}>
            <option value="">Selecionar tipo</option>
            {error.type && !ERROR_TYPES.includes(error.type) && <option value={error.type}>{error.type}</option>}
            {ERROR_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select><ChevronDown size={14} aria-hidden="true"/>
        </div>;
      case "discipline":
        return <div className="rm-cell-select-shell" data-tone={disciplineTone(error.discipline || disciplineTab)}>
          <select {...common} className="rm-cell-select" aria-label={column.label}
            value={error.discipline} onChange={event => void updateError(error.id, { discipline: event.currentTarget.value })}>
            <option value="">Selecionar disciplina</option>
            {disciplines.filter(name => name !== "Todas").map(name => <option key={name} value={name}>{name}</option>)}
          </select><ChevronDown size={14} aria-hidden="true"/>
        </div>;
      case "text": {
        const isArea = column.id === "area";
        return <CreatableCell common={common} value={isArea ? error.area : error.topic}
          options={isArea ? areaOptions : topicOptions} tone={isArea ? "data" : "specific"}
          label={column.label} placeholder={isArea ? "Área / eixo" : "Assunto"}
          onCommit={value => void updateError(error.id, isArea ? { area: value } : { topic: value })}/>;
      }
      case "longtext": {
        const value = column.id === "mistake" ? error.mistake : column.id === "fix" ? error.fix : error.customFields?.[column.id] || "";
        const rows = Math.max(1, Math.min(5, Math.ceil(value.length / 42)));
        return <textarea {...common} className="rm-cell-textarea" rows={rows}
          aria-label={column.label} defaultValue={value}
          placeholder={column.id === "mistake" ? "Descreva o que levou ao erro..." : "Registre o raciocínio correto..."}
          onFocus={event => {
            const field = event.currentTarget;
            field.style.height = "auto";
            field.style.height = field.scrollHeight + "px";
          }}
          onInput={event => {
            const field = event.currentTarget;
            field.style.height = "auto";
            field.style.height = field.scrollHeight + "px";
          }}
          onBlur={event => void updateError(error.id, column.id === "mistake"
            ? { mistake: event.currentTarget.value }
            : column.id === "fix" ? { fix: event.currentTarget.value }
              : { customFields: { ...(error.customFields || {}), [column.id]: event.currentTarget.value } })}/>;
      }
      case "interval":
        return <div className="rm-cell-select-shell" data-tone="law">
          <select {...common} className="rm-cell-select rm-cell-interval"
            aria-label={column.label} value={error.reviewDays || 15}
            onChange={event => void updateError(error.id, { reviewDays: Number(event.currentTarget.value) })}>
            {![...REVIEW_STEPS].includes(error.reviewDays) && <option value={error.reviewDays}>{error.reviewDays} dias</option>}
            {REVIEW_STEPS.map(days => <option key={days} value={days}>{days} dias</option>)}
          </select><ChevronDown size={14} aria-hidden="true"/>
        </div>;
      case "reviewDate":
        return <div className="rm-cell-review-date" data-column={column.id}>
          <Bell size={13} aria-hidden="true"/>
          <input {...common} className="rm-cell-input rm-cell-date" type="date"
            aria-label={column.label} value={dateInputValue(error.nextReview)}
            onChange={event => void updateError(error.id, { nextReview: dateFromInput(event.currentTarget.value) })}/>
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
          defaultValue={error.customFields?.[column.id] || ""} placeholder="Adicionar informação..."
          onBlur={event => void updateError(error.id, {
            customFields: { ...(error.customFields || {}), [column.id]: event.currentTarget.value },
          })}/>;
      default:
        return <span>—</span>;
    }
  }

  return <div className="stack ritmo-materials rm-errors rm-notion-errors">
    <header className="rm-notebook-heading">
      <div>
        <small>RITMO / PRÁTICA</small>
        <h1>Caderno de erros</h1>
        <p>Transforme cada erro em aprendizado. Um registro de cada vez.</p>
      </div>
      <div className="rm-notebook-actions">
        <button className="rm-properties-trigger" type="button" aria-expanded={showColumnSettings}
          onClick={() => setShowColumnSettings(value => !value)}>
          <Settings2 size={15}/><span>Colunas</span>
        </button>
        <button className="primary-button rm-new-row-button" type="button" onClick={() => void addRow()}>
          <Plus size={16}/><span>Nova linha</span>
        </button>
      </div>
    </header>

    {context.requested && <div className="rm-context-line">
      <span>{context.valid ? context.plan?.title + " / " + context.title : "Assunto do plano indisponível ou carregando."}</span>
      <Link to={context.returnTo}>Voltar ao plano</Link>
    </div>}
    {dueOnly && <div className="rm-context-line">
      <span>Revisões previstas para hoje ou atrasadas</span><Link to="/errors">Mostrar todos</Link>
    </div>}

    <div className="rm-notebook-toolbar">
      <label className="rm-error-search">
        <Search size={16}/>
        <input aria-label="Buscar no caderno" value={searchTerm}
          onChange={event => setSearchTerm(event.target.value)}
          placeholder="Buscar no caderno..."/>
        {searchTerm && <button type="button" aria-label="Limpar busca" onClick={() => setSearchTerm("")}><X size={14}/></button>}
      </label>
      <div className="rm-notebook-summary">
        <span>{scopedErrors.length} {scopedErrors.length === 1 ? "registro" : "registros"}</span>
        <i/>
        <strong>{dueCount} para revisar</strong>
        <button type="button" className={"rm-alarm-button " + (alarmPermission === "granted" ? "is-active" : "")}
          onClick={() => void enableAlarms()}
          title="O Ritmo avisa quando a revisão vencer enquanto estiver aberto.">
          {alarmPermission === "granted" ? <BellRing size={15}/> : alarmPermission === "denied" ? <BellOff size={15}/> : <Bell size={15}/>}
          <span>{alarmPermission === "granted" ? "Lembretes ativos" : alarmPermission === "denied" ? "Notificações bloqueadas" : "Ativar lembretes"}</span>
        </button>
      </div>
    </div>

    {feedback && <p className="rm-notebook-feedback" role="status">{feedback}</p>}

    {showColumnSettings && <section className="rm-properties-panel">
      <div className="rm-properties-topline">
        <div><strong>Organizar colunas</strong><span>Renomeie clicando no título da coluna. Reordene por aqui.</span></div>
        <button type="button" className="rm-close-properties" aria-label="Fechar propriedades" onClick={() => setShowColumnSettings(false)}><X size={15}/></button>
      </div>
      <div className="rm-properties-list">
        {settings.columns.map((column, index) => <div className="rm-property-item" key={column.id}>
          <span>{column.label}</span>
          <div>
            <button type="button" aria-label={"Mover " + column.label + " para a esquerda"} disabled={index === 0}
              onClick={() => moveColumn(column.id, -1)}><ChevronUp size={14}/></button>
            <button type="button" aria-label={"Mover " + column.label + " para a direita"} disabled={index === settings.columns.length - 1}
              onClick={() => moveColumn(column.id, 1)}><ChevronDown size={14}/></button>
            {column.custom && <button type="button" aria-label={"Excluir coluna " + column.label}
              onClick={() => void removeColumn(column)}><Trash2 size={13}/></button>}
          </div>
        </div>)}
      </div>
      <form className="rm-add-property" onSubmit={event => { event.preventDefault(); addColumn(); }}>
        <input value={newColumnName} onChange={event => setNewColumnName(event.currentTarget.value)}
          placeholder="Nome da nova coluna" aria-label="Nome da nova coluna"/>
        <button type="submit" disabled={!newColumnName.trim()}><Plus size={14}/>Adicionar propriedade</button>
      </form>
    </section>}

    <nav className="rm-discipline-tabs" role="tablist" aria-label="Disciplinas do caderno">
      {disciplines.map(name => {
        const count = name === "Todas"
          ? scopedErrors.length
          : scopedErrors.filter(error => sameDiscipline(recordDiscipline(error), name)).length;
        return <button key={name} type="button" role="tab" data-tone={disciplineTone(name)}
          aria-selected={disciplineTab === name} onClick={() => setDisciplineTab(name)}>
          <span>{name}</span><small>{count}</small>
        </button>;
      })}
      {showAddDiscipline ? <form className="rm-add-discipline-form" onSubmit={event => { event.preventDefault(); addDiscipline(); }}>
        <input autoFocus value={newDisciplineName} onChange={event => setNewDisciplineName(event.currentTarget.value)}
          onKeyDown={event => { if (event.key === "Escape") setShowAddDiscipline(false); }}
          placeholder="Nova disciplina" aria-label="Nome da disciplina"/>
        <button type="submit" disabled={!newDisciplineName.trim()}><Check size={14}/></button>
        <button type="button" aria-label="Cancelar" onClick={() => setShowAddDiscipline(false)}><X size={14}/></button>
      </form> : <button type="button" className="rm-add-discipline" onClick={() => setShowAddDiscipline(true)}>
        <Plus size={14}/><span>Disciplina</span>
      </button>}
    </nav>

    <section className="rm-notebook-table-section">
      <div className="rm-table-caption">
        <strong>{disciplineTab === "Todas" ? "Todas as disciplinas" : disciplineTab}</strong>
        <span>{visible.length} {visible.length === 1 ? "questão registrada" : "questões registradas"}</span>
      </div>
      {loading ? <div className="rm-notebook-loading">Preparando seu caderno...</div> :
        <div className="rm-notion-table-scroll">
          <table className="rm-notion-table">
            <thead><tr>
              {columns.map(column => <th key={column.id} data-column={column.id}>
                {editingColumnId === column.id ? <input autoFocus className="rm-column-rename-input"
                  value={editingColumnLabel} aria-label={"Renomear coluna " + column.label}
                  onChange={event => setEditingColumnLabel(event.currentTarget.value)}
                  onBlur={finishColumnRename}
                  onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setEditingColumnId(""); setEditingColumnLabel(""); } }}/> :
                  <button type="button" className="rm-column-title" title="Clique para renomear esta coluna"
                    onClick={() => beginColumnRename(column)}>
                    <span>{column.label}</span><Pencil size={11}/>
                  </button>}
              </th>)}
              <th className="rm-row-actions-heading" aria-label="Ações"/>
            </tr></thead>
            <tbody>
              {visible.map(error => <tr key={error.id} className={isDue(error) ? "rm-notion-row-due" : ""}>
                {columns.map(column => <td key={column.id} data-column={column.id}>
                  {renderCell(error, column)}
                </td>)}
                <td className="rm-row-actions">
                  <button type="button" title="Excluir registro" aria-label="Excluir registro"
                    onClick={() => void removeRow(error.id)}><Trash2 size={14}/></button>
                </td>
              </tr>)}
              {!visible.length && <tr><td colSpan={columns.length + 1} className="rm-notion-empty">
                <NotebookPen size={25}/>
                <strong>{scopedErrors.length ? "Nenhum resultado nesta visualização" : "Seu caderno começa aqui"}</strong>
                <span>{scopedErrors.length ? "Experimente outra disciplina ou busca." : "Crie uma linha e comece a registrar o que precisa aprender."}</span>
                {!scopedErrors.length && <button type="button" onClick={() => void addRow()}><Plus size={15}/>Criar primeira linha</button>}
              </td></tr>}
            </tbody>
          </table>
        </div>
      }
      {!loading && <button type="button" className="rm-add-row-inline" onClick={() => void addRow()}>
        <Plus size={15}/><span>Nova linha</span>
      </button>}
    </section>

  </div>;}
