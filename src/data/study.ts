import { database } from "./database";
import type {ErrorNotebookColumn, ErrorNotebookSettings, PlanTopicRef} from "../domain/study";
import {addTopicLink,resolveTopic,markTopicStudied,topicScheduled,dateKey} from "../domain/topicContext";
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
export async function createConcept(input: Pick<Concept, "subject" | "topic" | "source" | "planTopics">, variants: FlashcardVariant[], status: Concept["status"] = "published"): Promise<Concept> {
  const now = Date.now();
  const concept: Concept = {
    id: newId(),
    subject: input.subject,
    topic: input.topic.trim(),
    source: input.source.trim(),
    ...(input.planTopics?.length?{planTopics:input.planTopics}:{}),
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

const DEFAULT_ERROR_NOTEBOOK_COLUMNS: ErrorNotebookColumn[] = [
  { id: "date", label: "Data", kind: "date" },
  { id: "type", label: "Tipo", kind: "type" },
  { id: "discipline", label: "Disciplina", kind: "discipline" },
  { id: "area", label: "Área", kind: "text" },
  { id: "topic", label: "Assunto", kind: "text" },
  { id: "mistake", label: "Erro", kind: "longtext" },
  { id: "fix", label: "Correção", kind: "longtext" },
  { id: "reviewDays", label: "Próxima revisão", kind: "interval" },
  { id: "nextReview", label: "Data da revisão", kind: "reviewDate" },
  { id: "questionUrl", label: "URL da questão", kind: "url" },
  { id: "attachments", label: "Anexar questão", kind: "attachment" },
];

export async function getErrorNotebookSettings(): Promise<ErrorNotebookSettings> {
  const entry = await (await database()).get("appState", "error-notebook-settings");
  const saved = (entry?.value ?? {}) as Partial<ErrorNotebookSettings>;
  const savedColumns = Array.isArray(saved.columns) ? saved.columns : [];
  const validColumns = savedColumns.filter(column =>
    !!column && typeof column.id === "string" && typeof column.label === "string" &&
    typeof column.kind === "string"
  );
  const seen = new Set(validColumns.map(column => column.id));
  const columns = [
    ...validColumns,
    ...DEFAULT_ERROR_NOTEBOOK_COLUMNS.filter(column => !seen.has(column.id)),
  ];
  const disciplines = Array.isArray(saved.disciplines)
    ? saved.disciplines.filter(value => typeof value === "string" && value.trim()).map(value => value.trim())
    : [];
  return { columns, disciplines };
}

export async function saveErrorNotebookSettings(settings: ErrorNotebookSettings): Promise<void> {
  await (await database()).put("appState", { key: "error-notebook-settings", value: settings });
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

export type MaterialKind="concepts"|"errors"|"blocks";
export async function linkStudyMaterial(kind:MaterialKind,id:string,ref:PlanTopicRef){
 const db=await database();
 const tx=db.transaction(["plans","concepts","errors","blocks"],"readwrite");
 const plan=await tx.objectStore("plans").get(ref.planId);
 if(!resolveTopic(plan,ref)){await tx.done;throw Error("Assunto indisponível");}
 if(kind==="concepts"){const store=tx.objectStore("concepts"),item=await store.get(id);if(item)await store.put({...item,planTopics:addTopicLink(item.planTopics,ref)});else{await tx.done;throw Error("Material não encontrado");}}
 else if(kind==="errors"){const store=tx.objectStore("errors"),item=await store.get(id);if(item)await store.put({...item,planTopics:addTopicLink(item.planTopics,ref)});else{await tx.done;throw Error("Material não encontrado");}}
 else {const store=tx.objectStore("blocks"),item=await store.get(id);if(item)await store.put({...item,planTopics:addTopicLink(item.planTopics,ref)});else{await tx.done;throw Error("Material não encontrado");}}
 await tx.done;
}
const noteKey=(r:PlanTopicRef)=>"topic-note:"+JSON.stringify([r.planId,r.nodeId]);
export async function readTopicNote(ref:PlanTopicRef):Promise<string>{const row=await (await database()).get("appState",noteKey(ref));return typeof row?.value==="string"?row.value:"";}
export async function saveTopicNote(ref:PlanTopicRef,value:string){
 const tx=(await database()).transaction(["plans","appState"],"readwrite");
 const plan=await tx.objectStore("plans").get(ref.planId);
 if(!resolveTopic(plan,ref)){await tx.done;throw Error("Assunto indisponível");}
 await tx.objectStore("appState").put({key:noteKey(ref),value});await tx.done;
}
export async function finishTopicStudy(ref:PlanTopicRef,key:string){
 const tx=(await database()).transaction("plans","readwrite");
 const plan=await tx.store.get(ref.planId);
 if(!plan||key>dateKey()||!topicScheduled(plan,ref.nodeId,key)){await tx.done;throw Error("Sessão não disponível");}
 const next=markTopicStudied(plan,ref,key);
 if(next!==plan)await tx.store.put({...next,updatedAt:Date.now()});
 await tx.done;return next;
}

export async function importConceptDrafts(families: Pick<Concept,"subject"|"topic"|"source"|"variants">[],ref?:PlanTopicRef){const tx=(await database()).transaction(["plans","concepts"],"readwrite");if(ref&&!resolveTopic(await tx.objectStore("plans").get(ref.planId),ref)){await tx.done;throw Error("Assunto indisponível.");}const now=Date.now();for(const f of families)await tx.objectStore("concepts").add({id:newId(),subject:f.subject,topic:f.topic,source:f.source,variants:f.variants,status:"draft",createdAt:now,fsrs:emptyFsrsState(now),lastVariant:"",suspended:false,...(ref?{planTopics:[ref]}:{})});await tx.done;}
