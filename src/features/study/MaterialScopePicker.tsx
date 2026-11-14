import {useEffect,useMemo,useState} from "react";
import {useSearchParams} from "react-router-dom";
import {listPlans} from "../../data/plans";
import type {StudyPlan} from "../../domain/models";
import {getSelectedLeaves} from "../../domain/verticalization";
import {pieceTitle,topicPlacement,areaDisplayName,topicTone} from "../plans/planner/plannerModel";
import type {PlanTopicRef} from "../../domain/study";
import {buildMaterialPaths,choicesAt,materialLevelLabel} from "./materialScopeModel";
export function useMaterialPlans(){const [plans,setPlans]=useState<StudyPlan[]>([]);useEffect(()=>{listPlans().then(setPlans).catch(()=>{});},[]);return plans;}
export function materialLabel(plans:StudyPlan[],ref:PlanTopicRef){const p=plans.find(p=>p.id===ref.planId),leaf=p&&getSelectedLeaves(p.tree).find(l=>l.id===ref.nodeId);return p&&leaf?{plan:p.title,title:pieceTitle(leaf.name),area:areaDisplayName(topicPlacement(leaf,p.area).groups[0]||"Assunto"),tone:topicTone(leaf,p.area)}:null;}
export function MaterialScopePicker({plans,disabled=false,onChange,creation=false}:{plans:StudyPlan[];disabled?:boolean;onChange?:()=>void;creation?:boolean}){
 const [params,setParams]=useSearchParams(),planId=params.get("plan")||"",nodeId=params.get("topic")||"";
 const plan=plans.find(p=>p.id===planId);
 const paths=useMemo(()=>plan?buildMaterialPaths(getSelectedLeaves(plan.tree),plan.area):[],[plan]);
 const [draft,setDraft]=useState<{planId:string;prefix:string[]}>({planId:"",prefix:[]});
 const selected=paths.find(path=>path.leaf.id===nodeId);
 const prefix=selected?selected.steps.map(step=>step.key):draft.planId===planId?draft.prefix:[];
 const levels:Array<{label:string;choices:ReturnType<typeof choicesAt>;value:string}>=[];
 for(let depth=0;depth<=prefix.length;depth++){
  const choices=choicesAt(paths,prefix.slice(0,depth));if(!choices.length)break;
  levels.push({label:materialLevelLabel(depth),choices,value:prefix[depth]||""});
  if(!prefix[depth])break;
 }
 function choose(p:string,n:string){const next=new URLSearchParams(params);if(p)next.set("plan",p);else next.delete("plan");if(n)next.set("topic",n);else next.delete("topic");setParams(next);onChange?.();}
 function changeLevel(depth:number,value:string){
  const next=prefix.slice(0,depth);if(value)next.push(value);
  setDraft({planId,prefix:next});
  const option=levels[depth]?.choices.find(choice=>choice.key===value);
  choose(planId,option?.nodeId||"");
 }
 return <div className="rm-scope rm-hierarchy">
  <div className="rm-hierarchy-fields">
   <label>Plano<select aria-label="Plano do material" value={planId} disabled={disabled} onChange={e=>{setDraft({planId:e.target.value,prefix:[]});choose(e.target.value,"");}}><option value="">{creation?"Estudo livre (sem plano)":"Todos / sem plano"}</option>{plans.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
   {plan&&levels.map((level,depth)=><label key={depth} data-tone={level.choices.find(choice=>choice.key===level.value)?.tone||undefined}>{level.label}<select aria-label={level.label+" do material"} value={level.value} disabled={disabled} title={level.choices.find(choice=>choice.key===level.value)?.fullLabel||level.label} onChange={e=>changeLevel(depth,e.target.value)}><option value="">Selecione {depth===0?"a área":depth===1?"a disciplina":"o "+level.label.toLocaleLowerCase("pt-BR")}</option>{level.choices.map(choice=><option key={choice.key} value={choice.key} title={choice.fullLabel}>{choice.label}</option>)}</select></label>)}
  </div>
  {plan&&selected&&<div className="rm-hierarchy-path" aria-live="polite" title={selected.leaf.path.join(" › ")}>{selected.steps.map((step,index)=><span key={index} data-tone={step.tone}>{step.fullLabel}</span>)}</div>}
  {plan&&!paths.length&&<small className="rm-hierarchy-note">Nenhum conteúdo selecionado neste plano.</small>}
  {plan&&paths.length>0&&!selected&&!creation&&<small className="rm-hierarchy-note">Mostrando o plano inteiro. Selecione o item final para filtrar por assunto.</small>}
 </div>;
}

export function materialRoute(path:string,params:URLSearchParams){const q=new URLSearchParams();for(const k of ["plan","topic","date"]){const v=params.get(k);if(v)q.set(k,v);}return path+(q.size?"?"+q.toString():"");}
