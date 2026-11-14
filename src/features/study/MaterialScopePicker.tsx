import {useEffect,useState} from "react";
import {useSearchParams} from "react-router-dom";
import {listPlans} from "../../data/plans";
import type {StudyPlan} from "../../domain/models";
import {getSelectedLeaves} from "../../domain/verticalization";
import {pieceTitle,topicPlacement,areaDisplayName,topicTone} from "../plans/planner/plannerModel";
import type {PlanTopicRef} from "../../domain/study";
export function useMaterialPlans(){const [plans,setPlans]=useState<StudyPlan[]>([]);useEffect(()=>{listPlans().then(setPlans).catch(()=>{});},[]);return plans;}
export function materialLabel(plans:StudyPlan[],ref:PlanTopicRef){const p=plans.find(p=>p.id===ref.planId),leaf=p&&getSelectedLeaves(p.tree).find(l=>l.id===ref.nodeId);return p&&leaf?{plan:p.title,title:pieceTitle(leaf.name),area:areaDisplayName(topicPlacement(leaf,p.area).groups[0]||"Assunto"),tone:topicTone(leaf,p.area)}:null;}
export function MaterialScopePicker({plans,disabled=false,onChange,creation=false}:{plans:StudyPlan[];disabled?:boolean;onChange?:()=>void;creation?:boolean}){
 const [params,setParams]=useSearchParams(),planId=params.get("plan")||"",nodeId=params.get("topic")||"",plan=plans.find(p=>p.id===planId),leaves=plan?getSelectedLeaves(plan.tree):[];
 function choose(p:string,n:string){const next=new URLSearchParams(params);if(p)next.set("plan",p);else next.delete("plan");if(n)next.set("topic",n);else next.delete("topic");setParams(next);onChange?.();}
 return <div className="rm-scope"><label>Plano<select aria-label="Plano do material" value={planId} disabled={disabled} onChange={e=>choose(e.target.value,"")}><option value="">{creation?"Estudo livre (sem plano)":"Todos / sem plano"}</option>{plans.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>{plan&&<label>Assunto<select aria-label="Assunto do material" value={nodeId} disabled={disabled} onChange={e=>choose(planId,e.target.value)}><option value="">{creation?"Selecione um assunto":"Todos os assuntos"}</option>{[...leaves].sort((a,b)=>pieceTitle(a.name).localeCompare(pieceTitle(b.name),"pt-BR")).map(l=><option key={l.id} value={l.id}>{areaDisplayName(topicPlacement(l,plan.area).groups[0]||"Assunto")} · {pieceTitle(l.name)}</option>)}</select></label>}</div>;
}

export function materialRoute(path:string,params:URLSearchParams){const q=new URLSearchParams();for(const k of ["plan","topic","date"]){const v=params.get(k);if(v)q.set(k,v);}return path+(q.size?"?"+q.toString():"");}
