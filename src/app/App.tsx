import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowRight, BookOpen, Brain, CalendarDays, CheckCircle2, ClipboardList,
  FileText, FolderKanban, LayoutDashboard, Layers3, NotebookPen, Settings, Target,
  Upload, WandSparkles,
} from "lucide-react";
import { HashRouter, Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { createPlan, listPlans } from "../data/plans";
import { getStudySettings, listConcepts, listErrors, listQuestionBlocks } from "../data/study";
import type { NewStudyPlan, StudyPlan } from "../domain/models";
import { getSelectedLeaves } from "../domain/verticalization";
import { PlanDetailRoute, PlanWizardRoute } from "../features/plans/PlanWizard";
import { FlashcardEditorPage, FlashcardsPage, ReviewPageRoute } from "../features/study/Flashcards";
import { ErrorsPage, QuestionsPage } from "../features/practice/Practice";
import { SettingsPage } from "../features/settings/Settings";
import { LearningPage } from "../features/study/Learning";

const groups = [
  ["VISÃO GERAL", [["Painel", "/", LayoutDashboard]]],
  ["PLANEJAMENTO", [["Meus planos", "/plans", FolderKanban], ["Agenda", "/agenda", CalendarDays]]],
  ["APRENDIZAGEM", [["Aprender", "/learn", Brain], ["Flashcards", "/flashcards", Layers3], ["Revisões", "/reviews", Activity]]],
  ["PRÁTICA", [["Questões", "/questions", Target], ["Caderno de erros", "/errors", NotebookPen]]],
  ["CONTEÚDOS", [["Importar", "/import", Upload], ["Curadoria", "/curation", WandSparkles]]],
  ["PREFERÊNCIAS", [["Ajustes", "/settings", Settings]]],
] as const;

function Heading({ eyebrow, title, desc, action }: { eyebrow: string; title: string; desc: string; action?: ReactNode }) {
  return <header className="heading"><div><small>{eyebrow}</small><h1>{title}</h1><p>{desc}</p></div>{action}</header>;
}
function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}
function Shell() {
  return <div className="shell">
    <aside className="sidebar">
      <Link to="/" className="brand"><i>R</i><span><b>Ritmo</b><small>SEU ESPAÇO DE ESTUDOS</small></span></Link>
      <nav>{groups.map(([label, items]) => <section key={label}><small>{label}</small>{items.map(([name, path, Icon]) => <NavLink key={path} to={path} end={path === "/"}><Icon size={17}/>{name}</NavLink>)}</section>)}</nav>
      <footer><b>Estude no seu ritmo.</b><small>Do edital à aprendizagem.</small><small>Seus dados ficam salvos neste navegador.</small></footer>
    </aside>
    <main className="main">
      <header className="mobile-head"><Link to="/">◈ Ritmo</Link><small>8.0 · nova estrutura</small></header>
      <Routes>
        <Route index element={<Dashboard/>}/>
        <Route path="/plans" element={<Plans/>}/>
        <Route path="/plans/new" element={<NewPlan/>}/>
        <Route path="/plans/:id/verticalize" element={<PlanWizardRoute/>}/>
        <Route path="/plans/:id" element={<PlanDetailRoute/>}/>
        <Route path="/agenda" element={<Agenda/>}/>
        <Route path="/flashcards" element={<FlashcardsPage/>}/>
        <Route path="/flashcards/new" element={<FlashcardEditorPage/>}/>
        <Route path="/flashcards/:id/edit" element={<FlashcardEditorPage/>}/>
        <Route path="/reviews" element={<ReviewPageRoute/>}/>
        <Route path="/questions" element={<QuestionsPage/>}/>
        <Route path="/errors" element={<ErrorsPage/>}/>
        <Route path="/settings" element={<SettingsPage/>}/>
        <Route path="/learn" element={<LearningPage/>}/>
        {["import","curation"].map(name => <Route key={name} path={`/${name}`} element={<Feature name={name}/>}/>)}
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
    Promise.all([listPlans(), listConcepts(), listErrors(), listQuestionBlocks(), getStudySettings()])
      .then(([nextPlans, concepts, errors, blocks, settings]) => {
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
    <Heading eyebrow="SEU ESPAÇO DE ESTUDOS" title="Vamos no seu ritmo." desc="Organize o que estudar, acompanhe seu progresso e aprenda com consistência." action={<Link className="primary-button" to="/plans/new">Novo plano <ArrowRight size={16}/></Link>}/>
    <section className="hero"><small>✦ RITMO 8 · NOVA ESTRUTURA</small><h2>Do edital à aprendizagem, em um só lugar.</h2><p>Transforme o conteúdo do concurso em um percurso de estudos que respeita suas escolhas e sua disponibilidade.</p><Link className="primary-button" to="/plans">Organizar meus estudos <ArrowRight size={16}/></Link></section>
    <div className="stats expanded-stats">
      <Panel><small>PLANOS ATIVOS</small><b>{active}</b><span>Planejamentos em andamento</span></Panel>
      <Panel><small>RASCUNHOS</small><b>{drafts}</b><span>Planos que você ainda está montando</span></Panel>
      <Panel><small>CONTEÚDOS SELECIONADOS</small><b>{topics}</b><span>Itens escolhidos nos seus planos</span></Panel>
      <Panel><small>FLASHCARDS VENCIDOS</small><b>{metrics.dueCards}</b><span>Famílias para revisar no FSRS</span><Link to="/reviews" className="text-link">Revisar agora <ArrowRight size={13}/></Link></Panel>
      <Panel><small>ERROS PARA RETOMAR</small><b>{metrics.dueErrors}</b><span>Novas questões para aplicar</span><Link to="/errors" className="text-link">Abrir caderno <ArrowRight size={13}/></Link></Panel>
      <Panel><small>QUESTÕES RESOLVIDAS</small><b>{metrics.questions}</b><span>{metrics.questions ? Math.round(metrics.correct / metrics.questions * 100) : 0}% de acertos registrados</span><Link to="/questions" className="text-link">Ver desempenho <ArrowRight size={13}/></Link></Panel>
    </div>
    <Panel><div className="panel-head"><h2>Retomar planejamento</h2><Link className="text-link" to="/plans">Ver todos <ArrowRight size={15}/></Link></div>
      {recent.length ? recent.map(plan => <Link className="plan-row" key={plan.id} to={`/plans/${plan.id}/verticalize`}><b>{plan.title}</b><span>{[plan.position, plan.area].filter(Boolean).join(" · ")} · {plan.status === "active" ? "Ativo" : "Rascunho"}</span><ArrowRight size={16}/></Link>) : <div className="empty"><BookOpen size={28}/><h2>Seu primeiro plano começa aqui</h2><p>Cadastre o concurso, escolha o cargo e delimite a área de estudo. Depois, o Ritmo guia a verticalização e a seleção do conteúdo.</p><Link className="primary-button" to="/plans/new">Criar primeiro plano</Link></div>}
    </Panel>
  </div>;
}

function Plans() {
  const [items, setItems] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { listPlans().then(setItems).finally(() => setLoading(false)); }, []);
  return <div className="stack">
    <Heading eyebrow="PLANEJAMENTO" title="Meus planos" desc="Cada plano representa um concurso, cargo e recorte de estudo. Você escolhe o que entra no seu percurso." action={<Link className="primary-button" to="/plans/new">Novo plano <ArrowRight size={16}/></Link>}/>
    <Panel><div className="panel-head"><h2>Seus planejamentos</h2><small>{items.length} salvo(s)</small></div>
      {loading ? <div className="loading-panel">Carregando planos…</div> : items.length ? items.map(plan => {
        const count = getSelectedLeaves(plan.tree).length;
        return <article className="plan-card" key={plan.id}>
          <div className="plan-card-top"><div><span className={`status-pill ${plan.status}`}>{plan.status === "active" ? "Ativo" : plan.status === "completed" ? "Concluído" : "Rascunho"}</span><h3>{plan.title}</h3><p>{[plan.institution, plan.position, plan.area].filter(Boolean).join(" · ")}</p></div><strong>{count}<small>conteúdo(s)</small></strong></div>
          <div className="plan-card-actions"><Link className="secondary-button" to={`/plans/${plan.id}`}>Ver plano</Link><Link className="primary-button" to={`/plans/${plan.id}/verticalize`}>{plan.status === "active" ? "Editar percurso" : "Continuar"} <ArrowRight size={15}/></Link></div>
        </article>;
      }) : <div className="empty"><FolderKanban size={28}/><h2>Nenhum plano por aqui ainda</h2><p>Comece identificando o concurso, o cargo e a área de estudo que deseja preparar.</p><Link className="primary-button" to="/plans/new">Criar meu primeiro plano</Link></div>}
    </Panel>
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
  return <div className="stack">
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

const WEEKDAYS = [{ id: 1, label: "Segunda" }, { id: 2, label: "Terça" }, { id: 3, label: "Quarta" }, { id: 4, label: "Quinta" }, { id: 5, label: "Sexta" }, { id: 6, label: "Sábado" }, { id: 0, label: "Domingo" }];
function Agenda() {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  useEffect(() => { listPlans().then(setPlans); }, []);
  const active = plans.filter(plan => plan.status === "active" && plan.assignments.length);
  return <div className="stack">
    <Heading eyebrow="PLANEJAMENTO" title="Agenda semanal" desc="Veja como os conteúdos dos seus planos estão distribuídos ao longo da semana."/>
    {active.length ? active.map(plan => <Panel key={plan.id}><div className="panel-head"><div><h2>{plan.title}</h2><p>{[plan.position, plan.area].filter(Boolean).join(" · ")}</p></div><Link className="text-link" to={`/plans/${plan.id}/verticalize`}>Editar <ArrowRight size={15}/></Link></div><div className="agenda-week">{WEEKDAYS.filter(day => plan.scheduleConfig?.days.includes(day.id)).map(day => {
      const topics = plan.assignments.filter(item => item.day === day.id);
      return <section key={day.id}><div className="agenda-day-title"><strong>{day.label}</strong><span>{topics.length}</span></div>{topics.length ? topics.map(item => <div className="agenda-topic" key={item.nodeId}><span>{item.name}</span><small>{item.path.slice(0, -1).join(" / ")}</small></div>) : <p className="empty-day">Sem tópicos distribuídos.</p>}</section>;
    })}</div></Panel>) : <Panel><div className="empty"><CalendarDays size={28}/><h2>Sua agenda começa com um plano</h2><p>Depois de selecionar os conteúdos e definir seus dias disponíveis, a distribuição aparecerá aqui.</p><Link className="primary-button" to="/plans">Abrir meus planos</Link></div></Panel>}
  </div>;
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
