import type {DaySchedule,PlanAssignment,ScheduleConfig,StudyPlan} from "../../../domain/models";
import type {SelectedPlanLeaf} from "../../../domain/verticalization";
export const WEEKDAYS = [
  { id: 1, label: "Segunda", short: "Seg" },
  { id: 2, label: "Terça", short: "Ter" },
  { id: 3, label: "Quarta", short: "Qua" },
  { id: 4, label: "Quinta", short: "Qui" },
  { id: 5, label: "Sexta", short: "Sex" },
  { id: 6, label: "Sábado", short: "Sáb" },
  { id: 0, label: "Domingo", short: "Dom" },
];
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function displayNodeName(name: string) {
  return name.replace(/^\s*\[EDITAL\]\s*/i, "").trim();
}
export function durationFromTimes(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end < start) end += 24 * 60;
  return end - start;
}
export function minutesForDay(config: ScheduleConfig, dayId: number) {
  const slot = config.daySchedules?.[dayId];
  if (slot) return durationFromTimes(slot.startTime, slot.endTime);
  if (config.daySchedules) return 0;
  return config.sameMinutes === false ? (config.dayMinutes?.[dayId] ?? config.minutes) : config.minutes;
}
export function formatDuration(minutes: number) {
  if (!minutes) return "Horário ainda não definido";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h ${remainder}min disponíveis`;
  if (hours) return `${hours}h disponíveis`;
  return `${remainder}min disponíveis`;
}
export function emptyDaySchedule(): DaySchedule {
  return { startTime: "", endTime: "", simulation: false };
}
function assignmentFromLeaf(leaf: SelectedPlanLeaf, day = -1): PlanAssignment {
  return {
    nodeId: leaf.id,
    name: displayNodeName(leaf.name),
    path: leaf.path.map(displayNodeName),
    origin: leaf.origin,
    sourceRef: leaf.sourceRef,
    day,
  };
}
export function reconcileAssignments(leaves: SelectedPlanLeaf[], existing: PlanAssignment[], days: number[]) {
  const byId = new Map(existing.map(item => [item.nodeId, item]));
  return leaves.map(leaf => {
    const current = byId.get(leaf.id);
    if (!current) return assignmentFromLeaf(leaf, -1);
    return { ...assignmentFromLeaf(leaf, current.day), ...current,
      day: current.day >= 0 && days.includes(current.day) ? current.day : -1 };
  });
}
export const defaultSchedule = (plan: StudyPlan): ScheduleConfig => ({
  startDate: today(),
  examDate: plan.examDate || "",
  days: [],
  minutes: 0,
  sameMinutes: false,
  dayMinutes: {},
  daySchedules: {},
  priorityOrder: [],
  mode: "alternate",
});


export function plannerShortTitle(value:string) {
  let name=displayNodeName(value).replace(/^\d+(?:\.\d+)*\.?\s*/,"").replace(/\s+/g," ").trim();
  const rules: Array<[RegExp,string]> = [
    [/lei\s+federal\s+n[º°o.]?\s*9[.\s]?394\s*\/\s*96/i,"LDB — Lei 9.394/96"],
    [/lei\s+federal\s+n[º°o.]?\s*10[.\s]?639\s*\/\s*2003/i,"Lei 10.639/2003 — Cultura afro-brasileira e africana"],
    [/lei\s+federal\s+n[º°o.]?\s*11[.\s]?645\s*\/\s*2008/i,"Lei 11.645/2008 — Cultura afro-brasileira e indígena"],
    [/^as bases empíricas, metodológicas e epistemológicas das diversas teorias de aprendizagem/i,"Fundamentos das teorias de aprendizagem"],
    [/^a didática como fundamento epistemológico do fazer docente/i,"Didática e prática docente"],
    [/^fundamentos e princípios que orientam a BNCC/i,"Fundamentos e princípios da BNCC"],
  ];
  for(const [pattern,label] of rules) if(pattern.test(name))return label;
  name=name.replace(/^(?:noções gerais de|noções de|aspectos gerais de)\s+/i,"").replace(/\.$/,"");
  if(name.length<=68)return name||displayNodeName(value);
  const clause=name.split(/[:;] /)[0];
  if(clause.length>=20&&clause.length<=62)return clause+"…";
  const limit=name.lastIndexOf(" ",65);
  return name.slice(0,limit>35?limit:65).trimEnd()+"…";
}

export const normalizePlannerText=(value:string)=>value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
// Presentation aliases never change the authoritative edital text or ID.
export function pieceTitle(value:string){
  const original=displayNodeName(value).replace(/^\d+(?:\.\d+)*\.?\s*/,"").trim();
  const key=normalizePlannerText(original);
  const aliases: Array<[RegExp,string]>=[
    [/^(?:lei federal |lei )?n? ?9 394 96\b|^ldb\b/,"LDB"],
    [/^(?:lei federal |lei )?n? ?10 639 2003\b/,"Lei 10.639/2003"],
    [/^(?:lei federal |lei )?n? ?11 645 2008\b/,"Lei 11.645/2008"],
    [/^planos nacionais de educacao\b/,"PNE"],
    [/^fundamentos e principios que orientam a bncc\b/,"Fundamentos da BNCC"],
    [/^base nacional comum curricular(?: bncc)?$/,"BNCC"],
    [/^sistema permanente de avaliacao da educacao basica(?: spaece)?$/,"SPAECE"],
    [/^sistema nacional de avaliacao da educacao basica(?: saeb)?$/,"SAEB"],
    [/^exame nacional do ensino medio(?: enem)?$/,"ENEM"],
    [/^programa internacional de avaliacao de estudantes(?: pisa)?$/,"PISA"],
    [/^curriculo e educacao integral$/,"Currículo e educação integral"],
    [/^estatuto dos servidores(?: publicos)? do estado do ceara\b/,"Estatuto dos servidores (CE)"],
    [/^compreensao e interpretacao de textos?$/,"Compreensão e interpretação textual"],
    [/^as bases empiricas metodologicas e epistemologicas das diversas teorias de aprendizagem$/,"Bases das teorias de aprendizagem"],
    [/^a pesquisa na pratica docente$/,"Pesquisa na prática docente"],
    [/^a dimensao etica da profissao$/,"Ética profissional"],
    [/^a sala de aula como espaco de aprendizagem$/,"Sala de aula e aprendizagem"],
    [/^organizacao curricular$/,"Organização curricular"],
    [/^o ensino medio no contexto da educacao basica$/,"Ensino médio na educação básica"],
    [/^movimento uniformemente variado(?: mruv)?$/,"MRUV"],
    [/^movimento retilineo uniforme(?: mru)?$/,"MRU"],
    [/^movimento uniforme(?: mu)?$/,"Movimento uniforme"],
    [/^relacoes sintaticas na organizacao da oracao e do periodo$/,"Sintaxe da oração e do período"],
  ];
  for(const [pattern,label] of aliases)if(pattern.test(key))return label;
  // Generic fallback retains the original wording rather than guessing its scope.
  return original.replace(/^(?:noções gerais de|noções de|aspectos gerais de)\s+/i,"").replace(/\.$/,"")||original;
}
export type LibraryGroup={key:string;label:string;groups:LibraryGroup[];topics:SelectedPlanLeaf[]};
export type LibraryColumn={key:"general"|"specific";label:string;groups:LibraryGroup[]};
const basic=/\bconhecimentos (?:basicos|gerais)\b/;
const specific=/\bconhecimentos especificos\b/;
const legal=/^(?:(?:lei|leis|decreto|estatuto|constituicao|legislacao|ldb|pne|planos nacionais de educacao|documento curricular referencial|base legal|marcos legais)\b|base nacional comum curricular(?: bncc)?$|bncc$|fundamentos e principios que orientam a bncc$)/;
const clean=(name:string)=>displayNodeName(name).replace(/^\d+(?:\.\d+)*\.?\s*/,"").trim();
export function topicPlacement(leaf:SelectedPlanLeaf,area=""){
  const path=leaf.path.slice(0,-1).map(clean).filter(Boolean), keys=path.map(normalizePlannerText), areaKey=normalizePlannerText(area);
  const isSpecific=keys.some(k=>specific.test(k))||(!keys.some(k=>basic.test(k))&&!!areaKey&&areaKey!=="geral"&&keys.some(k=>k===areaKey));
  const groups=path.filter(g=>!basic.test(normalizePlannerText(g))&&!specific.test(normalizePlannerText(g)));
  if(isSpecific){
    if(areaKey&&areaKey!=="geral"&&!groups.some(g=>normalizePlannerText(g)===areaKey))groups.unshift(area);
    return {column:"specific" as const,groups:groups.length?groups:["Outros assuntos"]};
  }
  if(keys.some(k=>/^educacao brasileira.*(?:educacionais|pedagogicos)|^pedagogia$|^legislacao educacional$/.test(k))){
    return {column:"general" as const,groups:[legal.test(normalizePlannerText(clean(leaf.name)))||keys.some(k=>/^legislacao\b/.test(k))?"Legislação":"Pedagogia"]};
  }
  return {column:"general" as const,groups:groups.length?groups:["Outros assuntos"]};
}
export function makeLibrary(leaves:SelectedPlanLeaf[],area="",visibleIds?:ReadonlySet<string>):LibraryColumn[]{
  const columns:LibraryColumn[]=[{key:"general",label:"Conhecimentos gerais",groups:[]},{key:"specific",label:"Conhecimentos específicos",groups:[]}];
  for(const leaf of leaves){
    const place=topicPlacement(leaf,area);let current=columns.find(c=>c.key===place.column)!.groups,key:string=place.column,last:LibraryGroup|undefined;
    for(const label of place.groups){
      key+="/"+normalizePlannerText(label);let group=current.find(g=>g.key===key);
      if(!group){group={key,label,groups:[],topics:[]};current.push(group);}
      last=group;current=group.groups;
    }
    if(!visibleIds||visibleIds.has(leaf.id))last?.topics.push(leaf);
  }
  const ranks=["Legislação","Pedagogia","Português"];
  columns[0].groups.sort((a,b)=>(ranks.includes(a.label)?ranks.indexOf(a.label):99)-(ranks.includes(b.label)?ranks.indexOf(b.label):99));
  const collator=new Intl.Collator("pt-BR",{sensitivity:"base",numeric:true});
  function sortTopics(group:LibraryGroup){
    group.topics.sort((a,b)=>collator.compare(pieceTitle(a.name),pieceTitle(b.name))||collator.compare(a.id,b.id));
    group.groups.sort((a,b)=>collator.compare(areaDisplayName(a.label),areaDisplayName(b.label)));
    group.groups.forEach(sortTopics);
  }
  columns.forEach(column=>column.groups.forEach(sortTopics));
  return columns;
}
export function availableTopics(leaves:SelectedPlanLeaf[],assignments:PlanAssignment[],days:number[]){
  const byId=new Map(assignments.map(item=>[item.nodeId,item.day]));
  return leaves.filter(leaf=>!days.includes(byId.get(leaf.id)??-1));
}
export function changePlacement(config:ScheduleConfig,assignments:PlanAssignment[],id:string,day:number){
  const item=assignments.find(a=>a.nodeId===id);
  if(!item||item.day===day||(day!==-1&&!WEEKDAYS.some(d=>d.id===day)))return {config,assignments};
  const next=day>=0&&!config.days.includes(day)?{...config,days:WEEKDAYS.filter(d=>d.id===day||config.days.includes(d.id)).map(d=>d.id),daySchedules:{...(config.daySchedules||{}),[day]:config.daySchedules?.[day]||emptyDaySchedule()}}:config;
  return {config:next,assignments:assignments.map(a=>a.nodeId===id?{...a,day}:a)};
}

/** Explicit restart only: preserve exam dates, node identity and dated completion history. */
export function restartWeek(config:ScheduleConfig,assignments:PlanAssignment[]){
  const daySchedules:Record<number,DaySchedule>={};
  for(const day of WEEKDAYS){
    const dates=config.daySchedules?.[day.id]?.completedDates;
    if(dates?.length)daySchedules[day.id]={...emptyDaySchedule(),completedDates:[...dates]};
  }
  return {config:{...config,days:[],minutes:0,dayMinutes:{},sameMinutes:false,daySchedules},assignments:assignments.map(item=>({...item,day:-1}))};
}

/** Stable presentation palette shared by library cards and their assigned pieces. */
export type AreaTone="law"|"pedagogy"|"administration"|"language"|"data"|"specific"|"neutral";
export function areaTone(column:"general"|"specific",label:string):AreaTone{
  if(column==="specific")return "specific";
  const key=normalizePlannerText(label);
  if(/legislacao|direito/.test(key))return "law";
  if(/pedagogia|educacao brasileira|didatica/.test(key))return "pedagogy";
  if(/administracao|gestao publica/.test(key))return "administration";
  if(/portugues|lingua portuguesa|linguagem/.test(key))return "language";
  if(/indicadores|estatistica|dados|raciocinio logico/.test(key))return "data";
  return "neutral";
}
export function topicTone(leaf:SelectedPlanLeaf,area=""):AreaTone{
  const placement=topicPlacement(leaf,area);
  return areaTone(placement.column,placement.groups[0]||"");
}
export function areaDisplayName(value:string){
  const key=normalizePlannerText(value);
  if(/^leitura e interpretacao de dados e indicadores educacionais$/.test(key))return "Dados e indicadores";
  if(/^lingua portuguesa$/.test(key))return "Português";
  return value.replace(/\.$/,"");
}
