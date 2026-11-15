import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowRight, BookOpen, Brain, CalendarDays, CheckCircle2, ChevronRight,
  Clock3, FileText, Folder, Home, LayoutGrid, NotebookPen, Plus, Settings,
  Target, TrendingUp, Layers3, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { createPlan, listPlans } from "../data/plans";
import { listConcepts, listErrors } from "../data/study";
import {
  createStudyPage, listQuestionAttempts, listStudyPages, listStudySessions,
} from "../data/ritmo9";
import type { NewStudyPlan, StudyPlan, PlanNode } from "../domain/models";
import type { StudyPageRecord, QuestionAttemptRecord } from "../domain/ritmo9";
import { calculateTopicPerformance } from "../domain/ritmo9";
import { getSelectedLeaves } from "../domain/verticalization";
import { PlanDetailRoute, PlanWizardRoute } from "../features/plans/PlanWizard";
import { FlashcardEditorPage, FlashcardsPage, ReviewPageRoute } from "../features/study/Flashcards";
import { ErrorsPage } from "../features/practice/Practice";
import { SettingsPage } from "../features/settings/Settings";
import { LearningPage } from "../features/study/Learning";
import { AgendaPage } from "../features/agenda/AgendaPage";
import { CurationPage, ImportPage } from "../features/study/ImportCuration";
import { StudyPage } from "../features/workspace/StudyPage";
import "./ritmo9.css";

const primaryNav = [
  { to: "/today", label: "Hoje", icon: Home },
  { to: "/space", label: "Meu espaço", icon: LayoutGrid },
  { to: "/plans", label: "Planejar", icon: CalendarDays },
  { to: "/study", label: "Estudar", icon: BookOpen },
  { to: "/performance", label: "Desempenho", icon: TrendingUp },
];

function PageHeading({ title, subtitle, action }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return <header className="r9-heading">
    <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {action}
  </header>;
}

function Shell() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("ritmo9:sidebar-collapsed") === "1"; }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("ritmo9:sidebar-collapsed", collapsed ? "1" : "0"); }
    catch { /* The sidebar control remains available for this session. */ }
  }, [collapsed]);

  return <div className={`r9-shell${collapsed ? " is-collapsed" : ""}`}>
    <aside className="r9-sidebar">
      <Link to="/today" className="r9-brand">
        <span className="r9-brand-mark">r</span>
        <span><strong>ritmo</strong><small>ESPAÇO DE ESTUDOS</small></span>
      </Link>
      <div className="r9-nav-label">SEU ESPAÇO</div>
      <nav className="r9-primary-nav" aria-label="Navegação principal">
        {primaryNav.map(item => {
          const Icon = item.icon;
          return <NavLink key={item.to} to={item.to} className={({ isActive }) => `r9-nav-link${isActive ? " active" : ""}`}>
            <Icon size={18} strokeWidth={1.8}/><span>{item.label}</span>
          </NavLink>;
        })}
      </nav>
      <div className="r9-sidebar-bottom">
        <Link to="/agenda" className="r9-utility-link"><CalendarDays size={17}/> Agenda</Link>
        <Link to="/settings" className="r9-utility-link"><Settings size={17}/> Ajustes</Link>
        <div className="r9-sidebar-foot">Seus estudos, no seu ritmo.</div>
      </div>
    </aside>
    <button
      className="r9-sidebar-toggle"
      type="button"
      title={collapsed ? "Mostrar navegação" : "Recolher navegação"}
      aria-label={collapsed ? "Mostrar navegação" : "Recolher navegação"}
      onClick={() => setCollapsed(value => !value)}
    >{collapsed ? <PanelLeftOpen size={16}/> : <PanelLeftClose size={16}/>}</button>
    <main className="r9-main">
      <header className="r9-topbar">
        <div className="r9-mobile-brand"><span className="r9-brand-mark">r</span><strong>ritmo</strong></div>
        <div className="r9-topbar-spacer"/>
        <Link to="/space/new" className="r9-quick-create"><Plus size={16}/> Criar</Link>
      </header>
      <div className="r9-main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace/>}/>
          <Route path="/today" element={<TodayPage/>}/>
          <Route path="/space" element={<WorkspaceHome/>}/>
          <Route path="/space/new" element={<NewStudyPage/>}/>
          <Route path="/space/:id" element={<StudyPage/>}/>
          <Route path="/plans" element={<PlanHub/>}/>
          <Route path="/plans/new" element={<NewPlanPage/>}/>
          <Route path="/plans/:id/verticalize" element={<PlanWizardRoute/>}/>
          <Route path="/plans/:id" element={<PlanDetailRoute/>}/>
          <Route path="/agenda" element={<AgendaPage/>}/>
          <Route path="/study" element={<StudyHub/>}/>
          <Route path="/learn" element={<LearningPage/>}/>
          <Route path="/flashcards" element={<FlashcardsPage/>}/>
          <Route path="/flashcards/new" element={<FlashcardEditorPage/>}/>
          <Route path="/flashcards/:id/edit" element={<FlashcardEditorPage/>}/>
          <Route path="/reviews" element={<ReviewPageRoute/>}/>
          <Route path="/errors" element={<ErrorsPage/>}/>
          <Route path="/import" element={<ImportPage/>}/>
          <Route path="/curation" element={<CurationPage/>}/>
          <Route path="/performance" element={<PerformancePage/>}/>
          <Route path="/settings" element={<SettingsPage/>}/>
          <Route path="*" element={<Navigate to="/today" replace/>}/>
        </Routes>
      </div>
      <footer className="r9-footer">Ritmo 9 · Seu espaço de estudos</footer>
    </main>
    <nav className="r9-mobile-nav" aria-label="Navegação móvel">
      {primaryNav.map(item => {
        const Icon = item.icon;
        return <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? "active" : ""}>
          <Icon size={18}/><small>{item.label}</small>
        </NavLink>;
      })}
    </nav>
  </div>;
}

function TodayPage() {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [pages, setPages] = useState<StudyPageRecord[]>([]);
  const [errors, setErrors] = useState<Awaited<ReturnType<typeof listErrors>>>([]);
  const [concepts, setConcepts] = useState<Awaited<ReturnType<typeof listConcepts>>>([]);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listStudySessions>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([listPlans(), listStudyPages(), listErrors(), listConcepts(), listStudySessions()])
      .then(([p, pg, er, c, s]) => {
        if (!alive) return;
        setPlans(p); setPages(pg); setErrors(er); setConcepts(c); setSessions(s);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const todayKey = new Date().toLocaleDateString("en-CA");
  const dueErrors = errors.filter(item => item.status !== "dominado" && item.nextReview <= Date.now());
  const dueCards = concepts.filter(item => item.status === "published" && !item.suspended && item.fsrs.due <= Date.now());
  const sessionsToday = sessions.filter(item => item.endedAt && new Date(item.startedAt).toLocaleDateString("en-CA") === todayKey);
  const recentPage = pages[0];
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return <div className="r9-page">
    <PageHeading title="Hoje" subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}/>
    <section className="r9-welcome">
      <div><span className="r9-eyebrow">SEU PONTO DE PARTIDA</span><h2>Um passo de cada vez.</h2><p>Organize o que importa, estude com intenção e acompanhe o que está avançando.</p></div>
      <Link to={recentPage ? `/space/${recentPage.id}` : "/space/new"} className="r9-button r9-button-primary">{recentPage ? "Continuar estudando" : "Criar página de estudo"} <ArrowRight size={15}/></Link>
    </section>

    <div className="r9-today-grid">
      <section className="r9-section r9-today-main">
        <div className="r9-section-title"><h2>Retomar de onde parei</h2><Link to="/space">Meu espaço <ArrowRight size={14}/></Link></div>
        {loading ? <p className="r9-muted">Carregando seu espaço…</p> : recentPage ? <Link className="r9-continue-row" to={`/space/${recentPage.id}`}>
          <span className="r9-file-icon"><FileText size={19}/></span><span><strong>{recentPage.title}</strong><small>{recentPage.topicLinks.length ? "Página vinculada ao seu plano" : "Página de estudo"}</small></span><ChevronRight size={17}/>
        </Link> : <div className="r9-empty-inline"><p>Você ainda não criou uma página de estudo.</p><Link to="/space/new">Criar minha primeira página <ArrowRight size={14}/></Link></div>}

        <div className="r9-section-title r9-section-title-spaced"><h2>O que merece atenção</h2><Link to="/performance">Ver desempenho <ArrowRight size={14}/></Link></div>
        <div className="r9-attention-list">
          <Link to="/errors?due=1" className="r9-attention-row"><span className="r9-attention-icon amber"><NotebookPen size={17}/></span><span><strong>Erros para retomar</strong><small>Registros com revisão prevista para hoje ou atrasada</small></span><b>{dueErrors.length}</b></Link>
          <Link to="/reviews" className="r9-attention-row"><span className="r9-attention-icon blue"><Brain size={17}/></span><span><strong>Flashcards para revisar</strong><small>Famílias com revisão vencida no FSRS</small></span><b>{dueCards.length}</b></Link>
          <Link to="/plans" className="r9-attention-row"><span className="r9-attention-icon slate"><CalendarDays size={17}/></span><span><strong>Planos em andamento</strong><small>Concursos que você está organizando</small></span><b>{plans.filter(item => item.status === "active" || item.status === "draft").length}</b></Link>
        </div>
      </section>

      <aside className="r9-section r9-today-side">
        <div className="r9-section-title"><h2>Seu ritmo</h2><span>Hoje</span></div>
        <div className="r9-mini-metric"><span><Clock3 size={16}/> Sessões concluídas</span><strong>{sessionsToday.length}</strong></div>
        <div className="r9-mini-metric"><span><Target size={16}/> Erros em aberto</span><strong>{errors.filter(item => item.status !== "dominado").length}</strong></div>
        <div className="r9-mini-metric"><span><Folder size={16}/> Páginas criadas</span><strong>{pages.length}</strong></div>
        <div className="r9-side-note">O Ritmo separa tempo planejado de tempo realmente estudado. Só sessões encerradas entram no tempo realizado.</div>
        <Link to="/study" className="r9-subtle-link">Abrir ferramentas de estudo <ArrowRight size={14}/></Link>
      </aside>
    </div>
  </div>;
}

function WorkspaceHome() {
  const [pages, setPages] = useState<StudyPageRecord[]>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([listStudyPages(), listPlans()])
      .then(([nextPages, nextPlans]) => { setPages(nextPages); setPlans(nextPlans); })
      .finally(() => setLoading(false));
  }, []);
  const planNames = new Map(plans.map(plan => [plan.id, plan.title]));
  return <div className="r9-page">
    <PageHeading title="Meu espaço" subtitle="Páginas, anotações e materiais organizados do seu jeito."
      action={<Link to="/space/new" className="r9-button r9-button-primary"><Plus size={15}/> Nova página</Link>}/>
    <div className="r9-workspace-toolbar"><span>Recentes</span><span>{pages.length} {pages.length === 1 ? "página" : "páginas"}</span></div>
    {loading ? <p className="r9-muted">Carregando…</p> : pages.length ? <div className="r9-page-list">
      {pages.map(page => {
        const planTitle = page.topicLinks[0] ? planNames.get(page.topicLinks[0].planId) : undefined;
        return <Link to={`/space/${page.id}`} className="r9-page-list-row" key={page.id}>
          <span className="r9-file-icon"><FileText size={18}/></span>
          <span className="r9-page-list-copy"><strong>{page.title}</strong><small>{planTitle ? `Vinculada a ${planTitle}` : "Página livre"}</small></span>
          <time>{new Date(page.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</time>
          <ChevronRight size={16}/>
        </Link>;
      })}
    </div> : <div className="r9-empty-state"><FileText size={28}/><h2>Seu espaço começa com uma página.</h2><p>Escreva, organize ideias e relacione suas anotações aos assuntos do edital.</p><Link to="/space/new" className="r9-button r9-button-primary"><Plus size={15}/> Criar primeira página</Link></div>}
  </div>;
}

function NewStudyPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [title, setTitle] = useState("");
  const [planId, setPlanId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { listPlans().then(next => { setPlans(next); const active = next.find(item => item.status === "active") ?? next[0]; if (active) setPlanId(active.id); }); }, []);
  const selectedPlan = plans.find(plan => plan.id === planId);
  const leaves = selectedPlan ? getSelectedLeaves(selectedPlan.tree) : [];
  const selectedNode = leaves.find(item => item.id === nodeId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true); setError("");
    try {
      const page = await createStudyPage({
        title: title.trim(),
        topicLinks: selectedPlan && selectedNode ? [{ planId: selectedPlan.id, nodeId: selectedNode.id }] : [],
      });
      navigate(`/space/${page.id}`);
    } catch {
      setError("Não foi possível criar a página neste dispositivo.");
      setSaving(false);
    }
  }
  return <div className="r9-page r9-narrow-page">
    <div className="r9-back-link"><Link to="/space">← Meu espaço</Link></div>
    <PageHeading title="Nova página" subtitle="Comece pelo título. O restante pode ser organizado depois."/>
    <form className="r9-create-page-form" onSubmit={submit}>
      <label className="r9-field"><span>Nome da página</span><input autoFocus required value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Leis de Newton"/></label>
      <div className="r9-form-divider"/>
      <div className="r9-form-context-heading"><div><strong>Relacionar a um assunto</strong><small>Opcional · conecta esta página ao seu acompanhamento.</small></div></div>
      <label className="r9-field"><span>Plano</span><select value={planId} onChange={event => { setPlanId(event.target.value); setNodeId(""); }}><option value="">Sem plano · estudo livre</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.title} · {plan.area || plan.position}</option>)}</select></label>
      {selectedPlan && <label className="r9-field"><span>Assunto selecionado no edital</span><select value={nodeId} onChange={event => setNodeId(event.target.value)}><option value="">Escolher assunto…</option>{leaves.map(leaf => <option key={leaf.id} value={leaf.id}>{leaf.path.join(" / ")}</option>)}</select></label>}
      {selectedPlan && !leaves.length && <p className="r9-form-hint">Este plano ainda não tem assuntos selecionados. <Link to={`/plans/${selectedPlan.id}/verticalize`}>Organizar o edital primeiro.</Link></p>}
      {error && <p className="r9-form-error" role="alert">{error}</p>}
      <div className="r9-form-actions"><Link to="/space">Cancelar</Link><button className="r9-button r9-button-primary" disabled={saving}>{saving ? "Criando…" : "Criar página"} <ArrowRight size={15}/></button></div>
    </form>
  </div>;
}

function PlanHub() {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { listPlans().then(setPlans).finally(() => setLoading(false)); }, []);
  return <div className="r9-page">
    <PageHeading title="Planejar" subtitle="Organize seus concursos, conteúdos e tempo de estudo."
      action={<Link to="/plans/new" className="r9-button r9-button-primary"><Plus size={15}/> Novo plano</Link>}/>
    <div className="r9-inline-tabs"><Link className="active" to="/plans">Meus planos</Link><Link to="/agenda">Agenda</Link></div>
    {loading ? <p className="r9-muted">Carregando planos…</p> : plans.length ? <div className="r9-plan-list">
      {plans.map(plan => {
        const count = getSelectedLeaves(plan.tree).length;
        return <article className="r9-plan-row" key={plan.id}>
          <div className="r9-plan-icon"><CalendarDays size={19}/></div>
          <div className="r9-plan-copy"><strong>{plan.title}</strong><span>{[plan.institution, plan.position, plan.area, plan.organizer].filter(Boolean).join(" · ")}</span><small>{count} assuntos selecionados · {plan.status === "active" ? "Em andamento" : plan.status === "completed" ? "Concluído" : "Em montagem"}</small></div>
          <Link to={`/plans/${plan.id}/verticalize`} className="r9-text-action">Abrir plano <ArrowRight size={14}/></Link>
        </article>;
      })}
    </div> : <div className="r9-empty-state"><CalendarDays size={28}/><h2>Nenhum plano ainda.</h2><p>Crie um plano para organizar o edital, escolher os assuntos e montar seu cronograma.</p><Link to="/plans/new" className="r9-button r9-button-primary">Criar plano</Link></div>}
  </div>;
}

function NewPlanPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<NewStudyPlan>({ title: "", institution: "", position: "", area: "", organizer: "", examDate: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function update<K extends keyof NewStudyPlan>(key: K, value: NewStudyPlan[K]) {
    setValues(current => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const plan = await createPlan(values);
      navigate(`/plans/${plan.id}/verticalize`);
    } catch {
      setError("Não foi possível salvar o plano. Tente novamente.");
      setSaving(false);
    }
  }
  return <div className="r9-page r9-narrow-page">
    <div className="r9-back-link"><Link to="/plans">← Planejar</Link></div>
    <PageHeading title="Novo plano" subtitle="Um plano representa um concurso, cargo e área de estudo."/>
    <form className="r9-create-page-form" onSubmit={submit}>
      <label className="r9-field"><span>Nome do plano</span><input required value={values.title} onChange={event => update("title", event.target.value)} placeholder="Ex.: SEDUC-CE 2026"/></label>
      <div className="r9-form-grid">
        <label className="r9-field"><span>Instituição</span><input value={values.institution} onChange={event => update("institution", event.target.value)} placeholder="SEDUC-CE"/></label>
        <label className="r9-field"><span>Cargo</span><input required value={values.position} onChange={event => update("position", event.target.value)} placeholder="Professor"/></label>
        <label className="r9-field"><span>Área / recorte</span><input required value={values.area} onChange={event => update("area", event.target.value)} placeholder="Física"/></label>
        <label className="r9-field"><span>Banca</span><input value={values.organizer} onChange={event => update("organizer", event.target.value)} placeholder="CEV/UECE"/></label>
        <label className="r9-field"><span>Data da prova <small>opcional</small></span><input type="date" value={values.examDate} onChange={event => update("examDate", event.target.value)}/></label>
      </div>
      {error && <p className="r9-form-error" role="alert">{error}</p>}
      <div className="r9-form-actions"><Link to="/plans">Cancelar</Link><button className="r9-button r9-button-primary" disabled={saving}>{saving ? "Salvando…" : "Criar e continuar"} <ArrowRight size={15}/></button></div>
    </form>
  </div>;
}

function StudyHub() {
  const tools = [
    { to: "/learn", title: "Aprender", desc: "Recuperação livre, autoexplicação e prática intercalada.", icon: Brain },
    { to: "/flashcards", title: "Flashcards", desc: "Organize conhecimentos e variantes aprovadas.", icon: Layers3 },
    { to: "/reviews", title: "Revisões", desc: "Retome os cartões na fila do FSRS.", icon: Activity },
    { to: "/errors", title: "Caderno de erros", desc: "Acompanhe dificuldades e reaplicações.", icon: NotebookPen },
    { to: "/import", title: "Importar materiais", desc: "Traga conteúdos para sua biblioteca.", icon: FileText },
    { to: "/curation", title: "Curadoria", desc: "Revise e publique as versões de estudo.", icon: CheckCircle2 },
  ];
  return <div className="r9-page">
    <PageHeading title="Estudar" subtitle="Entre no modo de estudo ou retome uma dificuldade."/>
    <div className="r9-tool-list">{tools.map(item => {
      const Icon = item.icon;
      return <Link to={item.to} className="r9-tool-row" key={item.to}><span className="r9-tool-icon"><Icon size={19}/></span><span><strong>{item.title}</strong><small>{item.desc}</small></span><ChevronRight size={16}/></Link>;
    })}</div>
    <div className="r9-study-tip"><strong>Questões e anotações</strong><p>Abra uma página de estudo dentro de Meu espaço para registrar uma sessão, responder questões e relacionar cada tentativa ao assunto do edital.</p><Link to="/space">Ir para Meu espaço <ArrowRight size={14}/></Link></div>
  </div>;
}

function findPlanNode(nodes: PlanNode[], id: string): string | undefined {
  for (const node of nodes) {
    if (node.id === id) return node.name;
    const nested = findPlanNode(node.children, id);
    if (nested) return nested;
  }
  return undefined;
}

function PerformancePage() {
  const [attempts, setAttempts] = useState<QuestionAttemptRecord[]>([]);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listStudySessions>>>([]);
  const [errors, setErrors] = useState<Awaited<ReturnType<typeof listErrors>>>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([listQuestionAttempts(), listStudySessions(), listErrors(), listPlans()])
      .then(([a, s, e, p]) => { setAttempts(a); setSessions(s); setErrors(e); setPlans(p); })
      .finally(() => setLoading(false));
  }, []);
  const completedSessions = sessions.filter(session => session.endedAt && typeof session.durationSeconds === "number");
  const minutes = Math.round(completedSessions.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0) / 60);
  const correct = attempts.filter(attempt => attempt.isCorrect).length;
  const accuracy = attempts.length ? Math.round(correct / attempts.length * 100) : null;
  const topicRows = useMemo(() => {
    const grouped = calculateTopicPerformance(attempts);
    return grouped.map(item => {
      const plan = plans.find(candidate => candidate.id === item.planId);
      const title = plan ? findPlanNode(plan.tree, item.nodeId) : undefined;
      return { ...item, title: title ?? "Assunto não encontrado", planTitle: plan?.title ?? "Plano indisponível" };
    });
  }, [attempts, plans]);

  return <div className="r9-page">
    <PageHeading title="Desempenho" subtitle="Indicadores construídos a partir do que você realmente registra."/>
    {loading ? <p className="r9-muted">Calculando seus dados…</p> : <>
      <div className="r9-performance-metrics">
        <div><span>Questões respondidas</span><strong>{attempts.length}</strong><small>Tentativas individuais registradas</small></div>
        <div><span>Precisão</span><strong>{accuracy === null ? "—" : `${accuracy}%`}</strong><small>{attempts.length} {attempts.length === 1 ? "tentativa" : "tentativas"} no total</small></div>
        <div><span>Tempo medido</span><strong>{minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : `${minutes} min`}</strong><small>{completedSessions.length} sessões encerradas</small></div>
        <div><span>Erros em aberto</span><strong>{errors.filter(error => error.status !== "dominado").length}</strong><small>Registros ainda não superados</small></div>
      </div>
      <section className="r9-performance-section">
        <div className="r9-section-title"><h2>Desempenho por assunto</h2><span>{topicRows.length} assuntos com tentativas</span></div>
        {topicRows.length ? <div className="r9-performance-table">
          <div className="r9-performance-head"><span>Assunto</span><span>Questões</span><span>Precisão</span></div>
          {topicRows.map(row => <div className="r9-performance-row" key={row.key}>
            <span><strong>{row.title}</strong><small>{row.planTitle}</small></span>
            <b>{row.attempts}</b>
            <span className="r9-performance-value"><strong>{row.accuracy}%</strong><i><em style={{ width: `${row.accuracy}%` }}/></i>{row.attempts < 5 && <small>Amostra pequena</small>}</span>
          </div>)}
        </div> : <div className="r9-empty-inline"><p>Seu desempenho por assunto aparecerá aqui depois que você registrar questões em páginas vinculadas ao edital.</p><Link to="/space">Abrir Meu espaço <ArrowRight size={14}/></Link></div>}
      </section>
      <p className="r9-data-note">Precisão = acertos ÷ tentativas respondidas. Tempo medido considera apenas sessões encerradas. Revisões FSRS e reaplicações do caderno não entram no total de questões.</p>
    </>}
  </div>;
}

export function Ritmo9App() {
  return <HashRouter><Shell/></HashRouter>;
}
