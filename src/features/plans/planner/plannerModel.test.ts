import {describe,it,expect} from "vitest";
import {availableTopics,changePlacement,defaultSchedule,makeLibrary,reconcileAssignments,pieceTitle} from "./plannerModel";
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
});
