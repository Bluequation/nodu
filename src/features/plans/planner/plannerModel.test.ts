import {describe,it,expect} from "vitest";
import {availableTopics,changePlacement,defaultSchedule,makeLibrary,reconcileAssignments,pieceTitle,topicPlacement,restartWeek,areaTone,topicTone,areaDisplayName} from "./plannerModel";
import type {StudyPlan} from "../../../domain/models";
import type {SelectedPlanLeaf} from "../../../domain/verticalization";
const leaf=(id:string,name:string,path:string[]):SelectedPlanLeaf=>({id,name,path:[...path,name],origin:"edital",sourceRef:"item 1"});
const leaves=[leaf("ldb","Lei federal nº 9.394/96, Lei de Diretrizes e Bases da Educação Nacional.",["P1 — Conhecimentos Básicos","Educação Brasileira: Temas Educacionais e Pedagógicos","História da educação brasileira"]),leaf("ped","Tendências pedagógicas",["P1 — Conhecimentos Básicos","Educação Brasileira: Temas Educacionais e Pedagógicos"]),leaf("muv","Movimento uniforme",["P2 — Conhecimentos Específicos","Física","Cinemática"])];
const plan={examDate:"",area:"Física"} as StudyPlan;
describe("planner contract",()=>{
 it("starts with every selected topic in the library",()=>{const c=defaultSchedule(plan);expect(c.days).toEqual([]);const a=reconcileAssignments(leaves,[],c.days);expect(a.every(x=>x.day===-1)).toBe(true);expect(availableTopics(leaves,a,c.days)).toEqual(leaves);});
 it("moves without duplication, preserves Sunday and returns to the library",()=>{const c=defaultSchedule(plan),a=reconcileAssignments(leaves,[],c.days);const sun=changePlacement(c,a,"ldb",0);expect(sun.config.days).toEqual([0]);expect(availableTopics(leaves,sun.assignments,sun.config.days).map(x=>x.id)).toEqual(["ped","muv"]);const mon=changePlacement(sun.config,sun.assignments,"ldb",1);const back=changePlacement(mon.config,mon.assignments,"ldb",-1);expect(back.assignments).toHaveLength(3);expect(availableTopics(leaves,back.assignments,back.config.days)).toEqual(leaves);});
 it("preserves saved dates and leaves new topics unassigned",()=>{const c={...defaultSchedule(plan),days:[1]};const old=reconcileAssignments(leaves,[],c.days)[0];const a=reconcileAssignments(leaves,[{...old,day:1,completedDates:["2026-11-14"]}],c.days);expect(a[0].day).toBe(1);expect(a[0].completedDates).toEqual(["2026-11-14"]);expect(a[1].day).toBe(-1);});
 it("keeps both columns with general-only data",()=>{const cols=makeLibrary(leaves.slice(0,2),"Geral");expect(cols.map(x=>x.key)).toEqual(["general","specific"]);expect(cols[0].groups.map(g=>g.label)).toEqual(["Legislação","Pedagogia"]);expect(cols[1].groups).toEqual([]);});
 it("keeps specific hierarchy and original IDs",()=>{const cols=makeLibrary(leaves,"Física");expect(cols[1].groups[0].label).toBe("Física");expect(cols[1].groups[0].groups[0].label).toBe("Cinemática");expect(cols[1].groups[0].groups[0].topics[0]).toBe(leaves[2]);expect(pieceTitle(leaves[0].name)).toBe("LDB");});
 it("keeps the curriculum under Pedagogy rather than assuming every BNCC descendant is legislation",()=>{
   const curriculum=leaf("cur","5.3 Organização curricular",["P1 — Conhecimentos Básicos","Educação Brasileira: Temas Educacionais e Pedagógicos","Base Nacional Comum Curricular (BNCC)"]);
   const law=leaf("law","1.1 Lei federal nº 9.394/96",["P1 — Conhecimentos Básicos","Educação Brasileira: Temas Educacionais e Pedagógicos"]);
   expect(topicPlacement(curriculum,"Geral").groups).toEqual(["Pedagogia"]);
   expect(topicPlacement(law,"Geral").groups).toEqual(["Legislação"]);
 });
 it("retains empty categories without duplicating assigned topics",()=>{
   const cols=makeLibrary(leaves,"Física",new Set(["muv"]));
   expect(cols[0].groups.map(g=>g.label)).toEqual(["Legislação","Pedagogia"]);
   expect(cols[0].groups.every(g=>g.topics.length===0)).toBe(true);
   expect(cols[1].groups[0].groups[0].topics.map(x=>x.id)).toEqual(["muv"]);
 });
 it("uses semantic abbreviations without discarding unknown topic details",()=>{
   expect(pieceTitle("8.1 Sistema Permanente de Avaliação da Educação Básica (Spaece).")).toBe("SPAECE");
   expect(pieceTitle("5.3 Currículo e Educação Integral.")).toBe("Currículo e educação integral");
   expect(pieceTitle("Diversidade cultural e inclusão na formação e na prática pedagógica dos professores")).toBe("Diversidade cultural e inclusão na formação e na prática pedagógica dos professores");
 });
 it("explicit restart empties all seven days and preserves completion records",()=>{
   const c={...defaultSchedule(plan),days:[0,1],daySchedules:{0:{startTime:"09:00",endTime:"11:00",simulation:true,completedDates:["2026-11-08"]},1:{startTime:"18:00",endTime:"20:00",simulation:false}}};
   const a=reconcileAssignments(leaves,[],c.days).map((x,i)=>({...x,day:i===0?1:0,completedDates:["2026-11-09"]}));
   const next=restartWeek(c,a);
   expect(next.config.days).toEqual([]); expect(next.config.daySchedules[0]).toEqual({startTime:"",endTime:"",simulation:false,completedDates:["2026-11-08"]});
   expect(next.assignments.every(x=>x.day===-1&&x.completedDates?.length===1)).toBe(true);
   expect(availableTopics(leaves,next.assignments,next.config.days)).toEqual(leaves);
 });
 it("uses the same stable area palette in the planner and library",()=>{
   expect(topicTone(leaves[0],"Física")).toBe("law");expect(topicTone(leaves[1],"Física")).toBe("pedagogy");expect(topicTone(leaves[2],"Física")).toBe("specific");
   expect(areaTone("general","Administração Pública")).toBe("administration");expect(areaTone("general","Língua Portuguesa")).toBe("language");expect(areaTone("general","Leitura e Interpretação de Dados e Indicadores Educacionais")).toBe("data");
   expect(areaDisplayName("Língua Portuguesa")).toBe("Português");
 });
 it("orders draggable titles alphabetically within every library group",()=>{
   const items=[leaf("z","Zoologia",["Conhecimentos Específicos","Física","Teste"]),leaf("a","Álgebra",["Conhecimentos Específicos","Física","Teste"]),leaf("m","Movimento uniforme",["Conhecimentos Específicos","Física","Teste"])];
   expect(makeLibrary(items,"Física")[1].groups[0].groups[0].topics.map(x=>x.id)).toEqual(["a","m","z"]);
 });
});
