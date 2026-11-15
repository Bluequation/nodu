import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowRight, BookOpen, Brain, CalendarDays, CheckCircle2, ClipboardList,
  FileText, FolderKanban, LayoutDashboard, Layers3, NotebookPen, Settings, Target,
  Upload, WandSparkles,
} from "lucide-react";
import { HashRouter, Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { createPlan, listPlans } from "../data/plans";
import { listConcepts, listErrors, listQuestionBlocks } from "../data/study";
import type { NewStudyPlan, StudyPlan } from "../domain/models";
import { getSelectedLeaves } from "../domain/verticalization";
import { PlanDetailRoute, PlanWizardRoute } from "../features/plans/PlanWizard";
import { FlashcardEditorPage, FlashcardsPage, ReviewPageRoute } from "../features/study/Flashcards";
import { ErrorsPage, QuestionsPage } from "../features/practice/Practice";
import { SettingsPage } from "../features/settings/Settings";
import { LearningPage } from "../features/study/Learning";
import { AgendaPage } from "../features/agenda/AgendaPage";
import { CurationPage, ImportPage } from "../features/study/ImportCuration";

const groups = [
  ["VISÃO GERAL", [["Painel", "/", LayoutDashboard]]],
  ["PLANEJAMENTO", [["Meus planos", "/plans", FolderKanban], ["Agenda", "/agenda", CalendarDays]]],
  ["APRENDIZAGEM", [["Aprender", "/learn", Brain], ["Flashcards", "/flashcards", Layers3], ["Revisões", "/reviews", Activity]]],
  ["PRÁTICA", [["Questões", "/errors", Target]]],
  ["CONTEÚDOS", [["Importar", "/import", Upload], ["Curadoria", "/curation", WandSparkles]]],
  ["PREFERÊNCIAS", [["Ajustes", "/settings", Settings]]],
] as const;

function Heading({ eyebrow, title, desc, action }: { eyebrow: string; title: string; desc: string; action?: ReactNode }) {
  return <header className="heading"><div><small>{eyebrow}</small><h1>{title}</h1>{desc && <p>{desc}</p>}</div>{action}</header>;
}
function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}
function Shell() {
  return <div className="shell">
    <aside className="sidebar">
      <Link to="/" className="brand"><i>R</i><span><b>Ritmo</b><small>SEU ESPAÇO DE ESTUDOS</small></span></Link>
      <nav>{groups.map(([label, items]) => <section key={label}><small>{label}</small>{items.map(([name, path, Icon]) => <NavLink key={path} to={path} end={path === "/"}><Icon size={17}/>{name}</NavLink>)}</section>)}</nav>
      <footer><b>Estude no seu ritmo.</b><small>Seus dados ficam salvos neste navegador.</small></footer>
    </aside>
    <main className="main">
      <header className="mobile-head"><Link to="/">◈ Ritmo</Link><small>8.0 · nova estrutura</small></header>
      <Routes>
        <Route index element={<Dashboard/>}/>
        <Route path="/plans" element={<Plans/>}/>
        <Route path="/plans/new" element={<NewPlan/>}/>
        <Route path="/plans/:id/verticalize" element={<PlanWizardRoute/>}/>
        <Route path="/plans/:id" element={<PlanDetailRoute/>}/>
        <Route path="/agenda" element={<AgendaPage/>}/>
        <Route path="/flashcards" element={<FlashcardsPage/>}/>
        <Route path="/flashcards/new" element={<FlashcardEditorPage/>}/>
        <Route path="/flashcards/:id/edit" element={<FlashcardEditorPage/>}/>
        <Route path="/reviews" element={<ReviewPageRoute/>}/>
        <Route path="/questions" element={<QuestionsPage/>}/>
        <Route path="/errors" element={<ErrorsPage/>}/>
        <Route path="/settings" element={<SettingsPage/>}/>
        <Route path="/learn" element={<LearningPage/>}/>
        <Route path="/import" element={<ImportPage/>}/>
        <Route path="/curation" element={<CurationPage/>}/>
      </Routes>
      <footer className="app-footer">Ritmo 8.0 · Seu espaço de estudos</footer>
    </main>
    <nav className="mobile-nav">{[["Painel","/",LayoutDashboard],["Planos","/plans",FolderKanban],["Agenda","/agenda",CalendarDays],["Aprender","/learn",Brain],["Ajustes","/settings",Settings]].map(([label,path,Icon]) => <NavLink key={path as string} to={path as string} end={path === "/"}><Icon size={18}/><small>{label as string}</small></NavLink>)}</nav>
  </div>;
}

function Dashboard() {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [metrics, setMetrics] = useState({ dueCards: 0, dueErrors: 0, questions: 0, correct: 0 });
  useEffect(() => {
    Promise.all([listPlans(), listConcepts(), listErrors(), listQuestionBlocks()])
      .then(([nextPlans, concepts, errors, blocks]) => {
        setPlans(nextPlans);
        setMetrics({
          dueCards: concepts.filter(concept => concept.status === "published" && !concept.suspended && concept.fsrs.due <= Date.now()).length,
          dueErrors: errors.filter(error => error.status !== "dominado" && error.nextReview <= Date.now()).length,
          questions: blocks.reduce((sum, block) => sum + block.total, 0),
          correct: blocks.reduce((sum, block) => sum + block.correct, 0),
        });
      });
  }, []);
  const active = plans.filter(plan => plan.status === "active").length;
  const drafts = plans.filter(plan => plan.status === "draft").length;
  const topics = plans.reduce((sum, plan) => sum + getSelectedLeaves(plan.tree).length, 0);
  const recent = plans.slice(0, 3);
  return <div className="stack">
    <Heading eyebrow="VISÃO GERAL" title="Painel" desc=""/>
    <div className="stats expanded-stats">
      <Panel><small>PLANOS ATIVOS</small><b>{active}</b><span>Planejamentos em andamento</span></Panel>
      <Panel><small>RASCUNHOS</small><b>{drafts}</b><span>Planos que você ainda está montando</span></Panel>
      <Panel><small>CONTEÚDOS SELECIONADOS</small><b>{topics}</b><span>Itens escolhidos nos seus planos</span></Panel>
      <Panel><small>FLASHCARDS VENCIDOS</small><b>{metrics.dueCards}</b><span>Famílias para revisar no FSRS</span><Link to="/reviews" className="text-link">Revisar agora <ArrowRight size={13}/></Link></Panel>
      <Panel><small>ERROS PARA RETOMAR</small><b>{metrics.dueErrors}</b><span>Novas questões para aplicar</span><Link to="/errors" className="text-link">Abrir questões <ArrowRight size={13}/></Link></Panel>
      <Panel><small>QUESTÕES RESOLVIDAS</small><b>{metrics.questions}</b><span>{metrics.questions ? Math.round(metrics.correct / metrics.questions * 100) : 0}% de acertos registrados</span><Link to="/errors?view=performance" className="text-link">Ver desempenho <ArrowRight size={13}/></Link></Panel>
    </div>
    <Panel><div className="panel-head"><h2>Retomar planejamento</h2><Link className="text-link" to="/plans">Ver todos <ArrowRight size={15}/></Link></div>
      {recent.length ? recent.map(plan => <Link className="plan-row" key={plan.id} to={`/plans/${plan.id}/verticalize`}><b>{plan.title}</b><span>{[plan.position, plan.area].filter(Boolean).join(" · ")} · {plan.status === "active" ? "Ativo" : "Rascunho"}</span><ArrowRight size={16}/></Link>) : <div className="empty"><BookOpen size={28}/><h2>Seu primeiro plano começa aqui</h2><p>Cadastre o concurso, escolha o cargo e delimite a área de estudo.</p><Link className="primary-button" to="/plans/new">Criar primeiro plano</Link></div>}
    </Panel>
  </div>;
}

const GALLERY_DAYS = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
function galleryWeekStart(now: Date) {
  return new Date(now.getFullYear(),now.getMonth(),now.getDate()-(now.getDay()+6)%7);
}
function galleryDay(plan: StudyPlan,date: Date) {
  const config=plan.scheduleConfig, key=dateKey(date), day=date.getDay();
  const active=Boolean(config?.days.includes(day) && (!config.startDate || key>=config.startDate) && (!config.examDate || key<=config.examDate));
  const slot=active?config?.daySchedules?.[day]:undefined;
  const tasks=active?plan.assignments.filter(item=>item.day===day):[];
  const pending=tasks.filter(item=>!(item.completedDates||[]).includes(key)).length;
  const simulation=Boolean(slot?.simulation);
  const pendingSimulation=simulation && !(slot?.completedDates||[]).includes(key);
  return {active,slot,tasks,pending,simulation,pendingSimulation,hasSession:tasks.length>0||simulation};
}
function galleryNext(plan:StudyPlan, now:Date) {
  if(plan.status!=="active"||!plan.scheduleConfig)return null;
  const today= new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const start=plan.scheduleConfig.startDate?fromDateKey(plan.scheduleConfig.startDate):today;
  const base=start>today?start:today;
  for(let i=0;i<370;i++){
    const date=new Date(base.getFullYear(),base.getMonth(),base.getDate()+i);
    if(plan.scheduleConfig.examDate&&dateKey(date)>plan.scheduleConfig.examDate)break;
    const session=galleryDay(plan,date);
    if(session.pending||session.pendingSimulation)return {date,...session};
  }
  return null;
}
function Plans() {
  const [items,setItems]=useState<StudyPlan[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{listPlans().then(setItems).catch(()=>setError("Não foi possível abrir seus planos.")).finally(()=>setLoading(false));},[]);
  const now=new Date(), weekStart=galleryWeekStart(now);
  const weekDates=GALLERY_DAYS.map((_,i)=>new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()+i));
  return <div className="stack hybrid-plans ritmo-plan-surface">
    <Heading eyebrow="PLANEJAMENTO" title="Meus planos" desc="" action={<Link className="primary-button" to="/plans/new">Novo plano <ArrowRight size={16}/></Link>}/>
    <div className="gallery-section-heading"><h2>Seus planejamentos</h2><span>{items.length} {items.length===1?"plano":"planos"}</span></div>
    {loading?<div className="loading-panel">Carregando planos…</div>:error?<Panel>{error}</Panel>:items.length?<div className="plans-grid gallery-grid">{items.map(plan=>{
      const leaves=getSelectedLeaves(plan.tree), ids=new Set(leaves.map(item=>item.id));
      const count=leaves.length, valid=plan.assignments.filter(item=>ids.has(item.nodeId)&&plan.scheduleConfig?.days.includes(item.day));
      const organized=new Set(valid.map(item=>item.nodeId)).size;
      const percent=count?Math.round(organized/count*100):0;
      const next=galleryNext(plan,now);
      const nextLabel=next?`${dateKey(next.date)===dateKey(now)?"Hoje":next.date.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"})}${next.slot?.startTime&&next.slot.endTime?` · ${next.slot.startTime}–${next.slot.endTime}`:" · Horário a definir"}`:plan.status==="draft"?"Continue a montagem do seu plano":plan.status==="completed"?"Percurso concluído":"Nenhuma sessão futura definida";
      return <article className="gallery-plan" key={plan.id}>
        <div className="gallery-plan-top"><span className={`gallery-status ${plan.status}`}>{plan.status==="active"?"Ativo":plan.status==="completed"?"Concluído":"Rascunho"}</span><div className="gallery-ring" style={{background:`conic-gradient(var(--blue) ${percent}%, var(--track) 0)`}} aria-label={`${percent}% dos conteúdos organizados`}><b>{percent}%</b></div></div>
        <div className="gallery-name"><h3>{plan.title}</h3><p>{[plan.institution,plan.position,plan.area].filter(Boolean).join(" · ")}</p></div>
        <div className="gallery-next"><small>{plan.status==="draft"?"EM CONSTRUÇÃO":next?.pendingSimulation?"PRÓXIMO SIMULADO / ESTUDO":"PRÓXIMA SESSÃO"}</small><strong>{nextLabel}</strong>{next&&<span>{next.pending} {next.pending===1?"assunto pendente":"assuntos pendentes"}{next.pendingSimulation?" · Simulado":""}</span>}</div>
        <div className="gallery-progress-label"><span>Organização da semana</span><b>{organized}/{count}</b></div>
        <div className="gallery-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Organização do plano"><i style={{width:percent+"%"}}/></div>
        <div className="gallery-week" aria-label="Semana atual"><span className="rp-gallery-week-caption">Esta semana</span>{weekDates.map((date,i)=>{
          const d=galleryDay(plan,date);
          const state= d.hasSession&&!d.pending&&!d.pendingSimulation?"done":d.simulation?"simulation":d.tasks.length?"study":d.active?"available":"";
          return <div key={i} title={`${GALLERY_DAYS[i]}: ${d.tasks.length} conteúdo(s)${d.simulation?" · Simulado":""}`}><span>{GALLERY_DAYS[i]}</span><i className={state}>{state==="done"?<CheckCircle2 size={13}/>:d.simulation?"S":d.tasks.length||""}</i></div>;
        })}</div>
        {count>organized&&<span className="gallery-pending">{count-organized} conteúdo(s) sem dia</span>}
        <div className="gallery-actions"><Link className="secondary-button" to={`/plans/${plan.id}`}>Ver plano</Link><Link className="primary-button" to={`/plans/${plan.id}/verticalize`}>{plan.status==="draft"?"Continuar":"Organizar semana"} <ArrowRight size={14}/></Link></div>
      </article>;
    })}</div>:<Panel><div className="empty"><FolderKanban size={28}/><h2>Seu primeiro plano</h2><p>Comece escolhendo o concurso e o conteúdo do edital.</p><Link className="primary-button" to="/plans/new">Criar plano</Link></div></Panel>}
  </div>;
}

function NewPlan() {
  const navigate = useNavigate();
  const [values, setValues] = useState<NewStudyPlan>({ title: "", institution: "", position: "", area: "", organizer: "", examDate: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function change<K extends keyof NewStudyPlan>(key: K, value: NewStudyPlan[K]) {
    setValues(current => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const plan = await createPlan(values);
      navigate(`/plans/${plan.id}/verticalize`);
    } catch {
      setError("Não foi possível salvar o plano neste navegador. Tente novamente.");
      setSaving(false);
    }
  }
  return <div className="stack ritmo-plan-surface rp-new-plan">
    <Heading eyebrow="PLANEJAMENTO · NOVO PLANO" title="Identifique seu concurso" desc="Um concurso pode ter vários cargos e áreas. Cada plano deve representar o recorte que você realmente vai estudar."/>
    <Panel className="wizard-panel">
      <div className="panel-title-row"><div><span className="step-kicker">PASSO 1 · IDENTIFICAÇÃO</span><h2>Sobre o que você vai estudar?</h2><p>Essas informações ajudam a IA a não misturar conteúdos de outros cargos ou áreas.</p></div><span className="soft-tag">Você controla o plano</span></div>
      <form className="form-grid" onSubmit={submit}>
        <div className="field-block field-span"><label htmlFor="plan-title">Nome do plano *</label><input id="plan-title" required maxLength={120} placeholder="Ex.: SEDUC-CE 2026" value={values.title} onChange={event => change("title", event.target.value)}/></div>
        <div className="field-block"><label htmlFor="plan-institution">Instituição</label><input id="plan-institution" maxLength={120} placeholder="Ex.: SEDUC-CE" value={values.institution} onChange={event => change("institution", event.target.value)}/></div>
        <div className="field-block"><label htmlFor="plan-position">Cargo *</label><input id="plan-position" required maxLength={150} placeholder="Ex.: Professor" value={values.position} onChange={event => change("position", event.target.value)}/></div>
        <div className="field-block"><label htmlFor="plan-area">Área de estudo / recorte *</label><input id="plan-area" required maxLength={150} placeholder="Ex.: Física, Conhecimentos gerais, TAE" value={values.area} onChange={event => change("area", event.target.value)}/><small>Se o concurso tiver várias áreas, crie um plano separado para cada recorte. Assim, a verticalização não mistura programas diferentes.</small></div>
        <div className="field-block"><label htmlFor="plan-organizer">Banca organizadora</label><input id="plan-organizer" maxLength={100} placeholder="Ex.: CEV/UECE" value={values.organizer} onChange={event => change("organizer", event.target.value)}/></div>
        <div className="field-block"><label htmlFor="plan-date">Data da prova (opcional)</label><input id="plan-date" type="date" value={values.examDate} onChange={event => change("examDate", event.target.value)}/></div>
        {error && <p className="inline-feedback field-span" role="alert">{error}</p>}
        <div className="form-actions field-span"><Link to="/plans">Cancelar</Link><button className="primary-button" disabled={saving}>{saving ? "Salvando…" : "Salvar e continuar"} <ArrowRight size={16}/></button></div>
      </form>
    </Panel>
  </div>;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
const features: Record<string, [string, string, string[]]> = {
  learn: ["Aprender", "Atividades construídas a partir do seu próprio material.", ["Autoexplicação", "Recuperação livre", "Retomada de erros", "Prática intercalada", "Histórico de sessões"]],
  flashcards: ["Flashcards", "Famílias de conhecimentos e versões de cartões.", ["Famílias de microconhecimentos", "Cartões básicos, lacunas e respostas digitadas", "Imagens com ocultação", "Fontes e justificativas"]],
  reviews: ["Revisões", "Revisões programadas pelo FSRS.", ["Fila de revisões", "Esquecimentos recorrentes", "Filtros por área", "Histórico de retenção"]],
  questions: ["Questões", "Registro de blocos e desempenho.", ["Bancas e blocos", "Acertos e erros", "Histórico", "Desempenho por assunto"]],
  errors: ["Caderno de erros", "Transforme dificuldades em registros retomáveis.", ["Enunciado e alternativas", "Causa do erro", "Vínculos com conteúdos", "Reaplicação programada"]],
  import: ["Importar conteúdos", "Traga materiais próprios para a biblioteca.", ["JSON e CSV", "Pré-visualização", "Validação", "Preservação das fontes"]],
  curation: ["Curadoria", "Revise os conteúdos antes de estudar.", ["Editar cartões", "Aprovar ou rejeitar", "Publicar e suspender", "Histórico"]],
  settings: ["Ajustes", "Configurações e segurança dos dados.", ["Armazenamento local", "Migração não destrutiva", "Backup e restauração", "Preferências FSRS"]],
};
function Feature({ name }: { name: string }) {
  const [title, desc, items] = features[name];
  return <div className="stack"><Heading eyebrow="ESPAÇO DE ESTUDOS" title={title} desc={desc}/><Panel><ClipboardList size={25}/><h2>Esta área faz parte da nova arquitetura.</h2><p>Os fluxos completos serão incorporados nas próximas etapas da refatoração. Seus recursos não foram removidos da versão anterior.</p><hr/>{items.map(item => <p key={item}>✓ &nbsp;{item}</p>)}</Panel></div>;
}

export function App() {
  return <HashRouter><Shell/></HashRouter>;
}
