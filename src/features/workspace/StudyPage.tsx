import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type { Block } from "@blocknote/core";
import { pt } from "@blocknote/core/locales";
import { ArrowLeft, Check, CircleAlert, Clock3, Play, Square, Target } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { StudyPlan, PlanNode } from "../../domain/models";
import type { PlanTopicRef, ErrorRecord } from "../../domain/study";
import type { StudyPageRecord, QuestionAttemptRecord } from "../../domain/ritmo9";
import { answerIsCorrect, subjectForArea } from "../../domain/ritmo9";
import { listPlans } from "../../data/plans";
import {
  createQuestionAttempt, createStudyQuestion, finishStudySession, getActiveStudySession,
  getStudyPage, listQuestionAttempts, saveStudyPage, startStudySession,
} from "../../data/ritmo9";
import { saveError } from "../../data/study";
import "./study-page.css";

function findNode(nodes: PlanNode[], id: string): PlanNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

function PageEditor({ page, onSaved }: {
  page: StudyPageRecord;
  onSaved: (page: StudyPageRecord) => void;
}) {
  const editor = useCreateBlockNote({
    dictionary: pt,
    initialContent: page.content.length ? page.content as Block[] : undefined,
  });
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState<unknown[]>(page.content);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  const changeContent = useCallback(() => {
    setContent(editor.document);
    setDirty(true);
    setSaveStatus("saving");
  }, [editor]);

  useEffect(() => {
    if (!dirty) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const next = await saveStudyPage({ ...page, title, content });
        if (active) {
          setDirty(false);
          setSaveStatus("saved");
          onSaved(next);
        }
      } catch {
        if (active) setSaveStatus("error");
      }
    }, 650);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [content, dirty, onSaved, page, title]);

  return <section className="r9-page-editor">
    <input
      className="r9-page-title-input"
      aria-label="Título da página"
      value={title}
      onChange={event => {
        setTitle(event.target.value);
        setDirty(true);
        setSaveStatus("saving");
      }}
      placeholder="Sem título"
      maxLength={160}
    />
    <div className="r9-editor-status" aria-live="polite">
      {saveStatus === "saving" ? "Salvando…" : saveStatus === "error" ? "Não foi possível salvar. Suas alterações continuam nesta tela." : "Salvo neste dispositivo"}
    </div>
    <div className="r9-block-editor">
      <BlockNoteView editor={editor} theme="light" onChange={changeContent} />
    </div>
  </section>;
}

function QuestionCapture({
  topicLinks,
  topicName,
  plan,
  onSaved,
}: {
  topicLinks: PlanTopicRef[];
  topicName: string;
  plan?: StudyPlan;
  onSaved: (attempt: QuestionAttemptRecord) => void;
}) {
  const [statement, setStatement] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [source, setSource] = useState("");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!statement.trim() || !correctAnswer.trim() || !selectedAnswer.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const options = optionsText.split("\n").map(value => value.trim()).filter(Boolean);
      const question = await createStudyQuestion({
        statement: statement.trim(),
        options,
        correctAnswer: correctAnswer.trim(),
        explanation: explanation.trim(),
        source: source.trim(),
        board: plan?.organizer ?? "",
        exam: plan?.title ?? "",
        year: "",
        difficulty: "",
        topicLinks,
      });
      const correct = answerIsCorrect(selectedAnswer, correctAnswer);
      const timeSpentSeconds = minutes.trim() ? Math.max(0, Number(minutes) * 60) : undefined;
      const attempt = await createQuestionAttempt({
        questionId: question.id,
        selectedAnswer: selectedAnswer.trim(),
        isCorrect: correct,
        mode: "practice",
        ...(Number.isFinite(timeSpentSeconds) ? { timeSpentSeconds } : {}),
        topicLinks,
      });

      if (!correct) {
        const now = Date.now();
        const errors = await listErrors();
        const error: ErrorRecord = {
          id: crypto.randomUUID(),
          sourceAttemptId: attempt.id,
          subject: subjectForArea(plan?.area ?? ""),
          discipline: plan?.area || "Geral",
          area: plan?.area || "",
          topic: topicName || "Estudo livre",
          type: "Questão",
          mistake: `Resposta registrada: ${selectedAnswer.trim()}.`,
          fix: [`Gabarito: ${correctAnswer.trim()}.`, explanation.trim()].filter(Boolean).join("\n\n"),
          reviewDays: 1,
          questionUrl: "",
          conceptId: "",
          questionText: statement.trim(),
          optionsText: options.join("\n"),
          correctAnswer: correctAnswer.trim(),
          at: now,
          nextReview: now + 24 * 60 * 60 * 1000,
          successes: 0,
          failures: 1,
          status: "pendente",
          history: [{ at: now, grade: "wrong" }],
          planTopics: topicLinks,
        };
        await saveError(error);
        void errors;
      }

      onSaved(attempt);
      setFeedback({
        correct,
        message: correct
          ? "Resposta registrada. O desempenho deste assunto foi atualizado."
          : "Resposta registrada. O erro foi enviado automaticamente ao caderno para retomada.",
      });
      setStatement("");
      setOptionsText("");
      setCorrectAnswer("");
      setSelectedAnswer("");
      setExplanation("");
      setSource("");
      setMinutes("");
    } catch {
      setFeedback({ correct: false, message: "Não foi possível registrar a tentativa. Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  return <section className="r9-question-capture">
    <div className="r9-section-heading">
      <div>
        <span className="r9-eyebrow">PRÁTICA</span>
        <h2>Registrar uma questão</h2>
      </div>
      <span className="r9-context-chip"><Target size={13}/>{topicName || "Estudo livre"}</span>
    </div>
    <form className="r9-question-form" onSubmit={submit}>
      <label className="r9-field r9-field-full">
        <span>Enunciado</span>
        <textarea required rows={3} value={statement} onChange={event => setStatement(event.target.value)} placeholder="Cole ou escreva a questão…"/>
      </label>
      <label className="r9-field">
        <span>Alternativas <small>uma por linha · opcional</small></span>
        <textarea rows={3} value={optionsText} onChange={event => setOptionsText(event.target.value)} placeholder={"A) …\nB) …\nC) …"}/>
      </label>
      <label className="r9-field">
        <span>Fonte <small>opcional</small></span>
        <input value={source} onChange={event => setSource(event.target.value)} placeholder="Banca, prova, link…"/>
      </label>
      <div className="r9-question-answer-row">
        <label className="r9-field">
          <span>Gabarito</span>
          <input required value={correctAnswer} onChange={event => setCorrectAnswer(event.target.value)} placeholder="Ex.: B"/>
        </label>
        <label className="r9-field">
          <span>Sua resposta</span>
          <input required value={selectedAnswer} onChange={event => setSelectedAnswer(event.target.value)} placeholder="Ex.: C"/>
        </label>
        <label className="r9-field">
          <span>Tempo <small>minutos · opcional</small></span>
          <input type="number" min="0" step="0.5" value={minutes} onChange={event => setMinutes(event.target.value)} placeholder="0"/>
        </label>
      </div>
      <label className="r9-field r9-field-full">
        <span>Comentário / explicação <small>opcional</small></span>
        <textarea rows={2} value={explanation} onChange={event => setExplanation(event.target.value)} placeholder="Por que essa é a resposta correta?"/>
      </label>
      <div className="r9-question-submit">
        {feedback && <p className={feedback.correct ? "is-correct" : "is-feedback"} role="status">{feedback.message}</p>}
        <button className="r9-button r9-button-primary" type="submit" disabled={saving}>{saving ? "Registrando…" : "Registrar tentativa"}</button>
      </div>
    </form>
  </section>;
}

export function StudyPage() {
  const { id = "" } = useParams();
  const [page, setPage] = useState<StudyPageRecord | null>(null);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [attempts, setAttempts] = useState<QuestionAttemptRecord[]>([]);
  const [activeSession, setActiveSession] = useState<{ id: string; startedAt: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([getStudyPage(id), listPlans(), listQuestionAttempts(), getActiveStudySession(id)])
      .then(([nextPage, nextPlans, nextAttempts, session]) => {
        if (!alive) return;
        setPage(nextPage ?? null);
        setPlans(nextPlans);
        setAttempts(nextAttempts);
        setActiveSession(session ? { id: session.id, startedAt: session.startedAt } : null);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const topic = useMemo(() => {
    const ref = page?.topicLinks[0];
    if (!ref) return undefined;
    const plan = plans.find(item => item.id === ref.planId);
    const node = plan ? findNode(plan.tree, ref.nodeId) : undefined;
    return { ref, plan, node, name: node?.name ?? "Assunto não encontrado" };
  }, [page, plans]);

  const pageAttempts = useMemo(() => {
    if (!topic) return [];
    return attempts.filter(attempt => attempt.topicLinks.some(ref => ref.planId === topic.ref.planId && ref.nodeId === topic.ref.nodeId));
  }, [attempts, topic]);

  const handleSavedPage = useCallback((next: StudyPageRecord) => setPage(next), []);

  async function toggleSession() {
    if (!page) return;
    setBusy(true);
    setSessionFeedback("");
    try {
      if (activeSession) {
        const finished = await finishStudySession(activeSession.id);
        setActiveSession(null);
        setSessionFeedback(finished?.durationSeconds
          ? `Sessão encerrada · ${Math.floor(finished.durationSeconds / 60)} min registrados.`
          : "Sessão encerrada.");
      } else {
        const session = await startStudySession({
          pageId: page.id,
          planId: topic?.ref.planId,
          topicLinks: page.topicLinks,
          mode: "study",
        });
        setActiveSession({ id: session.id, startedAt: session.startedAt });
        setSessionFeedback("Sessão iniciada. O tempo será registrado quando você encerrar.");
      }
    } catch {
      setSessionFeedback("Não foi possível atualizar a sessão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="r9-loading">Abrindo página…</div>;
  if (!page) return <div className="r9-empty-page"><h1>Página não encontrada</h1><Link to="/space">Voltar ao Meu espaço</Link></div>;

  return <div className="r9-study-page">
    <div className="r9-page-back"><Link to="/space"><ArrowLeft size={15}/> Meu espaço</Link><span>/</span><span>{topic?.plan?.title ?? "Página de estudo"}</span></div>
    <div className="r9-page-context">
      {topic ? <><span>{topic.plan?.area || topic.plan?.position}</span><span>·</span><strong>{topic.name}</strong></> : <span>Página livre · sem assunto vinculado</span>}
    </div>
    <div className="r9-session-bar">
      <div className="r9-session-status">
        <span className={activeSession ? "r9-live-dot is-live" : "r9-live-dot"}/>
        {activeSession ? "Sessão em andamento" : "Nenhuma sessão ativa"}
        {activeSession && <small>Iniciada às {new Date(activeSession.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>}
      </div>
      <button className={activeSession ? "r9-button r9-button-outline" : "r9-button r9-button-primary"} onClick={toggleSession} disabled={busy}>
        {activeSession ? <><Square size={14}/> Encerrar sessão</> : <><Play size={14}/> Iniciar sessão</>}
      </button>
    </div>
    {sessionFeedback && <p className="r9-inline-feedback" role="status">{sessionFeedback}</p>}
    <PageEditor key={page.id} page={page} onSaved={handleSavedPage}/>
    {topic && <div className="r9-topic-note"><Check size={14}/> Esta página está vinculada ao edital e ao assunto. Questões, erros e sessões registrados aqui alimentam o acompanhamento desse conteúdo.</div>}
    <QuestionCapture
      topicLinks={page.topicLinks}
      topicName={topic?.name ?? ""}
      plan={topic?.plan}
      onSaved={attempt => setAttempts(current => [attempt, ...current])}
    />
    {topic && <section className="r9-attempt-history">
      <div className="r9-section-heading"><div><span className="r9-eyebrow">HISTÓRICO</span><h2>Tentativas deste assunto</h2></div><span>{pageAttempts.length} registradas</span></div>
      {pageAttempts.length ? pageAttempts.slice(0, 5).map(attempt => <div className="r9-attempt-row" key={attempt.id}>
        <span className={attempt.isCorrect ? "r9-attempt-mark is-correct" : "r9-attempt-mark is-wrong"}>{attempt.isCorrect ? "✓" : "×"}</span>
        <span>{attempt.isCorrect ? "Acerto" : "Erro"}</span>
        <time>{new Date(attempt.answeredAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
      </div>) : <p className="r9-muted">As questões respondidas neste assunto aparecerão aqui.</p>}
    </section>}
  </div>;
}
