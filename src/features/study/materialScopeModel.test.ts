import {describe,it,expect} from "vitest";
import {buildMaterialPaths,choicesAt} from "./materialScopeModel";
import type {SelectedPlanLeaf} from "../../domain/verticalization";
const leaf=(id:string,path:string[],origin:SelectedPlanLeaf["origin"]="edital"):SelectedPlanLeaf=>({id,name:path[path.length-1],path,origin,sourceRef:""});
describe("material destination tree",()=>{
 const paths=buildMaterialPaths([
 leaf("ldb",["P1 — Conhecimentos Básicos","Educação Brasileira: Temas Educacionais e Pedagógicos","1 História da educação brasileira","1.1 Lei federal nº 9.394/96"]),
 leaf("pne",["P1 — Conhecimentos Básicos","Educação Brasileira: Temas Educacionais e Pedagógicos","1 História da educação brasileira","PNE"]),
 leaf("newton",["P2 — Conhecimentos Específicos","Física","Dinâmica","Leis de Newton"]),
 leaf("mu",["P2 — Conhecimentos Específicos","Física","Cinemática","Movimento uniforme"]),
 leaf("mruv",["P2 — Conhecimentos Específicos","Física","Cinemática","Movimento uniformemente variado"])
 ],"Física");
 it("partitions areas, preserves hierarchy and alphabetical choices",()=>{
 expect(choicesAt(paths,[]).map(c=>c.key)).toEqual(["area:general","area:specific"]);
 const p=["area:specific","discipline:fisica"];
 expect(choicesAt(paths,p).map(c=>c.label)).toEqual(["Cinemática","Dinâmica"]);
 const c=choicesAt(paths,[...p,"group:Cinemática"]);
 expect(c.map(x=>x.nodeId)).toEqual(["mu","mruv"]);
 expect(choicesAt(paths,["area:general","discipline:legislacao"]).map(c=>c.label)).toEqual(["História da educação brasileira"]);
 expect(paths.find(p=>p.leaf.id==="ldb")?.steps.at(-1)?.nodeId).toBe("ldb");
 });
 it("keeps suggested items marked and does not conflate parent and child",()=>{
 const items=buildMaterialPaths([leaf("base",["Conhecimentos gerais","Administração Pública","Conceitos"]),leaf("extra",["Conhecimentos gerais","Administração Pública","Conceitos","[SUGERIDO] Princípios"],"suggested")]);
 const c=choicesAt(items,["area:general","discipline:administracao publica"]);
 expect(c).toHaveLength(2);expect(c.some(x=>x.nodeId==="base")).toBe(true);
 expect(choicesAt(items,["area:general","discipline:administracao publica","group:Conceitos"])[0].label).toBe("Princípios · sugestão");
 });
});
