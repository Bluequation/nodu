import type { PlanNode, PlanOrigin, ScheduleConfig, StudyPlan } from "../domain/models";

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
