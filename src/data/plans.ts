import { database } from "./database";
import type { NewStudyPlan, StudyPlan } from "../domain/models";

export async function listPlans(): Promise<StudyPlan[]> {
  return (await (await database()).getAll("plans")).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getPlan(id: string): Promise<StudyPlan | undefined> {
  return (await database()).get("plans", id);
}
export async function createPlan(input: NewStudyPlan): Promise<StudyPlan> {
  const now = Date.now();
  const plan: StudyPlan = {
    ...input,
    id: crypto.randomUUID(),
    sourceFile: "",
    sourceText: "",
    tree: [],
    warnings: [],
    selectionIndex: 0,
    stage: "source",
    scheduleConfig: null,
    assignments: [],
    createdAt: now,
    updatedAt: now,
    status: "draft",
  };
  await (await database()).put("plans", plan);
  return plan;
}
export async function savePlan(plan: StudyPlan): Promise<StudyPlan> {
  const next = { ...plan, updatedAt: Date.now() };
  await (await database()).put("plans", next);
  return next;
}
export async function deletePlan(id: string): Promise<void> {
  await (await database()).delete("plans", id);
}
