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
function buildCardPrompt(context:string,amount:number){
 return \`Você é especialista em aprendizagem ativa e elaboração de flashcards para concursos públicos.

CONTEXTO DO ESTUDO:
\${context}

QUANTIDADE:
Gere no máximo \${amount} cartões individuais. Nunca ultrapasse esse limite. Não aumente a quantidade artificialmente.

OBJETIVO:
Transformar o material de referência em cartões de recuperação ativa, claros e úteis para revisão espaçada de concurso público.

REGRAS DE CONTEÚDO:
1. Use prioritariamente e fielmente o material fornecido pelo estudante. Não complete lacunas com suposições ou conhecimento externo não solicitado.
2. Se o material for insuficiente, contraditório ou não sustentar uma informação, omita esse cartão. Não invente regras, dados, artigos, páginas, autores, exemplos ou referências.
3. Restrinja os cartões à disciplina, ao assunto e ao recorte do contexto. Não misture conteúdos de outras disciplinas.
4. Faça uma pergunta por cartão. A pergunta deve fazer sentido sozinha, mesmo fora da ordem original.
5. Escreva respostas curtas, precisas e suficientes. Inclua condição, exceção, unidade ou exemplo somente quando isso mudar a resposta.
6. Evite perguntas amplas, pistas na pergunta, duplicatas e cartões que cobrem a mesma informação com palavras diferentes.
7. Priorize distinções conceituais, condições de aplicação, exceções, relações, cálculos essenciais e confusões que possam levar a erro em prova.
8. Para cálculos, preserve as hipóteses, unidades e etapas indispensáveis. Não invente valores ou resultados.
9. Em cada cartão, informe o assunto específico e a fonte. Use página, seção, artigo ou identificação disponível. Se a fonte não tiver referência identificável, escreva exatamente: Material fornecido.
10. Não inclua agendamento, datas de revisão, dificuldade, tags ou comentários sobre o processo.

FORMATO DE SAÍDA — OBRIGATÓRIO:
Retorne somente Markdown puro. Não use bloco de código. Não escreva introdução, conclusão, observações ou qualquer texto fora dos cartões.

A estrutura deve ser copiada exatamente:
- Primeira linha: # Baralho: Nome do baralho
- Cada cartão começa com ## Cartão 01, ## Cartão 02, ## Cartão 03... em sequência, sempre com dois dígitos.
- Logo abaixo, escreva **Assunto:** e **Fonte:**, exatamente nessa ordem.
- Depois use os títulos ### Frente e ### Verso, exatamente como escritos.
- Os títulos ## Cartão, ### Frente e ### Verso NÃO podem estar em negrito.
- Os rótulos Assunto e Fonte devem estar em negrito, com dois asteriscos de cada lado.
- Não use outros campos. Não inclua Tipo, Formato, Justificativa ou Fonte da família.
- Não use tabelas, listas numeradas ou separadores horizontais entre cartões.
- Não coloque mais de 10 cartões com o mesmo valor em Assunto. Se necessário, use assuntos específicos diferentes, sem criar subdivisões artificiais.

MODELO EXATO:
# Baralho: Nome do baralho

## Cartão 01
**Assunto:** Nome específico do microconhecimento
**Fonte:** Material fornecido

### Frente
Uma pergunta objetiva que faça sentido sozinha?

### Verso
Resposta curta, precisa e sustentada pelo material.

## Cartão 02
**Assunto:** Outro microconhecimento
**Fonte:** Material fornecido

### Frente
Outra pergunta independente?

### Verso
Resposta correspondente, sem acrescentar informação não sustentada.

CONFERÊNCIA OBRIGATÓRIA ANTES DE RESPONDER:
- O primeiro título é # Baralho: ...
- Todos os cartões estão numerados em sequência, começando em 01.
- Cada cartão contém exatamente um Assunto, uma Fonte, uma Frente e um Verso.
- A ordem dos campos está correta.
- Não há negrito nos títulos dos cartões ou nas seções Frente e Verso.
- A quantidade total não ultrapassa \${amount}.
- A resposta contém somente o baralho em Markdown.

MATERIAL DE REFERÊNCIA:
O estudante anexará ou colará o material junto desta solicitação. Se nenhum material for fornecido, peça o material antes de gerar os cartões.\`;
}

export function ImportPage() {
  const navigate = useNavigate();
  const context=useStudyContext(),plans=useMaterialPlans(),[params]=useSearchParams();
  const [amount,setAmount]=useState(20);
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
    const prompt = buildCardPrompt(context.valid?`${context.plan?.title} · cargo ${context.plan?.position} · banca ${context.plan?.organizer||"não informada"} · ${context.area} · ${context.title}. Restrinja todas as famílias a este assunto do plano.`:"Estudo livre; fundamente em fontes confiáveis consultadas.",amount);
    try {
      await navigator.clipboard.writeText(prompt);
      setFeedback("Prompt copiado. Cole na IA externa, anexe o material e envie. Depois copie somente o Markdown gerado para a etapa 2.");
    } catch {
      downloadFile("solicitacao-flashcards-ritmo.txt", prompt, "text/plain;charset=utf-8");
      setFeedback("Não foi possível copiar; o prompt foi baixado em TXT.");
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
      <section className="panel wizard-panel"><div className="panel-title-row"><div><span className="step-kicker">1 · GERAR COM IA</span><h2>Preparar prompt</h2><p>Copie as instruções prontas. Na IA externa, anexe o material que deverá servir de fonte.</p></div></div>
        <div className="field-block"><label>Quantidade máxima de cartões</label><select aria-label="Quantidade de famílias" value={amount} onChange={e=>setAmount(Number(e.target.value))}>{[10,20,30,50].map(n=><option key={n} value={n}>{n}</option>)}</select></div>
        <button className="primary-button compact" type="button" disabled={invalid} onClick={copyPrompt}><Clipboard size={15}/>Copiar prompt para IA</button>
        <details className="rm-prompt-details"><summary>Ver prompt completo e formato obrigatório</summary><pre>{buildCardPrompt(context.valid?(context.plan?.title+" · "+context.title):"Estudo livre",amount)}</pre></details>
      </section>
      <section className="panel wizard-panel"><div className="panel-title-row"><div><span className="step-kicker">2 · IMPORTAR</span><h2>Trazer os cartões para o Ritmo</h2><p>Cole a resposta Markdown da IA ou selecione o arquivo gerado. O Ritmo confere a estrutura antes de importar.</p></div></div>
        <div className="field-block"><label htmlFor="import-file">Arquivo Markdown</label><div className="file-picker"><FileJson size={18}/><span>{fileName||"Selecione um arquivo .md ou .txt"}</span><label className="secondary-button compact" htmlFor="import-file">Procurar</label><input id="import-file" type="file" accept=".md,.markdown,.txt,.json,.csv,text/markdown,text/plain,application/json,text/csv" disabled={busy} onChange={handleFile}/></div></div>
        <div className="field-block"><label htmlFor="import-text">Ou cole a resposta da IA</label><textarea id="import-text" rows={5} value={input} disabled={busy} onChange={e=>{setInput(e.target.value);setFamilies([]);setError("");setFeedback("");}} placeholder="# Baralho: Nome do baralho"/></div>
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
