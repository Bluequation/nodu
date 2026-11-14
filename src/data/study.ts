import { database } from "./database";
import type { Concept, ErrorRecord, FlashcardVariant, LearningSession, QuestionBlock, ReviewLog, StudySettings } from "../domain/study";
import { emptyFsrsState } from "../domain/fsrs";

const DEFAULT_SETTINGS: StudySettings = { retention: 0.9, newLimit: 10, reviewLimit: 70, leech: 4 };
const newId = () => crypto.randomUUID();

export async function listConcepts(): Promise<Concept[]> {
  return (await (await database()).getAll("concepts")).sort((a, b) => a.topic.localeCompare(b.topic));
}
export async function getConcept(id: string): Promise<Concept | undefined> {
  return (await database()).get("concepts", id);
}
export async function saveConcept(concept: Concept): Promise<Concept> {
  await (await database()).put("concepts", concept);
  return concept;
}
export async function createConcept(input: Pick<Concept, "subject" | "topic" | "source">, variants: FlashcardVariant[], status: Concept["status"] = "published"): Promise<Concept> {
  const now = Date.now();
  const concept: Concept = {
    id: newId(),
    subject: input.subject,
    topic: input.topic.trim(),
    source: input.source.trim(),
    status,
    variants,
    createdAt: now,
    fsrs: emptyFsrsState(now),
    lastVariant: "",
    suspended: false,
  };
  return saveConcept(concept);
}
export async function listReviews(): Promise<ReviewLog[]> {
  return (await (await database()).getAll("reviews")).sort((a, b) => b.at - a.at);
}
export async function saveReview(review: ReviewLog): Promise<ReviewLog> {
  await (await database()).put("reviews", review);
  return review;
}
export async function listErrors(): Promise<ErrorRecord[]> {
  return (await (await database()).getAll("errors")).sort((a, b) => b.at - a.at);
}
export async function saveError(error: ErrorRecord): Promise<ErrorRecord> {
  await (await database()).put("errors", error);
  return error;
}
export async function deleteError(id: string): Promise<void> {
  await (await database()).delete("errors", id);
}
export async function listQuestionBlocks(): Promise<QuestionBlock[]> {
  return (await (await database()).getAll("blocks")).sort((a, b) => b.at - a.at);
}
export async function saveQuestionBlock(block: QuestionBlock): Promise<QuestionBlock> {
  await (await database()).put("blocks", block);
  return block;
}
export async function deleteQuestionBlock(id: string): Promise<void> {
  await (await database()).delete("blocks", id);
}
export async function listLearningSessions(): Promise<LearningSession[]> {
  return (await (await database()).getAll("learningSessions")).sort((a, b) => b.at - a.at);
}
export async function saveLearningSession(session: LearningSession): Promise<LearningSession> {
  await (await database()).put("learningSessions", session);
  return session;
}
export async function getStudySettings(): Promise<StudySettings> {
  const entry = await (await database()).get("appState", "study-settings");
  const legacy = await (await database()).get("appState", "legacy-settings");
  const value = (entry?.value ?? legacy?.value ?? {}) as Partial<StudySettings>;
  return { ...DEFAULT_SETTINGS, ...value };
}
export async function saveStudySettings(settings: StudySettings): Promise<void> {
  await (await database()).put("appState", { key: "study-settings", value: settings });
}
export async function getStudyCatalog(): Promise<Record<string, unknown>> {
  const entry = await (await database()).get("appState", "study-catalog");
  const legacy = await (await database()).get("appState", "legacy-catalog");
  return (entry?.value ?? legacy?.value ?? {}) as Record<string, unknown>;
}
export async function saveStudyCatalog(catalog: Record<string, unknown>): Promise<void> {
  await (await database()).put("appState", { key: "study-catalog", value: catalog });
}

export async function recordConceptReview(concept: Concept, review: ReviewLog): Promise<void> {
  const tx = (await database()).transaction(["concepts", "reviews"], "readwrite");
  await Promise.all([
    tx.objectStore("concepts").put(concept),
    tx.objectStore("reviews").put(review),
  ]);
  await tx.done;
}
