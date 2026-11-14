import { useEffect, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, Clipboard, Download, FileJson, FileSpreadsheet, ShieldCheck, Sparkles } from "lucide-react";
import type { Concept } from "../../domain/study";
import type { ImportedFamily } from "../../domain/importFlashcards";
import { normalizeImport, parseFlashcardCsv, parseFlashcardMarkdown, FLASHCARD_MARKDOWN_MODEL } from "../../domain/importFlashcards";
import { importConceptDrafts, listConcepts, saveConcept } from "../../data/study";
import { emptyFsrsState } from "../../domain/fsrs";
import {useStudyContext} from "./useStudyContext";
import {MaterialScopePicker,useMaterialPlans,materialLabel,materialRoute} from "./MaterialScopePicker";
import {linkedTo,linkedToPlan,topicUrl} from "../../domain/topicContext";
import "./materials.css";

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}
function buildCardPrompt(reference:string,context:string,amount:number){
 return `Você é especialista em aprendizagem ativa e elaboração de flashcards para concursos públicos.

CONTEXTO: ${context}
META: até ${amount} famílias, sem preencher quantidade artificialmente.

REGRAS OBRIGATÓRIAS:
1. Use exclusivamente o material de referência fornecido pelo estudante (inclusive anexos enviados separadamente). Não invente fatos, leis, artigos, páginas, autores, fontes ou estatísticas de incidência. Se não houver material suficiente, solicite-o antes de gerar o arquivo.
2. Cada família representa UM microconhecimento do assunto selecionado. Não misture conteúdos de outras áreas ou extrapole o edital. Use título curto e específico.
3. Crie de 2 a 10 cartões por família somente quando houver operações mentais genuinamente distintas; se só houver uma forma rigorosa, use uma. Não crie sinônimos da mesma pergunta.
4. Varie conforme o material: definição, diferenciação, comparação, identificação, competência, responsável, condição, prazo, exceção, consequência, aplicação e armadilha. Adapte ao estilo da banca se houver evidência, sem inventar questões anteriores.
5. Teste recuperação ativa: uma pergunta clara por cartão, sem pista da resposta, sem ambiguidade ou trivialidade. Resposta curta, precisa, suficiente; diferencie conceitos próximos e explique o raciocínio ou a pegadinha.
6. Legislação: preserve a norma e a redação da fonte; considere vigência e alterações apenas quando documentadas. Não confunda paráfrase com transcrição literal. Em Física e outras áreas, confira unidades, hipóteses e cálculos. Não fabrique exemplos que alterem a regra.
7. Inclua fonte verificável em cada família e cartão (documento + artigo, seção ou página quando disponível). Se faltar sustentação, omita o cartão. Não declare como verificada uma fonte que não consultou.
8. Faça revisão final de consistência: pergunta/resposta/justificativa/fonte; elimine duplicatas e contradições. Não aprove automaticamente: o estudante fará a curadoria.
9. Formatos permitidos: basic, typed, cloze (use {{c1::resposta}} apenas para termo decisivo). Sem imagens neste formato.
10. Retorne somente o Markdown estruturado abaixo, sem comentários externos, com cabeçalhos, campos em negrito e separadores --- entre famílias. Numere Cartão 1, Cartão 2 etc. de novo a cada família. Não copie os exemplos; substitua-os por conteúdo real. Pode usar várias linhas dentro de um campo.

MODELO OBRIGATÓRIO:
${FLASHCARD_MARKDOWN_MODEL}

MATERIAL DE REFERÊNCIA:
${reference||"O estudante anexará ou colará o material junto com esta solicitação."}`;
}

export function ImportPage() {
  const navigate = useNavigate();
  const context=useStudyContext(),plans=useMaterialPlans(),[params]=useSearchParams();
  const [amount,setAmount]=useState(20);
  const [reference, setReference] = useState("");
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [families, setFamilies] = useState<ImportedFamily[]>([]);
  const [existing, setExisting] = useState<Concept[]>([]);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { listConcepts().then(setExisting); }, []);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 12_000_000) { setError("O arquivo ultrapassa 12 MB."); return; }
    if (!/\.(md|markdown|txt|json|csv)$/i.test(file.name)) { setError("Use Markdown (.md), TXT, JSON ou CSV."); return; }
    setFileName(file.name);
    try{setInput(await file.text());}catch{setError("Não foi possível ler o arquivo.");return;}
    setFamilies([]); setError(""); setFeedback("Arquivo carregado. Clique em pré-visualizar para validar.");
    event.target.value = "";
  }
  async function copyPrompt() {
    if(params.get("plan")&&!context.valid){setError("Selecione o assunto do plano.");return;}
    const prompt = buildCardPrompt(reference,context.valid?`${context.plan?.title} · cargo ${context.plan?.position} · banca ${context.plan?.organizer||"não informada"} · ${context.area} · ${context.title}. Restrinja todas as famílias a este assunto do plano.`:"Estudo livre; use apenas o material fornecido.",amount);
    try {
      await navigator.clipboard.writeText(prompt);
      setFeedback("Solicitação copiada. Cole na IA externa e depois traga o Markdown de volta.");
    } catch {
      downloadFile("solicitacao-flashcards-ritmo.txt", prompt, "text/plain;charset=utf-8");
      setFeedback("Não foi possível copiar; a solicitação foi baixada em TXT.");
    }
  }
  function preview() {
    setError(""); setFeedback("");
    try {
      const trimmed = input.trim();
      if(params.get("plan")&&!context.valid)throw Error("Selecione um assunto válido do plano.");
      if (!trimmed) throw new Error("Escolha um arquivo ou cole o conteúdo Markdown.");
      const parsed = /^(?:#|```)/.test(trimmed)?parseFlashcardMarkdown(trimmed,/f[ií]sica/i.test(context.plan?.area||"")?"fisica":"tae"):trimmed.startsWith("{") || trimmed.startsWith("[")?normalizeImport(JSON.parse(trimmed)):parseFlashcardCsv(trimmed);
      setFamilies(parsed);
      const duplicateCount = parsed.filter(family => existing.some(item => item.subject === family.subject && item.topic.toLocaleLowerCase() === family.topic.toLocaleLowerCase())).length;
      setFeedback(`${parsed.length} família(s) validadas. ${duplicateCount ? `${duplicateCount} possível(is) duplicata(s) encontrada(s). Confira antes de importar.` : "Nenhuma duplicata exata encontrada."}`);
    } catch (reason) {
      setFamilies([]);
      setError(reason instanceof Error ? reason.message : "Não consegui interpretar o arquivo.");
    }
  }
  async function importDrafts() {
    if (!families.length || busy) return;
    if(params.get("plan")&&!context.valid){setError("Selecione um assunto válido.");return;}
    if(families.some(f=>existing.some(c=>c.topic.toLocaleLowerCase()===f.topic.toLocaleLowerCase()&&(context.valid?linkedTo(c,context.ref):!c.planTopics?.length)))&&!window.confirm("Há famílias com o mesmo nome. Importar mesmo assim?"))return;
    setBusy(true); setError("");
    try {
      await importConceptDrafts(families,context.valid?context.ref:undefined);
      setFamilies([]);
      setInput("");
      navigate(context.valid?topicUrl("/curation",context.ref,context.date):"/curation");
    } catch {
      setError("Não foi possível importar o lote. Tente novamente.");
      setBusy(false);
    }
  }

  const invalid=!!params.get("plan")&&!context.valid;
  return <div className="stack ritmo-materials rm-import">
    <header className="heading"><div><small>RITMO / FLASHCARDS</small><h1>Adicionar flashcards</h1></div><Link className="secondary-button" to={materialRoute("/flashcards",params)}>Voltar</Link></header>
    <div className="rm-toolbar"><div className="rm-tabs"><button type="button" aria-pressed="true">Importar</button><Link to={materialRoute("/flashcards/new",params)+(params.get("plan")||params.get("date")?"&":"?")+"return=import"}>Manual</Link><button type="button" disabled title="Disponível quando houver integração com API"><Sparkles size={13}/> Gerar com IA</button></div><MaterialScopePicker plans={plans} creation disabled={busy} onChange={()=>{setFamilies([]);setFeedback("");setError("");}}/></div>
    <p className="rm-scope-hint">{invalid?"Escolha um assunto para vincular os cartões.":context.valid?"Destino do lote: "+context.plan?.title+" · "+context.title+". Todas as famílias serão vinculadas a este assunto.":"Destino: estudo livre, sem vínculo com um plano."} Importe um assunto por lote.</p>
    <div className="rm-import-layout">
      <section className="panel wizard-panel"><div className="panel-title-row"><div><span className="step-kicker">1 · IA EXTERNA</span><h2>Preparar solicitação</h2><p>Copie o prompt e envie junto com seu material de referência.</p></div></div>
        <div className="field-block"><label>Quantidade de famílias (até)</label><select aria-label="Quantidade de famílias" value={amount} onChange={e=>setAmount(Number(e.target.value))}>{[10,20,30,50].map(n=><option key={n} value={n}>{n}</option>)}</select></div>
        <div className="field-block"><label htmlFor="flashcard-reference">Material de referência (opcional)</label><textarea id="flashcard-reference" rows={3} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Cole aqui ou envie o material diretamente à IA externa."/></div>
        <button className="primary-button compact" type="button" disabled={invalid} onClick={copyPrompt}><Clipboard size={15}/>Copiar solicitação</button>
        <details className="rm-prompt-details"><summary>Critérios e formato do prompt</summary><pre>{buildCardPrompt("",context.valid?(context.plan?.title+" · "+context.title):"Estudo livre",amount)}</pre></details>
      </section>
      <section className="panel wizard-panel"><div className="panel-title-row"><div><span className="step-kicker">2 · IMPORTAR</span><h2>Adicionar arquivo ou texto</h2><p>Markdown é o formato principal. JSON e CSV continuam compatíveis.</p></div></div>
        <div className="field-block"><label htmlFor="import-file">Arquivo Markdown</label><div className="file-picker"><FileJson size={18}/><span>{fileName||"Selecione um arquivo .md ou .txt"}</span><label className="secondary-button compact" htmlFor="import-file">Procurar</label><input id="import-file" type="file" accept=".md,.markdown,.txt,.json,.csv,text/markdown,text/plain,application/json,text/csv" disabled={busy} onChange={handleFile}/></div></div>
        <div className="field-block"><label htmlFor="import-text">Ou cole a resposta da IA</label><textarea id="import-text" rows={5} value={input} disabled={busy} onChange={e=>{setInput(e.target.value);setFamilies([]);setError("");setFeedback("");}} placeholder="# RITMO-FLASHCARDS v1"/></div>
        <div className="button-row"><button className="primary-button compact" type="button" disabled={invalid||busy} onClick={preview}>Pré-visualizar e validar <ArrowRight size={15}/></button><button className="text-button" type="button" onClick={()=>downloadFile("modelo-flashcards-ritmo.md",FLASHCARD_MARKDOWN_MODEL,"text/markdown;charset=utf-8")}><Download size={14}/>Modelo Markdown</button></div>
      </section>
    </div>
    {error&&<p className="inline-feedback" role="alert">{error}</p>}{feedback&&<p className="inline-feedback" role="status">{feedback}</p>}
    {families.length>0&&<section className="panel import-preview"><div className="panel-head"><h2>Pré-visualização</h2><span>{families.length} famílias · {families.reduce((n,f)=>n+f.variants.length,0)} cartões</span></div><p className="rm-scope-hint">Destino: {context.valid?context.plan?.title+" · "+context.title:"Estudo livre"}. Confira antes de importar.</p>{families.map((family,index)=><article className="import-preview-row" key={index}><div><strong>{family.topic}</strong><small>{family.source||"Fonte não informada"}</small></div><span>{family.variants.length} versões</span></article>)}<p className="rm-scope-hint">Validação de estrutura não verifica a exatidão factual. Os cartões entram como rascunhos para curadoria.</p><div className="form-actions"><button className="secondary-button compact" type="button" disabled={busy} onClick={()=>setFamilies([])}>Descartar prévia</button><button className="primary-button compact" type="button" disabled={busy||invalid} onClick={importDrafts}>{busy?"Importando…":"Importar para Curadoria"} <ArrowRight size={15}/></button></div></section>}
  </div>;
}

export function CurationPage() {
  const context=useStudyContext(),plans=useMaterialPlans(),[params]=useSearchParams();
  const route=(path:string)=>context.valid?topicUrl(path,context.ref,context.date):params.get("plan")?path+"?plan="+encodeURIComponent(params.get("plan")!):path;
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [expanded, setExpanded] = useState("");
  const [feedback, setFeedback] = useState("");
  const navigate = useNavigate();
  async function reload() { setConcepts(await listConcepts()); }
  useEffect(() => { reload(); }, []);
  const selectedPlan=plans.find(p=>p.id===params.get("plan"));
  const drafts = concepts.filter(concept => concept.status === "draft"&&(context.requested?context.valid&&linkedTo(concept,context.ref):params.get("plan")?!!selectedPlan&&linkedToPlan(concept,selectedPlan):true));
  async function changeVariant(concept: Concept, index: number, status: "approved" | "rejected") {
    const variants = concept.variants.map((variant, variantIndex) => variantIndex === index ? { ...variant, status } : variant);
    await saveConcept({ ...concept, variants });
    await reload();
  }
  async function publish(concept: Concept) {
    const approved = concept.variants.filter(variant => variant.status === "approved");
    if (!approved.length) { setFeedback(`${concept.topic}: aprove ao menos uma versão.`); return; }
    if (approved.some(variant => !variant.source.trim() && !concept.source.trim())) { setFeedback(`${concept.topic}: informe uma fonte para cada versão aprovada ou para a família.`); return; }
    if (approved.some(variant => variant.format === "image" && !variant.image.trim())) { setFeedback(`${concept.topic}: há versão de imagem sem imagem.`); return; }
    if (approved.some(variant => variant.format === "cloze" && !/\{\{c\d+::[^}]+\}\}/.test(variant.q))) { setFeedback(`${concept.topic}: uma lacuna não usa o formato {{c1::resposta}}.`); return; }
    const normalized = approved.map(variant => variant.q.trim().toLocaleLowerCase().replace(/\s+/g, " "));
    if (new Set(normalized).size !== normalized.length) { setFeedback(`${concept.topic}: existem perguntas repetidas entre as versões aprovadas.`); return; }
    await saveConcept({ ...concept, variants: approved, status: "published", fsrs: emptyFsrsState() });
    setFeedback(`Família “${concept.topic}” publicada e pronta para revisão.`);
    await reload();
  }
  return <div className="stack ritmo-materials">
    <header className="heading"><div><small>RITMO / CONTEÚDOS</small><h1>Curadoria</h1><p>Confira cada versão, fonte e justificativa. Só famílias aprovadas entram na revisão espaçada.</p></div><Link className="primary-button" to={route("/import")}><Sparkles size={15}/>Importar cartões</Link></header>
    <div className="rm-toolbar"><MaterialScopePicker plans={plans}/><Link className="secondary-button compact" to={route("/flashcards")}>Minha coleção</Link>{context.valid&&<Link to={context.returnTo}>Voltar a Aprender</Link>}</div>
    {feedback && <p className="inline-feedback" role="status">{feedback}</p>}
    <section className="panel">
      <div className="panel-head"><h2>Aguardando conferência</h2><span className="soft-tag">{drafts.length} família(s)</span></div>
      {drafts.length ? <div className="curation-list">{drafts.map(concept => <article className="curation-card" key={concept.id}>
        <div className="curation-card-head"><div><span className="subject-pill">{concept.planTopics?.map(ref=>materialLabel(plans,ref)).filter(Boolean).map(label=>label!.title).join(" · ")||"Estudo livre"}</span><h3>{concept.topic}</h3><p>{concept.source || "Fonte da família não informada"}</p></div><div className="curation-actions"><span className="soft-tag">{concept.variants.filter(variant => variant.status === "approved").length}/{concept.variants.length} aprovadas</span><button className="secondary-button compact" onClick={() => navigate((context.valid?topicUrl(`/flashcards/${concept.id}/edit`,context.ref,context.date):`/flashcards/${concept.id}/edit`)+(context.valid?"&":"?")+"return=curation")}>Editar família</button><button className="primary-button compact" onClick={() => publish(concept)}>Publicar</button></div></div>
        <button className="text-button" type="button" onClick={() => setExpanded(expanded === concept.id ? "" : concept.id)}>{expanded === concept.id ? "Recolher versões" : "Conferir versões"}</button>
        {expanded === concept.id && <div className="curation-variants">{concept.variants.map((variant, index) => <article className="curation-variant" key={variant.id}>
          <div className="curation-variant-head"><span>VERSÃO {index + 1} · {variant.kind} · {variant.format}</span><span className={`status-pill ${variant.status === "approved" ? "active" : variant.status === "rejected" ? "due" : "draft"}`}>{variant.status === "approved" ? "Aprovada" : variant.status === "rejected" ? "Rejeitada" : "Pendente"}</span></div>
          <strong>{variant.q}</strong><p>Resposta: {variant.a}</p>{variant.reason && <small>Justificativa: {variant.reason}</small>}<small>Fonte: {variant.source || concept.source || "Não informada"}</small>
          <div className="button-row"><button className="secondary-button compact" onClick={() => navigate((context.valid?topicUrl(`/flashcards/${concept.id}/edit`,context.ref,context.date):`/flashcards/${concept.id}/edit`)+(context.valid?"&":"?")+"return=curation")}>Editar</button><button className="secondary-button compact" onClick={() => changeVariant(concept, index, "approved")}><Check size={13}/>Aprovar</button><button className="text-button" onClick={() => changeVariant(concept, index, "rejected")}>Rejeitar</button></div>
        </article>)}</div>}
      </article>)}</div> : <div className="empty-state"><ShieldCheck size={28}/><strong>Nenhuma família aguardando curadoria</strong><span>Cartões importados ou criados como rascunho aparecerão aqui para conferência.</span><Link className="primary-button" to={route("/import")}>Importar cartões</Link></div>}
    </section>
  </div>;
}
