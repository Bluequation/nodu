import {useEffect,useMemo,useRef,useState,type ReactNode,type PointerEvent as ReactPointerEvent} from "react";
import {ArrowLeft,CalendarDays,Check,ChevronRight,GripVertical,LoaderCircle,Target} from "lucide-react";
import type {DaySchedule,PlanAssignment,ScheduleConfig,StudyPlan} from "../../../domain/models";
import {getSelectedLeaves,type SelectedPlanLeaf} from "../../../domain/verticalization";
import {WEEKDAYS,defaultSchedule,reconcileAssignments,displayNodeName,emptyDaySchedule,minutesForDay,normalizePlannerText,pieceTitle,topicTone,areaTone,areaDisplayName,makeLibrary,changePlacement,availableTopics,restartWeek,type LibraryGroup} from "./plannerModel";
import "./planner.css";
export function ScheduleStep({ plan, onSave, registerBeforeLeave }: { plan: StudyPlan; onSave: (next: StudyPlan) => Promise<void>; registerBeforeLeave?: (handler:(()=>Promise<boolean>)|null)=>void }) {
  const leaves = useMemo(() => getSelectedLeaves(plan.tree), [plan.tree]);
  const [config, setConfig] = useState<ScheduleConfig>(() => plan.scheduleConfig || defaultSchedule(plan));
  const [assignments, setAssignments] = useState<PlanAssignment[]>(() => reconcileAssignments(leaves, plan.assignments, (plan.scheduleConfig || defaultSchedule(plan)).days));
  const latest = useRef({config, assignments});
  const planRef = useRef(plan);
  planRef.current = plan;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [point, setPoint] = useState({x:0,y:0});
  const [saveState, setSaveState] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [finishing, setFinishing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const drag = useRef<{id:string; pointer:number; x:number; y:number; moving:boolean} | null>(null);
  const suppressClick = useRef(false);
  const workspace = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextConfig = plan.scheduleConfig || defaultSchedule(plan);
    const nextAssignments = reconcileAssignments(getSelectedLeaves(plan.tree), plan.assignments, nextConfig.days);
    latest.current = {config:nextConfig,assignments:nextAssignments};
    setConfig(nextConfig); setAssignments(nextAssignments); setSearch(""); setSelected(null);
    setSaveState("idle"); setFeedback(""); setExpanded({});
  }, [plan.id]);

  useEffect(()=>{registerBeforeLeave?.(async()=>{await queue.current;return !finishing;});return ()=>registerBeforeLeave?.(null);},[registerBeforeLeave,finishing]);

  function commit(nextConfig:ScheduleConfig, nextAssignments:PlanAssignment[], finish=false) {
    latest.current = {config:nextConfig,assignments:nextAssignments};
    setConfig(nextConfig); setAssignments(nextAssignments); setSaveState("saving");
    const id=plan.id;
    const task=queue.current.catch(()=>{}).then(async()=>{
      if(planRef.current.id!==id)return;
      await onSave({...planRef.current,scheduleConfig:nextConfig,assignments:nextAssignments,
        ...(finish ? {status:"active" as const,stage:"schedule" as const} : {}),updatedAt:Date.now()});
      if(latest.current.config===nextConfig&&latest.current.assignments===nextAssignments)setSaveState("saved");
    });
    queue.current=task;
    void task.catch(()=>setSaveState("error"));
    return task;
  }

  function move(id:string, day:number) {
    if(finishing || (day!==-1&&!WEEKDAYS.some(item=>item.id===day)))return;
    const current=latest.current;
    const next=changePlacement(current.config,current.assignments,id,day);
    if(next.assignments===current.assignments){setSelected(null);return;}
    void commit(next.config,next.assignments);
    setLanded(id); setSelected(null);
    setFeedback(day===-1?"Assunto devolvido à biblioteca.": "Assunto movido para "+WEEKDAYS.find(entry=>entry.id===day)?.label+".");
  }

  function setDay(day:number,patch:Partial<DaySchedule>) {
    if(finishing)return;
    const current=latest.current;
    const next={...current.config,
      days:WEEKDAYS.filter(entry=>entry.id===day||current.config.days.includes(entry.id)).map(entry=>entry.id),
      daySchedules:{...(current.config.daySchedules||{}),[day]:{...(current.config.daySchedules?.[day]||emptyDaySchedule()),...patch}}
    };
    void commit(next,current.assignments);
  }
  function toggleDay(day:number,enabled:boolean) {
    if(finishing)return;
    const current=latest.current;
    if(enabled){setDay(day,{});return;}
    void commit({...current.config,days:current.config.days.filter(id=>id!==day)},current.assignments.map(item=>item.day===day?{...item,day:-1}:item));
    setSelected(null);
  }
  function changeDates(patch:Partial<ScheduleConfig>) {
    if(finishing)return;
    void commit({...latest.current.config,...patch},latest.current.assignments);
  }

  function targetAt(x:number,y:number) {
    const element=document.elementFromPoint(x,y)?.closest<HTMLElement>("[data-rp-destination]");
    if(!element||!workspace.current?.contains(element))return null;
    const day=Number(element.dataset.rpDestination);
    return day===-1||WEEKDAYS.some(entry=>entry.id===day)?day:null;
  }
  function pointerDown(event:ReactPointerEvent<HTMLElement>,id:string) {
    if(!event.isPrimary||event.button!==0||drag.current||finishing)return;
    suppressClick.current=false;
    drag.current={id,pointer:event.pointerId,x:event.clientX,y:event.clientY,moving:false};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event:ReactPointerEvent<HTMLElement>) {
    const current=drag.current;
    if(!current||current.pointer!==event.pointerId)return;
    if(!current.moving&&Math.hypot(event.clientX-current.x,event.clientY-current.y)<6)return;
    current.moving=true;
    setDragged(current.id);setPoint({x:event.clientX,y:event.clientY});setOver(targetAt(event.clientX,event.clientY));
    for(const selector of [".rp-week-scroll",".rp-library-scroll"]){
      const pane=workspace.current?.querySelector<HTMLElement>(selector);
      if(!pane)continue;
      const bounds=pane.getBoundingClientRect();
      if(event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom){
        if(event.clientY<bounds.top+30)pane.scrollTop-=16;
        else if(event.clientY>bounds.bottom-30)pane.scrollTop+=16;
      }
    }
  }
  function pointerEnd(event:ReactPointerEvent<HTMLElement>,cancelled=false) {
    const current=drag.current;
    if(!current||current.pointer!==event.pointerId)return;
    drag.current=null;
    suppressClick.current=current.moving;
    if(current.moving&&!cancelled){
      const target=targetAt(event.clientX,event.clientY);
      if(target!==null)move(current.id,target);
    }
    setDragged(null);setOver(null);
  }
  function selectPiece(id:string) {
    if(suppressClick.current){suppressClick.current=false;return;}
    setSelected(current=>current===id?null:id);
  }
  function piece(leaf:SelectedPlanLeaf,day:number) {
    const tone=topicTone(leaf,plan.area);
    return <div key={leaf.id} data-tone={tone} className={`rp-tile ${tone==="specific"?"specific":""} ${selected===leaf.id?"picked":""} ${dragged===leaf.id?"moving":""} ${landed===leaf.id?"placed":""}`} onAnimationEnd={()=>setLanded(current=>current===leaf.id?null:current)}>
      <button type="button" className="rp-tile-grip" title={displayNodeName(leaf.name)} aria-label={displayNodeName(leaf.name)} aria-pressed={selected===leaf.id}
        onPointerDown={event=>pointerDown(event,leaf.id)} onPointerMove={pointerMove} onPointerUp={event=>pointerEnd(event)} onPointerCancel={event=>pointerEnd(event,true)} onLostPointerCapture={event=>pointerEnd(event,true)}
        onClick={()=>selectPiece(leaf.id)}><GripVertical size={13}/><span>{pieceTitle(leaf.name)}</span></button>
      {day>=0&&<button className="rp-tile-remove" type="button" aria-label={`Devolver ${displayNodeName(leaf.name)} à biblioteca`} title="Devolver à biblioteca" onClick={()=>move(leaf.id,-1)}>×</button>}
    </div>;
  }
  const leafById=new Map(leaves.map(leaf=>[leaf.id,leaf]));
  const available=availableTopics(leaves,assignments,config.days);
  const matching=available.filter(leaf=>!search.trim()||normalizePlannerText(leaf.path.join(" ")+" "+pieceTitle(leaf.name)).includes(normalizePlannerText(search)));
  const columns=makeLibrary(search.trim()?matching:leaves,plan.area,new Set(matching.map(leaf=>leaf.id)));
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const groupCount=(group:LibraryGroup):number=>group.topics.length+group.groups.reduce((sum,child)=>sum+groupCount(child),0);
  function renderGroup(group:LibraryGroup,initialOpen:boolean,root=false):ReactNode{
    const open=Boolean(search.trim())||(expanded[group.key]??initialOpen);
    const count=groupCount(group);
    return <div key={group.key} className={root?"rp-area-card":"rp-branch"} data-tone={root?areaTone(group.key.startsWith("specific/")?"specific":"general",group.label):undefined}>
      <button type="button" className={root?"rp-area-title":"rp-branch-title"} aria-expanded={open} title={group.label} onClick={()=>setExpanded(previous=>({...previous,[group.key]:!open}))}>
        {root&&<i className="rp-area-dot" aria-hidden="true"/>}<span>{areaDisplayName(group.label)}</span>{root&&<small>{count}</small>}<ChevronRight size={14}/>
      </button>
      {open&&<div className={root?"rp-area-body":"rp-branch-body"}>{group.topics.length>0&&<div className="rp-piece-cloud">{group.topics.map(leaf=>piece(leaf,-1))}</div>}{group.groups.map((child,i)=>renderGroup(child,i===0))}{!count&&<small className="rp-empty-group">Todos no planner</small>}</div>}
    </div>;
  }
  const organized=leaves.length-available.length;
  const weeklyMinutes=config.days.reduce((sum,day)=>sum+minutesForDay(config,day),0);
  const duration=(minutes:number)=>minutes?(`${Math.floor(minutes/60)?Math.floor(minutes/60)+"h ":""}${minutes%60?minutes%60+"min":""}`).trim():"";
  const dragging=dragged?leafById.get(dragged):undefined;
  const hasSession=config.days.some(day=>config.daySchedules?.[day]?.simulation)||organized>0;
  async function finish() {
    if(finishing||!hasSession)return;
    setFinishing(true);
    try {
      const current=latest.current;
      await commit(current.config,current.assignments,true);
      setFeedback("Cronograma salvo.");
    }catch{setFeedback("Não foi possível salvar. Tente novamente.");}
    finally{setFinishing(false);}
  }
  async function goBack() {
    try{await queue.current;await onSave({...planRef.current, assignments:latest.current.assignments, scheduleConfig:latest.current.config,stage:"selection"});}
    catch{setSaveState("error");}
  }
  function clearDistribution() {
    if(finishing)return;
    if(!window.confirm("Recomeçar a semana? Todos os assuntos voltam à biblioteca e os horários e simulados são zerados. O edital e os registros de conclusão serão mantidos."))return;
    const current=latest.current;
    const next=restartWeek(current.config,current.assignments);
    void commit(next.config,next.assignments);
    setSelected(null);setLanded(null);setSearch("");setExpanded({});setFeedback("Semana vazia. Todos os assuntos estão na biblioteca.");
  }

  return <div ref={workspace} className="ritmo-planner">
    <section className="rp-planner" aria-label="Planner semanal">
      <header className="rp-section-head"><div><h2>Minha semana</h2></div><small className="rp-week-total">{weeklyMinutes?duration(weeklyMinutes)+" de estudo":""}</small><div className="rp-head-actions">
        {(organized>0||config.days.length>0)&&<button type="button" className="rp-text-action" onClick={clearDistribution}>Recomeçar semana</button>}
        <details className="rp-dates"><summary><CalendarDays size={14}/> Datas</summary><div className="rp-date-fields"><label>Início<input type="date" aria-label="Início do plano" value={config.startDate} onChange={event=>changeDates({startDate:event.target.value})}/></label><label>Prova (opcional)<input type="date" aria-label="Data da prova" value={config.examDate} onChange={event=>changeDates({examDate:event.target.value})}/></label></div></details>
      </div></header>
      <div className="rp-week-scroll"><div className="rp-week">
        {WEEKDAYS.map(day=>{
          const enabled=config.days.includes(day.id);
          const slot=config.daySchedules?.[day.id]||emptyDaySchedule();
          const items=assignments.filter(item=>item.day===day.id&&enabled).map(item=>leafById.get(item.nodeId)).filter((leaf):leaf is SelectedPlanLeaf=>Boolean(leaf));
          return <article key={day.id} data-rp-destination={day.id} className={`rp-day ${enabled?"enabled":""} ${enabled&&slot.simulation?"mock":""} ${over===day.id?"landing":""} ${selected?"select-destination":""}`}>
            <button type="button" className="rp-day-title" aria-label={`Mover assunto para ${day.label}`} onClick={()=>{if(selected)move(selected,day.id);}}><b>{day.label}</b>{items.length>0&&<small className="rp-day-count" aria-label={`${items.length} assuntos`} title={`${items.length} assuntos`}>{items.length}</small>}</button>
            <details className="rp-day-settings"><summary title={`Configurar ${day.label}`}><span>{enabled&&slot.startTime&&slot.endTime?`${slot.startTime}–${slot.endTime}`:"Definir horário"}</span></summary>
              <div className="rp-day-fields"><label className="rp-toggle"><input type="checkbox" checked={enabled} onChange={event=>toggleDay(day.id,event.target.checked)}/> Estudar</label>{enabled&&<><label>Das<input type="time" aria-label={`Início de ${day.label}`} value={slot.startTime} onChange={event=>setDay(day.id,{startTime:event.target.value})}/></label><label>Às<input type="time" aria-label={`Fim de ${day.label}`} value={slot.endTime} onChange={event=>setDay(day.id,{endTime:event.target.value})}/></label><label className="rp-toggle"><input type="checkbox" checked={slot.simulation} onChange={event=>setDay(day.id,{simulation:event.target.checked})}/> Simulado</label></>}</div>
            </details>
            <div className="rp-day-body" tabIndex={items.length>3?0:undefined} aria-label={`Assuntos de ${day.label}: ${items.length}`} onClick={event=>{if(selected&&event.target===event.currentTarget)move(selected,day.id);}}>
              {enabled&&slot.simulation&&<div className="rp-mock"><Target size={13}/> Simulado</div>}
              {items.map(leaf=>piece(leaf,day.id))}
            </div>
          </article>;
        })}
      </div></div>
    </section>
    <section className={`rp-library ${over===-1?"landing":""}`} data-rp-destination={-1} aria-label="Biblioteca do plano">
      <header className="rp-section-head"><div><h2>Biblioteca</h2></div><input type="search" aria-label="Buscar assunto na biblioteca" placeholder="Buscar assunto…" value={search} onChange={event=>setSearch(event.target.value)}/></header>
      <div className="rp-library-scroll"><div className="rp-library-tree">
        {columns.map(column=><section key={column.key} className={"rp-column "+column.key}><div className="rp-section-band"><h3>{column.label}</h3><small>{column.groups.reduce((sum,group)=>sum+groupCount(group),0)} assuntos</small></div>{column.groups.length?<div className="rp-area-grid">{column.groups.map((group,i)=>renderGroup(group,i===0,true))}</div>:<p className="rp-library-empty">{search.trim()?"Nenhum assunto encontrado.":"Nenhum conteúdo selecionado nesta área."}</p>}</section>)}
      </div></div>
    </section>
    <footer className="rp-footer"><button type="button" className="secondary-button" disabled={finishing} onClick={goBack}><ArrowLeft size={15}/> Voltar</button><span role="status">{saveState==="error"?"Falha ao salvar. Tente salvar novamente.":saveState==="saving"?"Salvando…":selected?"Toque em um dia para mover.":saveState==="saved"?"Salvo neste navegador":feedback}</span><button type="button" className="primary-button" disabled={!hasSession||finishing} onClick={finish}>{finishing?<LoaderCircle className="save-spinner" size={15}/>:<Check size={15}/>} {finishing?"Salvando…":"Salvar cronograma"}</button></footer>
    {dragging&&<div className="rp-ghost" data-tone={topicTone(dragging,plan.area)} style={{left:point.x+10,top:point.y+10}}><GripVertical size={15}/><span>{pieceTitle(dragging.name)}</span></div>}
  </div>;
}

