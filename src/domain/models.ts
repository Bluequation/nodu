export type PlanOrigin = "edital" | "suggested" | "manual";
export type PlanStage = "source" | "selection" | "schedule";
export interface PlanNode {
  id: string;
  name: string;
  origin: PlanOrigin;
  sourceRef: string;
  sourceText: string;
  selected: boolean;
  children: PlanNode[];
}
export interface DaySchedule {
  startTime: string;
  endTime: string;
  simulation: boolean;
  completedDates?: string[];
}
export interface ScheduleConfig {
  startDate: string;
  examDate: string;
  days: number[];
  minutes: number;
  mode: "alternate" | "sequence" | "priority";
  sameMinutes?: boolean;
  dayMinutes?: Record<number, number>;
  priorityOrder?: string[];
  daySchedules?: Record<number, DaySchedule>;
}
export interface PlanAssignment {
  nodeId: string;
  name: string;
  path: string[];
  origin: PlanOrigin;
  sourceRef: string;
  day: number;
  done?: boolean;
  completedDates?: string[];
}
export interface StudyPlan {
  id: string;
  title: string;
  institution: string;
  position: string;
  area: string;
  organizer: string;
  examDate: string;
  sourceFile: string;
  sourceText: string;
  tree: PlanNode[];
  warnings: string[];
  selectionIndex: number;
  stage: PlanStage;
  scheduleConfig: ScheduleConfig | null;
  assignments: PlanAssignment[];
  createdAt: number;
  updatedAt: number;
  status: "draft" | "active" | "completed";
}
export type NewStudyPlan = Pick<StudyPlan,
  "title" | "institution" | "position" | "area" | "organizer" | "examDate"
>;
