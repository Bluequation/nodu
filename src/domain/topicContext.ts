import type {StudyPlan} from "./models";
import type {PlanTopicRef} from "./study";
import {getSelectedLeaves} from "./verticalization";
export const sameTopic=(a:PlanTopicRef,b:PlanTopicRef)=>a.planId===b.planId&&a.nodeId===b.nodeId;
export const linkedTo=(item:{planTopics?:PlanTopicRef[]},ref:PlanTopicRef)=>Boolean(item.planTopics?.some(r=>sameTopic(r,ref)));
export const linkedToPlan=(item:{planTopics?:PlanTopicRef[]},plan:StudyPlan)=>Boolean(item.planTopics?.some(r=>r.planId===plan.id&&getSelectedLeaves(plan.tree).some(l=>l.id===r.nodeId)));
export function addTopicLink(links:PlanTopicRef[]|undefined,ref:PlanTopicRef){return (links||[]).some(x=>sameTopic(x,ref))?links!:[...(links||[]),ref];}
export function resolveTopic(plan:StudyPlan|undefined|null,ref:PlanTopicRef){return plan?.id===ref.planId?getSelectedLeaves(plan.tree).find(l=>l.id===ref.nodeId):undefined;}
export function dateKey(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
export function topicScheduled(plan:StudyPlan,nodeId:string,key:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return false;
 const date=new Date(key+"T12:00:00");if(!Number.isFinite(date.getTime())||dateKey(date)!==key)return false;
 const c=plan.scheduleConfig;
 return Boolean(c&&c.days.includes(date.getDay())&&(!c.startDate||key>=c.startDate)&&(!c.examDate||key<=c.examDate)&&resolveTopic(plan,{planId:plan.id,nodeId})&&plan.assignments.some(a=>a.nodeId===nodeId&&a.day===date.getDay()));
}
export function markTopicStudied(plan:StudyPlan,ref:PlanTopicRef,key:string,today=dateKey()){
 if(plan.id!==ref.planId||key>today||!topicScheduled(plan,ref.nodeId,key))return plan;
 if(plan.assignments.some(a=>a.nodeId===ref.nodeId&&a.completedDates?.includes(key)))return plan;
 return {...plan,assignments:plan.assignments.map(a=>a.nodeId===ref.nodeId?{...a,completedDates:[...new Set([...(a.completedDates||[]),key])].sort()}:a)};
}
export function topicUrl(path:string,ref:PlanTopicRef,date?:string){const q=new URLSearchParams({plan:ref.planId,topic:ref.nodeId});if(date)q.set("date",date);return path+"?"+q.toString();}
export function learnUrl(planId:string,date?:string,nodeId?:string){const q=new URLSearchParams({plan:planId});if(date)q.set("date",date);if(nodeId)q.set("topic",nodeId);return "/learn?"+q.toString();}
