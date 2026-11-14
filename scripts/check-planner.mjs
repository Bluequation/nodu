import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
const url="http://127.0.0.1:4173";
const server=spawn("npm",["run","preview","--","--host","127.0.0.1","--port","4173","--strictPort"],{stdio:"inherit"});
let browser;
const node=(id,name,children=[])=>({id,name,children,origin:"edital",sourceRef:"item de demonstração",sourceText:name,selected:true});
const ldb=node("ldb","Lei federal nº 9.394/96, Lei de Diretrizes e Bases da Educação Nacional.");
const general=node("general","P1 — Conhecimentos Básicos",[
 node("edu","Educação Brasileira: Temas Educacionais e Pedagógicos",[
  ldb,node("pne","Planos Nacionais de Educação: 2001–2010; 2014–2025 e 2026–2036."),node("lei","Lei federal nº 10.639/2003"),node("ped","Tendências pedagógicas contemporâneas")
 ]),node("port","Português",[node("txt","Compreensão e interpretação de textos")])
]);
const specific=node("specific","P2 — Conhecimentos Específicos",[node("physics","Física",[node("cin","Cinemática",[node("mu","Movimento uniforme"),node("mruv","Movimento uniformemente variado"),node("fall","Queda livre")]),node("din","Dinâmica",[node("newton","Leis de Newton")])])]);
function fixture(id,tree,assignments=[],config=null){return {id,title:"Plano de teste",institution:"SEDUC",position:"Professor",area:tree.length===1?"Geral":"Física",organizer:"UECE",examDate:"",sourceFile:"",sourceText:"",tree,warnings:[],selectionIndex:0,stage:"schedule",scheduleConfig:config,assignments,createdAt:1,updatedAt:1,status:"draft"}}
async function seed(page,plan){
 await page.goto(url+"/#/plans");
 await page.getByRole("heading",{name:"Meus planos",exact:true}).waitFor();
 await page.evaluate(async plan=>{await new Promise((resolve,reject)=>{const request=indexedDB.open("ritmo-8",2);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction("plans","readwrite");tx.objectStore("plans").put(plan);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error);}})},plan);
 await page.goto(url+"/#/plans/"+plan.id+"/verticalize");
 await page.locator(".ritmo-planner").waitFor();
}
const day=(page,n)=>page.locator('.rp-day[data-rp-destination="'+n+'"]');
const library=page=>page.locator(".rp-library");
const topic=(locator,name)=>locator.locator(".rp-tile-grip").filter({hasText:name});
async function drag(page,source,target,touch=false){
 await page.locator(".ritmo-planner").evaluate(el=>el.scrollIntoView({block:"start"}));
 await target.scrollIntoViewIfNeeded();
 await source.scrollIntoViewIfNeeded();
 const from=await source.boundingBox(),to=await target.boundingBox();
 assert.ok(from&&to,"drag targets must be visible");
 const x=from.x+from.width/2,y=from.y+from.height/2,dx=to.x+to.width/2,dy=to.y+to.height/2;
 if(!touch){
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(dx,dy,{steps:20});await page.mouse.up();
 }else{
  const session=await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
  for(let i=1;i<=15;i++)await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+(dx-x)*i/15,y:y+(dy-y)*i/15}]});
  await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await session.detach();
 }
}
async function saved(page){await page.locator(".rp-footer [role=status]").filter({hasText:"Salvo neste navegador"}).waitFor({timeout:10000});}
try{
 for(let n=0;n<80;n++){try{if((await fetch(url)).ok)break}catch{};await new Promise(r=>setTimeout(r,250));}
 await mkdir("planner-screenshots",{recursive:true});
 browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 const activePlan=fixture("gallery-active",[general,specific],[],{startDate:"2026-01-01",examDate:"",days:[new Date().getDay()],minutes:0,mode:"alternate",daySchedules:{[new Date().getDay()]:{startTime:"18:00",endTime:"20:00",simulation:true}}});
 activePlan.status="active";
 await seed(page,activePlan);
 await page.goto(url+"/#/plans");
 await page.locator(".gallery-plan").filter({hasText:"Plano de teste"}).waitFor();
 assert.equal(await page.locator(".gallery-today").count(),0,"no duplicate pending-session banner");
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),"rgb(244, 246, 249)");
 await page.screenshot({path:"planner-screenshots/00-meus-planos.png",fullPage:true});
 await page.goto(url+"/#/agenda");await page.locator(".ra-grid").waitFor();
 const agendaFilter=page.getByRole("combobox",{name:"Filtrar agenda por plano"});await agendaFilter.locator('option[value="gallery-active"]').waitFor({state:"attached"});await agendaFilter.selectOption("gallery-active");
 await page.locator(".ra-day.today .ra-chip").first().waitFor();
 assert.ok(await page.locator(".ra-day").count()>=28);assert.equal(await page.locator(".ra-day.today.selected").count(),1);
 await page.screenshot({path:"planner-screenshots/09-agenda-desktop.png",fullPage:true});
 await page.getByRole("button",{name:"Mês seguinte"}).click();await page.getByRole("button",{name:"Hoje",exact:true}).click();await page.locator(".ra-day.today.selected").waitFor();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:"planner-screenshots/10-agenda-mobile.png",fullPage:true});await page.setViewportSize({width:1440,height:1050});

 await seed(page,fixture("empty",[general,specific]));
 assert.equal(await page.locator(".rp-planner").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(238, 242, 246)");
 assert.equal(await page.locator(".rp-day").count(),7);
 assert.equal(await page.locator(".rp-day .rp-tile").count(),0);
 assert.equal(await page.locator(".rp-column").count(),2);
 const geometry=await page.locator(".rp-day").evaluateAll(cards=>cards.map(c=>({top:c.getBoundingClientRect().top,left:c.getBoundingClientRect().left})));
 assert.ok(geometry.every((c,i)=>Math.abs(c.left-geometry[0].left)<1&&(!i||c.top>geometry[i-1].top)),"seven vertically aligned cards");
 const left=await page.locator(".rp-planner").boundingBox(),right=await library(page).boundingBox();
 assert.ok(left&&right&&left.x+left.width<=right.x&&Math.abs(left.width/(left.width+right.width)-.4)<.035,"40/60 desktop columns");
 assert.equal(await library(page).locator('.rp-area-card[data-tone="law"]').count(),1);
 assert.equal(await library(page).locator('.rp-area-card[data-tone="pedagogy"]').count(),1);
 await page.screenshot({path:"planner-screenshots/01-empty-desktop.png",fullPage:true});
 await drag(page,topic(library(page),"LDB"),day(page,1));
 await topic(day(page,1),"LDB").waitFor();
 assert.equal(await topic(library(page),"LDB").count(),0);
 assert.equal(await day(page,1).locator(".rp-tile").getAttribute("data-tone"),"law");
 await saved(page);
 await page.reload();await topic(day(page,1),"LDB").waitFor();
 await page.getByRole("button",{name:"Edital",exact:true}).click();await page.locator("#source-text").waitFor();
 assert.equal(await page.locator(".wizard-step.is-current").evaluate(el=>getComputedStyle(el).opacity),"1");
 await page.waitForFunction(()=>{const active=document.querySelector(".wizard-step.is-current");return active&&getComputedStyle(active).backgroundColor==="rgb(48, 94, 137)";});
 assert.equal(await page.locator(".wizard-step.is-current").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(48, 94, 137)");
 assert.equal(await page.locator(".rp-flow-card").count(),2);
 await page.screenshot({path:"planner-screenshots/06-edital.png",fullPage:true});
 await page.getByRole("button",{name:"Seleção",exact:true}).click();await page.locator(".selection-progress").waitFor();
 await page.locator(".rp-selection-tree").waitFor();
 await page.screenshot({path:"planner-screenshots/07-selecao.png",fullPage:true});
 await page.getByRole("button",{name:"Revisão da seleção"}).click();await page.locator(".rp-review-grid").waitFor();
 await page.screenshot({path:"planner-screenshots/08-revisao.png",fullPage:true});
 await page.getByRole("button",{name:"Cronograma",exact:true}).click();await topic(day(page,1),"LDB").waitFor();
 await drag(page,topic(day(page,1),"LDB"),day(page,4));
 await topic(day(page,4),"LDB").waitFor();await saved(page);
 await page.screenshot({path:"planner-screenshots/02-filled-desktop.png",fullPage:true});
 await day(page,4).locator(".rp-tile-remove").click();await topic(library(page),"LDB").waitFor();await saved(page);
 assert.equal(await page.locator(".rp-day .rp-tile").count(),0);
 const more=Array.from({length:11},(_,i)=>node("extra-"+i,"Assunto longo "+(i+1)+" — descrição do edital para validação de espaço"));
 const busyTree=[node("block","Conhecimentos Básicos",[node("adm","Administração Pública",more)]),specific];
 const busyAssignments=more.map(n=>({nodeId:n.id,name:n.name,path:["Conhecimentos Básicos","Administração Pública",n.name],origin:"edital",sourceRef:n.sourceRef,day:1}));
 await seed(page,fixture("populated",busyTree,busyAssignments,{startDate:"2026-11-14",examDate:"",days:[1],minutes:0,mode:"alternate",daySchedules:{1:{startTime:"18:00",endTime:"20:00",simulation:false}}}));
 assert.equal(await day(page,1).locator(".rp-tile").count(),11);
 assert.equal(await day(page,1).locator(".rp-day-count").textContent(),"11");
 assert.ok((await day(page,1).boundingBox()).height<=215,"populated day remains compact");
 await page.screenshot({path:"planner-screenshots/03-populated.png",fullPage:true});
 page.once("dialog",dialog=>dialog.accept());
 await page.getByRole("button",{name:"Recomeçar semana"}).click();
 await saved(page);assert.equal(await page.locator(".rp-day .rp-tile,.rp-day .rp-mock").count(),0);
 await page.reload();await page.locator(".ritmo-planner").waitFor();assert.equal(await page.locator(".rp-day .rp-tile,.rp-day .rp-mock").count(),0);
 await page.screenshot({path:"planner-screenshots/03b-restarted.png",fullPage:true});
 await seed(page,fixture("general-only",[general]));
 assert.equal(await page.locator(".rp-column").count(),2);
 assert.equal(await page.locator(".rp-column.specific .rp-tile").count(),0);
 await page.screenshot({path:"planner-screenshots/04-general-only.png",fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await seed(mobile,fixture("mobile",[general,specific]));
 await mobile.screenshot({path:"planner-screenshots/05-mobile.png",fullPage:true});
 await drag(mobile,topic(library(mobile),"LDB"),day(mobile,1),true);
 await topic(day(mobile,1),"LDB").waitFor();await saved(mobile);
 await mobile.reload();await topic(day(mobile,1),"LDB").waitFor();
 await page.goto(url+"/#/learn");
 await page.locator(".rl-mode").first().waitFor();
 assert.equal(await page.locator(".rl-mode").count(),4);
 assert.equal(await page.locator(".rl-mode:disabled").count(),4);
 const learningCards=await page.locator(".rl-mode").evaluateAll(items=>items.map(el=>({top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height})));
 assert.ok(learningCards.every(x=>Math.abs(x.top-learningCards[0].top)<1&&x.height<160),"compact one-row strategy cards");
 await page.screenshot({path:"planner-screenshots/11-aprender-empty.png",fullPage:true});
 const studyFixture={id:"learning-test",subject:"fisica",topic:"Leis de Newton",source:"Material de teste",status:"published",variants:[{id:"variant-test",kind:"basic",format:"basic",q:"O que diz a primeira lei?",a:"Princípio da inércia",reason:"",source:"",image:"",mask:null,status:"approved",uses:0,passes:0,failures:0}],createdAt:1,fsrs:{s:1,d:5,last:0,due:0,reps:0,lapses:0,interval:0},lastVariant:"",suspended:false};
 await page.evaluate(async concept=>{await new Promise((resolve,reject)=>{const req=indexedDB.open("ritmo-8",2);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction("concepts","readwrite");tx.objectStore("concepts").put(concept);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error);};});},studyFixture);
 await page.reload();await page.locator('.rl-mode[data-mode="recall"]:not(:disabled)').waitFor();
 await page.getByRole("combobox",{name:"Filtrar área"}).selectOption("tae");assert.equal(await page.locator(".rl-mode:disabled").count(),4);
 await page.getByRole("combobox",{name:"Filtrar área"}).selectOption("fisica");
 await page.locator('.rl-mode[data-mode="explain"]').click();await page.locator("#learning-response").fill("A inércia mantém o estado de movimento.");
 await page.getByRole("button",{name:"Comparar com a referência"}).click();await page.locator(".rl-reference").waitFor();
 await page.screenshot({path:"planner-screenshots/12-aprender-comparacao.png",fullPage:true});
 await page.getByRole("button",{name:"Consegui explicar"}).click();await page.getByRole("button",{name:"Voltar às técnicas"}).click();
 await page.locator(".rl-history-item").first().waitFor();await page.reload();await page.locator(".rl-history-item").first().waitFor();
 assert.equal(await page.locator(".rl-history-item").count(),1);
 const stored=await page.evaluate(async()=>await new Promise((resolve,reject)=>{const req=indexedDB.open("ritmo-8",2);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,read=db.transaction("concepts").objectStore("concepts").get("learning-test");read.onsuccess=()=>{db.close();resolve(read.result)};read.onerror=()=>reject(read.error);};}));
 assert.deepEqual(stored,studyFixture,"learning does not change flashcards or FSRS");
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:"planner-screenshots/13-aprender-mobile.png",fullPage:true});
 console.log("Planner: layout, mouse, touch, return and persistence verified.");
}catch(error){
 if(browser)for(const [i,ctx] of browser.contexts().entries())for(const [j,page] of ctx.pages().entries())await page.screenshot({path:"planner-screenshots/failure-"+i+"-"+j+".png",fullPage:true}).catch(()=>{});
 throw error;
}finally{await browser?.close();server.kill();}
