import { openDB, type DBSchema } from "idb";
import type { StudyPlan } from "../domain/models";
import type { Concept, ErrorRecord, LearningSession, QuestionBlock, ReviewLog } from "../domain/study";
import type { QuestionAttemptRecord, StudyPageRecord, StudyQuestionRecord, StudySessionRecord } from "../domain/ritmo9";
import {
  migrateLegacyPlan, normalizeLegacyBlock, normalizeLegacyConcept, normalizeLegacyError,
  normalizeLegacyReview, normalizeLegacySession, readLegacy, type LegacyDb,
} from "./migration";

interface AppStateEntry { key: string; value: unknown }
interface RitmoDB extends DBSchema {
  appState: { key: string; value: AppStateEntry };
  plans: { key: string; value: StudyPlan };
  concepts: { key: string; value: Concept };
  reviews: { key: string; value: ReviewLog };
  errors: { key: string; value: ErrorRecord };
  blocks: { key: string; value: QuestionBlock };
  learningSessions: { key: string; value: LearningSession };
  pages: { key: string; value: StudyPageRecord };
  questions: { key: string; value: StudyQuestionRecord };
  questionAttempts: { key: string; value: QuestionAttemptRecord };
  studySessions: { key: string; value: StudySessionRecord };
}
const NAME = "ritmo-8";
let promise: ReturnType<typeof openDB<RitmoDB>> | undefined;

export function database() {
  return promise ??= openDB<RitmoDB>(NAME, 3, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("appState")) db.createObjectStore("appState", { keyPath: "key" });
      if (!db.objectStoreNames.contains("plans")) db.createObjectStore("plans", { keyPath: "id" });
      if (!db.objectStoreNames.contains("concepts")) db.createObjectStore("concepts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("reviews")) db.createObjectStore("reviews", { keyPath: "id" });
      if (!db.objectStoreNames.contains("errors")) db.createObjectStore("errors", { keyPath: "id" });
      if (!db.objectStoreNames.contains("blocks")) db.createObjectStore("blocks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("learningSessions")) db.createObjectStore("learningSessions", { keyPath: "id" });
      if (!db.objectStoreNames.contains("pages")) db.createObjectStore("pages", { keyPath: "id" });
      if (!db.objectStoreNames.contains("questions")) db.createObjectStore("questions", { keyPath: "id" });
      if (!db.objectStoreNames.contains("questionAttempts")) db.createObjectStore("questionAttempts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("studySessions")) db.createObjectStore("studySessions", { keyPath: "id" });
    },
  });
}

async function preserveLegacySnapshot(db: Awaited<ReturnType<typeof database>>) {
  if (await db.get("appState", "legacy-v7-snapshot")) return;
  const legacy = readLegacy();
  if (!legacy) return;
  const tx = db.transaction("appState", "readwrite");
  await tx.store.put({ key: "legacy-v7-snapshot", value: legacy.data });
  await tx.store.put({
    key: "migration-metadata",
    value: { sourceKey: legacy.key, migratedAt: Date.now(), sourceVersion: 7, originalPreserved: true },
  });
  await tx.done;
}

async function importLegacyCollections(db: Awaited<ReturnType<typeof database>>) {
  const snapshot = await db.get("appState", "legacy-v7-snapshot");
  if (!snapshot) return;
  const metadata = await db.get("appState", "legacy-data-import");
  if (metadata?.value && typeof metadata.value === "object" && (metadata.value as Record<string, unknown>).complete === true) return;

  const legacy = snapshot.value as LegacyDb;
  const tx = db.transaction(
    ["appState", "plans", "concepts", "reviews", "errors", "blocks", "learningSessions"],
    "readwrite",
  );
  const concepts = Array.isArray(legacy.concepts) ? legacy.concepts : [];
  const reviews = Array.isArray(legacy.reviews) ? legacy.reviews : [];
  const errors = Array.isArray(legacy.errors) ? legacy.errors : [];
  const blocks = Array.isArray(legacy.blocks) ? legacy.blocks : [];
  const sessions = Array.isArray(legacy.learningSessions) ? legacy.learningSessions : [];
  const plans = Array.isArray(legacy.plans) ? legacy.plans : [];

  for (let index = 0; index < concepts.length; index += 1) {
    await tx.objectStore("concepts").put(normalizeLegacyConcept(concepts[index], index));
  }
  for (let index = 0; index < reviews.length; index += 1) {
    await tx.objectStore("reviews").put(normalizeLegacyReview(reviews[index], index));
  }
  for (let index = 0; index < errors.length; index += 1) {
    await tx.objectStore("errors").put(normalizeLegacyError(errors[index], index));
  }
  for (let index = 0; index < blocks.length; index += 1) {
    await tx.objectStore("blocks").put(normalizeLegacyBlock(blocks[index], index));
  }
  for (let index = 0; index < sessions.length; index += 1) {
    await tx.objectStore("learningSessions").put(normalizeLegacySession(sessions[index], index));
  }
  for (let index = 0; index < plans.length; index += 1) {
    const plan = migrateLegacyPlan(plans[index], index);
    if (plan) await tx.objectStore("plans").put(plan);
  }

  await tx.objectStore("appState").put({ key: "legacy-settings", value: legacy.settings || {} });
  await tx.objectStore("appState").put({ key: "legacy-catalog", value: legacy.catalog || {} });
  await tx.objectStore("appState").put({ key: "legacy-confidence", value: legacy.confidence || {} });
  await tx.objectStore("appState").put({
    key: "legacy-data-import",
    value: {
      complete: true,
      importedAt: Date.now(),
      counts: { concepts: concepts.length, reviews: reviews.length, errors: errors.length, blocks: blocks.length, sessions: sessions.length, plans: plans.length },
    },
  });
  await tx.done;
}

export async function initializeStorage() {
  const db = await database();
  await preserveLegacySnapshot(db);
  await importLegacyCollections(db);
}
export async function hasLegacySnapshot() {
  return !!(await (await database()).get("appState", "legacy-v7-snapshot"));
}
