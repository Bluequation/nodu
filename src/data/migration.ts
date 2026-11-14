import type { PlanNode, PlanOrigin, ScheduleConfig, StudyPlan } from "../domain/models";
import { emptyFsrsState } from "../domain/fsrs";
import type { Concept, ErrorRecord, FlashcardVariant, LearningSession, QuestionBlock, ReviewLog, StudySubject } from "../domain/study";

export const LEGACY_KEYS = ["ritmo-notion-v7", "ritmo-notion-v6", "ritmo-notion-v5"] as const;
export interface LegacyDb {
  version: number;
  concepts: unknown[];
  reviews: unknown[];
  errors: Array<Record<string, unknown>>;
  blocks: unknown[];
  settings: Record<string, unknown>;
  confidence: Record<string, unknown>;
  catalog: Record<string, unknown>;
  plans: unknown[];
  planDraft?: unknown;
  learningSessions: unknown[];
  [key: string]: unknown;
}
export type MigrationResult = { ok: true; data: LegacyDb } | { ok: false; reason: string };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};
const subjectOf = (value: unknown): StudySubject => value === "fisica" ? "fisica" : "tae";

export function normalizeLegacyConcept(value: unknown, index = 0): Concept {
  const raw = asRecord(value);
  const now = Date.now();
  const variantsRaw = Array.isArray(raw.variants) ? raw.variants : [];
  const variants: FlashcardVariant[] = variantsRaw.map((item, variantIndex) => {
    const variant = asRecord(item);
    const mask = asRecord(variant.mask);
    return {
      id: String(variant.id ?? `legacy-variant-${index}-${variantIndex}`),
      kind: String(variant.kind ?? "Definição"),
      format: String(variant.format ?? "basic"),
      q: String(variant.q ?? ""),
      a: String(variant.a ?? ""),
      reason: String(variant.reason ?? ""),
      source: String(variant.source ?? ""),
      image: String(variant.image ?? ""),
      mask: variant.mask && typeof variant.mask === "object"
        ? { x: Number(mask.x ?? 0), y: Number(mask.y ?? 0), w: Number(mask.w ?? 0), h: Number(mask.h ?? 0) }
        : null,
      status: String(variant.status ?? "approved"),
      uses: Number(variant.uses ?? 0),
      passes: Number(variant.passes ?? 0),
      failures: Number(variant.failures ?? 0),
    };
  });
  const fsrs = asRecord(raw.fsrs);
  return {
    id: String(raw.id ?? `legacy-concept-${index}`),
    subject: subjectOf(raw.subject),
    topic: String(raw.topic ?? ""),
    source: String(raw.source ?? ""),
    status: String(raw.status ?? "published"),
    variants,
    createdAt: Number(raw.createdAt ?? now),
    fsrs: {
      ...emptyFsrsState(now),
      s: Number(fsrs.s ?? 0), d: Number(fsrs.d ?? 0), last: Number(fsrs.last ?? 0),
      due: Number(fsrs.due ?? now - 1), reps: Number(fsrs.reps ?? 0),
      lapses: Number(fsrs.lapses ?? 0), interval: Number(fsrs.interval ?? 0),
    },
    lastVariant: String(raw.lastVariant ?? ""),
    suspended: Boolean(raw.suspended),
  };
}

export function normalizeLegacyReview(value: unknown, index = 0): ReviewLog {
  const raw = asRecord(value);
  const grade = ["again", "hard", "good", "easy"].includes(String(raw.grade)) ? raw.grade as ReviewLog["grade"] : "good";
  return {
    id: String(raw.id ?? `legacy-review-${index}`),
    conceptId: String(raw.conceptId ?? ""),
    subject: subjectOf(raw.subject),
    topic: String(raw.topic ?? ""),
    variantId: String(raw.variantId ?? ""),
    kind: String(raw.kind ?? ""),
    format: String(raw.format ?? "basic"),
    grade,
    at: Number(raw.at ?? Date.now()),
    wasNew: Boolean(raw.wasNew),
    preview: Boolean(raw.preview),
    typed: String(raw.typed ?? ""),
    s: Number(raw.s ?? 0), d: Number(raw.d ?? 0), due: Number(raw.due ?? 0),
  };
}

export function normalizeLegacyError(value: unknown, index = 0): ErrorRecord {
  const raw = asRecord(value);
  const history = Array.isArray(raw.history) ? raw.history : [];
  return {
    id: String(raw.id ?? `legacy-error-${index}`),
    subject: subjectOf(raw.subject),
    discipline: String(raw.discipline ?? ""),
    area: String(raw.area ?? ""),
    topic: String(raw.topic ?? ""),
    type: String(raw.type ?? raw.cause ?? "Lacuna"),
    mistake: String(raw.mistake ?? ""),
    fix: String(raw.fix ?? ""),
    reviewDays: Number(raw.reviewDays ?? 15),
    questionUrl: String(raw.questionUrl ?? ""),
    conceptId: String(raw.conceptId ?? ""),
    questionText: String(raw.questionText ?? ""),
    optionsText: String(raw.optionsText ?? ""),
    correctAnswer: String(raw.correctAnswer ?? ""),
    at: Number(raw.at ?? Date.now()),
    nextReview: Number(raw.nextReview ?? Date.now() + Number(raw.reviewDays ?? 15) * 86_400_000),
    successes: Number(raw.successes ?? 0),
    failures: Number(raw.failures ?? 0),
    status: String(raw.status ?? "pendente"),
    history: history.map(item => {
      const entry = asRecord(item);
      return { at: Number(entry.at ?? Date.now()), grade: entry.grade === "right" ? "right" as const : "wrong" as const };
    }),
  };
}

export function normalizeLegacyBlock(value: unknown, index = 0): QuestionBlock {
  const raw = asRecord(value);
  return {
    id: String(raw.id ?? `legacy-block-${index}`),
    subject: subjectOf(raw.subject),
    topic: String(raw.topic ?? ""),
    at: Number(raw.at ?? Date.now()),
    total: Number(raw.total ?? 0),
    correct: Number(raw.correct ?? 0),
    note: String(raw.note ?? ""),
  };
}

export function normalizeLegacySession(value: unknown, index = 0): LearningSession {
  const raw = asRecord(value);
  return {
    id: String(raw.id ?? `legacy-session-${index}`),
    mode: String(raw.mode ?? ""),
    topic: String(raw.topic ?? ""),
    subject: subjectOf(raw.subject),
    grade: String(raw.grade ?? ""),
    at: Number(raw.at ?? Date.now()),
    sourceType: String(raw.sourceType ?? ""),
    sourceId: String(raw.sourceId ?? ""),
    startedAt: Number(raw.startedAt ?? raw.at ?? Date.now()),
    response: String(raw.response ?? ""),
    autoGraded: Boolean(raw.autoGraded),
    prompt: String(raw.prompt ?? ""),
  };
}


export function validateLegacy(value: unknown): value is LegacyDb {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return data.version === 7 &&
    Array.isArray(data.concepts) &&
    Array.isArray(data.reviews) &&
    Array.isArray(data.errors) &&
    Array.isArray(data.blocks) &&
    !!data.settings && typeof data.settings === "object" &&
    !!data.confidence && typeof data.confidence === "object" &&
    !!data.catalog && typeof data.catalog === "object" &&
    Array.isArray(data.plans) &&
    Array.isArray(data.learningSessions);
}

export function migrateLegacy(input: unknown): MigrationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, reason: "Dados antigos inválidos." };
  const data = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  if (data.version === 5) {
    data.version = 6;
    data.plans = [];
    data.planDraft = null;
  }
  if (data.version === 6) {
    data.plans = Array.isArray(data.plans) ? data.plans : [];
    data.planDraft = data.planDraft ?? null;
    data.version = 7;
  }
  if (data.version === 7) {
    data.learningSessions = Array.isArray(data.learningSessions) ? data.learningSessions : [];
    data.errors = (Array.isArray(data.errors) ? data.errors : []).map(error => {
      const entry = error as Record<string, unknown>;
      return {
        ...entry,
        questionText: entry.questionText || "",
        optionsText: entry.optionsText || "",
        correctAnswer: entry.correctAnswer || "",
      };
    });
  }
  return validateLegacy(data)
    ? { ok: true, data }
    : { ok: false, reason: "A estrutura não passou pela validação da versão 7." };
}

function mapOrigin(value: unknown): PlanOrigin {
  const origin = String(value ?? "edital").toLowerCase();
  if (/suggest|sugest|desdob|complement/.test(origin)) return "suggested";
  if (/manual|usuario|usuário/.test(origin)) return "manual";
  return "edital";
}
function mapLegacyNode(value: unknown, index: string): PlanNode | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = String(raw.name ?? raw.nome ?? raw.title ?? raw.titulo ?? raw.assunto ?? "").trim();
  if (!name) return null;
  const rawChildren = raw.children ?? raw.filhos ?? raw.assuntos ?? raw.subassuntos ?? raw.topicos ?? raw.items;
  const children = Array.isArray(rawChildren)
    ? rawChildren.map((child, childIndex) => mapLegacyNode(child, `${index}-${childIndex}`)).filter((child): child is PlanNode => !!child)
    : [];
  const origin = mapOrigin(raw.origin ?? raw.origem);
  return {
    id: String(raw.id ?? `legacy-node-${index}`),
    name: name.slice(0, 240),
    origin,
    sourceRef: String(raw.sourceRef ?? raw.referencia ?? raw.pagina ?? "").slice(0, 180),
    sourceText: String(raw.sourceText ?? raw.textoOriginal ?? raw.texto_original ?? "").slice(0, 1200),
    selected: typeof raw.selected === "boolean" ? raw.selected : origin !== "suggested",
    children,
  };
}

export function migrateLegacyPlan(value: unknown, index = 0): StudyPlan | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const meta = raw.meta && typeof raw.meta === "object" ? raw.meta as Record<string, unknown> : {};
  const treeRaw = Array.isArray(raw.tree) ? raw.tree : [];
  const tree = treeRaw.map((node, nodeIndex) => mapLegacyNode(node, `${index}-${nodeIndex}`)).filter((node): node is PlanNode => !!node);
  const configRaw = raw.scheduleConfig && typeof raw.scheduleConfig === "object"
    ? raw.scheduleConfig as Record<string, unknown>
    : null;
  let scheduleConfig: ScheduleConfig | null = null;
  if (configRaw) {
    const days = Array.isArray(configRaw.days)
      ? configRaw.days.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
      : [];
    scheduleConfig = {
      startDate: String(configRaw.startDate ?? ""),
      examDate: String(configRaw.examDate ?? meta.examDate ?? ""),
      days,
      minutes: Number(configRaw.minutes ?? 90),
      mode: configRaw.mode === "priority" || configRaw.mode === "sequence" ? "sequence" : "alternate",
    };
  }
  const assignmentRows = Array.isArray(raw.assignments) ? raw.assignments : [];
  const assignments = assignmentRows.filter(item => !!item && typeof item === "object").map((item, assignmentIndex) => {
    const assignment = item as Record<string, unknown>;
    return {
      nodeId: String(assignment.nodeId ?? assignment.id ?? `legacy-assignment-${index}-${assignmentIndex}`),
      name: String(assignment.name ?? ""),
      path: Array.isArray(assignment.path) ? assignment.path.map(String) : [],
      origin: mapOrigin(assignment.origin),
      sourceRef: String(assignment.sourceRef ?? ""),
      day: Number(assignment.day ?? 1),
      done: Boolean(assignment.done),
    };
  });
  const title = String(meta.title ?? raw.title ?? "Plano de estudos");
  const status = raw.status === "completed" ? "completed" : assignments.length ? "active" : "draft";
  const stage = raw.stage === "source" || raw.stage === "selection" || raw.stage === "schedule"
    ? raw.stage
    : assignments.length ? "schedule" : tree.length ? "selection" : "source";
  const now = Date.now();
  return {
    id: String(raw.id ?? `legacy-plan-${index}`),
    title,
    institution: String(meta.institution ?? raw.institution ?? ""),
    position: String(meta.cargo ?? meta.position ?? raw.position ?? ""),
    area: String(meta.area ?? raw.area ?? ""),
    organizer: String(meta.organizer ?? raw.organizer ?? ""),
    examDate: String(meta.examDate ?? raw.examDate ?? ""),
    sourceFile: String(raw.sourceFile ?? meta.sourceFile ?? ""),
    sourceText: String(raw.sourceText ?? ""),
    tree,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    selectionIndex: Number(raw.selectionIndex ?? 0),
    stage,
    scheduleConfig,
    assignments,
    createdAt: Number(raw.createdAt ?? now),
    updatedAt: Number(raw.updatedAt ?? raw.createdAt ?? now),
    status,
  };
}

export function readLegacy(): { key: string; data: LegacyDb } | null {
  if (typeof window === "undefined") return null;
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const result = migrateLegacy(JSON.parse(raw));
      if (result.ok) return { key, data: result.data };
    } catch {
      // Try the next known version without altering the source key.
    }
  }
  return null;
}
