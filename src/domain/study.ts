export type StudySubject = "tae" | "fisica";
export type VariantFormat = "basic" | "cloze" | "typed" | "image";
export type VariantStatus = "approved" | "draft" | "rejected";
export interface FlashcardVariant {
  id: string;
  kind: string;
  format: VariantFormat | string;
  q: string;
  a: string;
  reason: string;
  source: string;
  image: string;
  mask: { x: number; y: number; w: number; h: number } | null;
  status: VariantStatus | string;
  uses: number;
  passes: number;
  failures: number;
}
export interface FsrsState {
  s: number;
  d: number;
  last: number;
  due: number;
  reps: number;
  lapses: number;
  interval: number;
}
export interface Concept {
  id: string;
  subject: StudySubject;
  topic: string;
  source: string;
  status: "published" | "draft" | string;
  variants: FlashcardVariant[];
  createdAt: number;
  fsrs: FsrsState;
  lastVariant: string;
  suspended: boolean;
}
export interface ReviewLog {
  id: string;
  conceptId: string;
  subject: StudySubject;
  topic: string;
  variantId: string;
  kind: string;
  format: string;
  grade: "again" | "hard" | "good" | "easy";
  at: number;
  wasNew: boolean;
  preview: boolean;
  typed: string;
  s: number;
  d: number;
  due: number;
}
export interface ErrorHistoryEntry {
  at: number;
  grade: "right" | "wrong";
}
export interface ErrorRecord {
  id: string;
  subject: StudySubject;
  discipline: string;
  area: string;
  topic: string;
  type: string;
  mistake: string;
  fix: string;
  reviewDays: number;
  questionUrl: string;
  conceptId: string;
  questionText: string;
  optionsText: string;
  correctAnswer: string;
  at: number;
  nextReview: number;
  successes: number;
  failures: number;
  status: "pendente" | "dominado" | string;
  history: ErrorHistoryEntry[];
}
export interface QuestionBlock {
  id: string;
  subject: StudySubject;
  topic: string;
  at: number;
  total: number;
  correct: number;
  note: string;
}
export interface LearningSession {
  id: string;
  mode: string;
  topic: string;
  subject: StudySubject;
  grade: string;
  at: number;
}
export interface StudySettings {
  retention: number;
  newLimit: number;
  reviewLimit: number;
  leech: number;
}
