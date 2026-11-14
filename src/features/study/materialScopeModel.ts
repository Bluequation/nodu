import type {SelectedPlanLeaf} from "../../domain/verticalization";
import {areaDisplayName,areaTone,normalizePlannerText,pieceTitle,topicPlacement} from "../plans/planner/plannerModel";

export type MaterialChoice={key:string;label:string;fullLabel:string;nodeId?:string;tone?:ReturnType<typeof areaTone>};
export type MaterialPath={leaf:SelectedPlanLeaf;steps:MaterialChoice[]};
const cmp=new Intl.Collator("pt-BR",{sensitivity:"base",numeric:true});
const clean=(s:string)=>s.replace(/^\s*\[(?:EDITAL|SUGERIDO|MANUAL)\]\s*/i,"").trim();
const key=(s:string)=>normalizePlannerText(clean(s).replace(/^\d+(?:\.\d+)*\.?\s*/,""));
const short=(s:string)=>{const label=pieceTitle(clean(s));return label.length>76?label.slice(0,73).trimEnd()+"…":label;};
const block=(s:string)=>/\bconhecimentos (?:basicos|gerais|especificos)\b/.test(key(s));

export function buildMaterialPaths(leaves:SelectedPlanLeaf[],planArea=""):MaterialPath[]{
 return leaves.map(leaf=>{
  const cleanLeaf={...leaf,name:clean(leaf.name),path:leaf.path.map(clean)};
  const placement=topicPlacement(cleanLeaf,planArea);
  const discipline=placement.groups[0]||"Outros assuntos";
  const areaLabel=placement.column==="general"?"Conhecimentos gerais":"Conhecimentos específicos";
  const tone=areaTone(placement.column,discipline);
  const disciplineLabel=areaDisplayName(discipline);
  const steps:MaterialChoice[]=[
   {key:"area:"+placement.column,label:areaLabel,fullLabel:areaLabel},
   {key:"discipline:"+key(discipline),label:short(disciplineLabel),fullLabel:disciplineLabel,tone}
  ];
  // Keep the original remaining hierarchy, including pedagogical chapters that
  // are flattened in the planner's presentation groups. Do not create topics.
  const parents=cleanLeaf.path.slice(0,-1).filter(s=>!block(s));
  if(parents.length&&(key(parents[0])===key(discipline)||key(areaDisplayName(parents[0]))===key(disciplineLabel)||(/^(legislacao|pedagogia)$/.test(key(discipline))&&/^educacao brasileira.*(?:educacionais|pedagogicos)/.test(key(parents[0])))))parents.shift();
  for(const parent of parents){
   if(!key(parent))continue;
   steps.push({key:"group:"+parent,label:short(parent),fullLabel:parent,tone});
  }
  const origin=leaf.origin==="suggested"?" · sugestão":leaf.origin==="manual"?" · manual":"";
  steps.push({key:"topic:"+leaf.id,label:short(leaf.name)+origin,fullLabel:clean(leaf.name)+origin,nodeId:leaf.id,tone});
  return {leaf,steps};
 });
}
export function choicesAt(paths:MaterialPath[],prefix:string[]):MaterialChoice[]{
 const result=new Map<string,MaterialChoice>();
 for(const path of paths){
  if(!prefix.every((key,i)=>path.steps[i]?.key===key))continue;
  const next=path.steps[prefix.length];if(next)result.set(next.key,next);
 }
 const choices=[...result.values()];
 // If an official item is itself selectable and also has selected suggested children,
 // distinguish the item from its expandable subgroup even when their labels match.
 return choices.map(choice=>choices.some(other=>other.key!==choice.key&&other.label===choice.label)?{...choice,label:choice.label+(choice.nodeId?" · item":" · subdivisões")}:choice)
 .sort((a,b)=>prefix.length===0?(a.key==="area:general"?-1:b.key==="area:general"?1:cmp.compare(a.label,b.label)):cmp.compare(a.label,b.label)||cmp.compare(a.key,b.key));
}
export function materialLevelLabel(depth:number){return ["Área","Disciplina","Assunto","Tópico","Subtópico"][depth]||"Subtópico "+(depth-3);}
