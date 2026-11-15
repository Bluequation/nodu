import type { PlanTopicRef, StudySubject } from "./study";

export interface StudyPageRecord {
  id: string;
  title: string;
  parentPageId?: string;
  icon?: string;
  content: unknown[];
  contentSchemaVersion: number;
  topicLinks: PlanTopicRef[];
  createdAt: number;
  updatedAt: number;
}

export interface StudyQuestionRecord {
  id: string;
  statement: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  source: string;
  board: string;
  exam: string;
  year: string;
  difficulty: string;
  topicLinks: PlanTopicRef[];
  createdAt: number;
}

export interface QuestionAttemptRecord {
  id: string;
  questionId: string;
  answeredAt: number;
  selectedAnswer: string;
  isCorrect: boolean;
  mode: "practice" | "simulation" | "review";
  sessionId?: string;
  timeSpentSeconds?: number;
  topicLinks: PlanTopicRef[];
}

export interface StudySessionRecord {
  id: string;
  pageId?: string;
  planId?: string;
  topicLinks: PlanTopicRef[];
  startedAt: number;
  endedAt?: number;
  durationSeconds?: number;
  mode: "study" | "practice" | "simulation";
  notes?: string;
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/[).,:;\s]+$/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function answerIsCorrect(selected: string, expected: string): boolean {
  const a = normalizeAnswer(selected);
  const b = normalizeAnswer(expected);
  return Boolean(a && b && a === b);
}

export interface TopicPerformance {
  key: string;
  planId: string;
  nodeId: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

export function calculateTopicPerformance(
  attempts: QuestionAttemptRecord[],
): TopicPerformance[] {
  const groups = new Map<string, TopicPerformance>();
  for (const attempt of attempts) {
    const seen = new Set<string>();
    for (const link of attempt.topicLinks ?? []) {
      const key = `${link.planId}:${link.nodeId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const current = groups.get(key) ?? {
        key,
        planId: link.planId,
        nodeId: link.nodeId,
        attempts: 0,
        correct: 0,
        accuracy: 0,
      };
      current.attempts += 1;
      if (attempt.isCorrect) current.correct += 1;
      current.accuracy = Math.round((current.correct / current.attempts) * 100);
      groups.set(key, current);
    }
  }
  return [...groups.values()].sort((a, b) =>
    a.accuracy - b.accuracy || b.attempts - a.attempts,
  );
}

export function subjectForArea(area: string): StudySubject {
  const normalized = normalizeAnswer(area);
  if (normalized.includes("fisic")) return "fisica";
  if (normalized.includes("tae") || normalized.includes("tecnico administrativo")) return "tae";
  return "general";
}
