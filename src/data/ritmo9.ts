import { database } from "./database";
import type {
  QuestionAttemptRecord,
  StudyPageRecord,
  StudyQuestionRecord,
  StudySessionRecord,
} from "../domain/ritmo9";
import type { PlanTopicRef } from "../domain/study";

const id = () => crypto.randomUUID();

export async function listStudyPages(): Promise<StudyPageRecord[]> {
  return (await (await database()).getAll("pages"))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getStudyPage(pageId: string): Promise<StudyPageRecord | undefined> {
  return (await database()).get("pages", pageId);
}

export async function createStudyPage(input: {
  title: string;
  topicLinks?: PlanTopicRef[];
  parentPageId?: string;
}): Promise<StudyPageRecord> {
  const now = Date.now();
  const page: StudyPageRecord = {
    id: id(),
    title: input.title.trim() || "Sem título",
    ...(input.parentPageId ? { parentPageId: input.parentPageId } : {}),
    content: [],
    contentSchemaVersion: 1,
    topicLinks: input.topicLinks ?? [],
    createdAt: now,
    updatedAt: now,
  };
  await (await database()).put("pages", page);
  return page;
}

export async function saveStudyPage(page: StudyPageRecord): Promise<StudyPageRecord> {
  const next = { ...page, updatedAt: Date.now() };
  await (await database()).put("pages", next);
  return next;
}

export async function createStudyQuestion(input: Omit<StudyQuestionRecord, "id" | "createdAt">): Promise<StudyQuestionRecord> {
  const question: StudyQuestionRecord = { ...input, id: id(), createdAt: Date.now() };
  await (await database()).put("questions", question);
  return question;
}

export async function listStudyQuestions(): Promise<StudyQuestionRecord[]> {
  return (await (await database()).getAll("questions"))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function createQuestionAttempt(
  input: Omit<QuestionAttemptRecord, "id" | "answeredAt">,
): Promise<QuestionAttemptRecord> {
  const attempt: QuestionAttemptRecord = { ...input, id: id(), answeredAt: Date.now() };
  await (await database()).put("questionAttempts", attempt);
  return attempt;
}

export async function listQuestionAttempts(): Promise<QuestionAttemptRecord[]> {
  return (await (await database()).getAll("questionAttempts"))
    .sort((a, b) => b.answeredAt - a.answeredAt);
}

export async function startStudySession(input: {
  pageId?: string;
  planId?: string;
  topicLinks?: PlanTopicRef[];
  mode?: StudySessionRecord["mode"];
}): Promise<StudySessionRecord> {
  const session: StudySessionRecord = {
    id: id(),
    ...(input.pageId ? { pageId: input.pageId } : {}),
    ...(input.planId ? { planId: input.planId } : {}),
    topicLinks: input.topicLinks ?? [],
    startedAt: Date.now(),
    mode: input.mode ?? "study",
  };
  await (await database()).put("studySessions", session);
  return session;
}

export async function finishStudySession(sessionId: string): Promise<StudySessionRecord | undefined> {
  const db = await database();
  const session = await db.get("studySessions", sessionId);
  if (!session) return undefined;
  if (session.endedAt) return session;
  const endedAt = Date.now();
  const next = {
    ...session,
    endedAt,
    durationSeconds: Math.max(0, Math.round((endedAt - session.startedAt) / 1000)),
  };
  await db.put("studySessions", next);
  return next;
}

export async function getActiveStudySession(pageId: string): Promise<StudySessionRecord | undefined> {
  const sessions = await (await database()).getAll("studySessions");
  return sessions
    .filter(session => session.pageId === pageId && !session.endedAt)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}

export async function listStudySessions(): Promise<StudySessionRecord[]> {
  return (await (await database()).getAll("studySessions"))
    .sort((a, b) => b.startedAt - a.startedAt);
}
