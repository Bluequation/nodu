import {useEffect,useState} from "react";
import {useSearchParams} from "react-router-dom";
import {getPlan} from "../../data/plans";
import type {StudyPlan} from "../../domain/models";
import {resolveTopic,topicUrl} from "../../domain/topicContext";
import {pieceTitle,topicPlacement,areaDisplayName} from "../plans/planner/plannerModel";
export function useStudyContext(){
 const [params]=useSearchParams(),planId=params.get("plan")||"",nodeId=params.get("topic")||"",date=params.get("date")||"";
 const requested=Boolean(planId&&nodeId);
 const [plan,setPlan]=useState<StudyPlan|null>(null),[loaded,setLoaded]=useState("");
 const key=planId+"|"+nodeId;
 useEffect(()=>{let live=true;if(!requested)return;getPlan(planId).then(p=>{if(live){setPlan(p||null);setLoaded(key);}}).catch(()=>{if(live){setPlan(null);setLoaded(key);}});return()=>{live=false;};},[planId,nodeId,requested,key]);
 const ref={planId,nodeId},leaf=requested&&loaded===key?resolveTopic(plan,ref):undefined;
 return {requested,loading:requested&&loaded!==key,valid:!!leaf,ref,plan,leaf,date,title:leaf?pieceTitle(leaf.name):"",area:leaf&&plan?areaDisplayName(topicPlacement(leaf,plan.area).groups[0]||"Assunto"):"",returnTo:requested?topicUrl("/learn",ref,date):"/learn"};
}
