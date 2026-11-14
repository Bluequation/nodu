import type {StudyPlan} from "../../domain/models";
import type {PlanTopicRef} from "../../domain/study";
import {linkedToPlan} from "../../domain/topicContext";
import {getSelectedLeaves} from "../../domain/verticalization";
import {areaDisplayName,displayNodeName,minutesForDay,pieceTitle,topicPlacement,topicTone,type AreaTone} from "../plans/planner/plannerModel";
export const weekdays=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
export const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export function fromDateKey(key:string){const [y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d);}
export const monthStart=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),1);
export function monthDates(month:Date){const d=monthStart(month),lead=(d.getDay()+6)%7,n=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();return Array.from({length:Math.ceil((lead+n)/7)*7},(_,i)=>new Date(d.getFullYear(),d.getMonth(),i-lead+1));}
export type ReviewItem={id:string;topic:string;type:"Flashcards"|"Caderno de erros";subject:string;due:number;planTopics?:PlanTopicRef[]};
export type AgendaEvent={id:string;kind:"study"|"simulation"|"review";title:string;original:string;tone:AreaTone|"simulation"|"review";area:string;planId?:string;nodeId?:string;done:boolean;reviewType?:ReviewItem["type"]};
export type Session={planId:string;title:string;time:string;minutes:number;events:AgendaEvent[]};
export function preparePlans(plans:StudyPlan[],filter:string){return plans.filter(p=>p.status==="active"&&p.scheduleConfig&&(filter==="all"||p.id===filter)).map(plan=>({plan,leaves:new Map(getSelectedLeaves(plan.tree).map(l=>[l.id,l]))}));}
export function eventsForDay(date:Date,prepared:ReturnType<typeof preparePlans>,reviews:ReviewItem[],filter:string){
 const key=dateKey(date),day=date.getDay();
 const sessions:Session[]=prepared.flatMap(({plan,leaves})=>{
  const c=plan.scheduleConfig!;if(!c.days.includes(day)||(c.startDate&&key<c.startDate)||(c.examDate&&key>c.examDate))return [];
  const slot=c.daySchedules?.[day],time=slot?.startTime&&slot.endTime?slot.startTime+"–"+slot.endTime:"";
  const events:AgendaEvent[]=[];
  if(slot?.simulation)events.push({id:plan.id+":simulation",kind:"simulation",title:"Simulado",original:"Dia reservado para simulado",tone:"simulation",area:plan.area,planId:plan.id,done:(slot.completedDates||[]).includes(key)});
  const seen=new Set<string>();
  for(const item of plan.assignments){const leaf=leaves.get(item.nodeId);if(!leaf||item.day!==day||seen.has(item.nodeId))continue;seen.add(item.nodeId);
   events.push({id:plan.id+":"+leaf.id,kind:"study",title:pieceTitle(leaf.name),original:displayNodeName(leaf.name),tone:topicTone(leaf,plan.area),area:areaDisplayName(topicPlacement(leaf,plan.area).groups[0]||"Outros assuntos"),planId:plan.id,nodeId:leaf.id,done:(item.completedDates||[]).includes(key)});
  }
  return events.length?[{planId:plan.id,title:plan.title,time,minutes:minutesForDay(c,day),events}]:[];
 });
 const revisions:AgendaEvent[]=reviews.filter(i=>(filter==="all"||prepared.some(({plan})=>linkedToPlan(i,plan)))&&Number.isFinite(i.due)&&dateKey(new Date(i.due))===key).map(i=>({id:"review:"+i.type+":"+i.id,kind:"review",title:pieceTitle(i.topic),original:i.topic,tone:"review",area:i.subject,reviewType:i.type,done:false}));
 return {sessions,revisions,events:[...sessions.flatMap(s=>s.events),...revisions]};
}
export function toggleDatedCompletion(plan:StudyPlan,event:AgendaEvent,key:string):StudyPlan{
 const day=fromDateKey(key).getDay(),c=plan.scheduleConfig;
 if(event.planId!==plan.id||!c||!c.days.includes(day)||(c.startDate&&key<c.startDate)||(c.examDate&&key>c.examDate))return plan;
 const flip=(dates:string[]|undefined)=>{const next=new Set(dates||[]);if(next.has(key))next.delete(key);else next.add(key);return [...next].sort();};
 if(event.kind==="simulation"){const slot=c.daySchedules?.[day];if(!slot?.simulation)return plan;return {...plan,scheduleConfig:{...c,daySchedules:{...c.daySchedules,[day]:{...slot,completedDates:flip(slot.completedDates)}}}};}
 if(event.kind!=="study"||!getSelectedLeaves(plan.tree).some(l=>l.id===event.nodeId)||!plan.assignments.some(i=>i.nodeId===event.nodeId&&i.day===day))return plan;
 return {...plan,assignments:plan.assignments.map(i=>i.nodeId===event.nodeId&&i.day===day?{...i,completedDates:flip(i.completedDates)}:i)};
}
