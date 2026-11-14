import { useEffect, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Clipboard, Download, FileJson, FileSpreadsheet, ShieldCheck, Sparkles } from "lucide-react";
import type { Concept } from "../../domain/study";
import type { ImportedFamily } from "../../domain/importFlashcards";
import { normalizeImport, parseFlashcardCsv } from "../../domain/importFlashcards";
import { createConcept, listConcepts, saveConcept } from "../../data/study";
import { emptyFsrsState } from "../../domain/fsrs";

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}
function buildCardPrompt(reference: string) {
  const template = `Você é especialista em elaboração de flashcards para concursos públicos. Crie famílias de cartões com alto rigor conceitual, usando SOMENTE o material de referência abaixo.

REGRAS DE QUALIDADE:
1. Uma família deve cobrar um microconhecimento específico, não um capítulo inteiro.
2. Crie de 2 a 10 versões por família. Cada versão deve cobrar o mesmo conhecimento por uma operação mental realmente diferente.
3. Varie os comandos: definir, diferenciar, comparar, identificar, explicar, apontar quem faz, a quem compete, quando ocorre, condições, prazos, exceções e consequências — conforme o conteúdo permitir.
4. Em legislação, respeite a redação literal. Explore trocas de uma única palavra que mudem o sentido, mas explique exatamente a diferença. Não invente redação, artigo, inciso ou competência.
5. Evite perguntas triviais, vagas, ambíguas, de mera associação superficial ou cuja resposta esteja contida na própria pergunta.
6. Respostas objetivas, mas suficientes para corrigir o raciocínio. Inclua justificativa e fonte sempre que o material permitir.
7. Se a referência não sustentar uma resposta, não crie o cartão. Sinalize que não há base suficiente.
8. Não repita a mesma pergunta com sinônimos. Alterne o tipo de raciocínio, não apenas a frase.
9. Use formato "basic" normalmente; "cloze" apenas quando a lacuna testar um termo decisivo; "typed" quando exigir resposta construída. Use "image" somente se a imagem estiver presente no material.
10. Retorne somente JSON válido, sem cercas de código e sem explicações.

FORMATO OBRIGATÓRIO:
{
  "formato": "ritmo-flashcards-v1",
  "familias": [
    {
      "disciplina": "tae ou fisica",
      "assunto": "nome do microconhecimento",
      "fonte": "referência verificável",
      "cartoes": [
        {
          "tipo": "Definição, Diferenciação, Comparação, Identificação, Competência, Condição, Exceção, Lei seca ou Aplicação",
          "formato": "basic",
          "pergunta": "pergunta clara e não trivial",
          "resposta": "resposta correta",
          "justificativa": "por que a resposta está correta e qual distinção importa",
          "fonte": "artigo, item ou página"
        }
      ]
    }
  ]
}

MATERIAL DE REFERÊNCIA:
__MATERIAL__

Se o material estiver incompleto, não complete com conhecimento externo. Priorize a precisão à quantidade de cartões.`;
  return template.replace("__MATERIAL__", reference.slice(0, 100000));
}

export function ImportPage() {
  const navigate = useNavigate();
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
    if (!/\.(json|csv)$/i.test(file.name)) { setError("Use um arquivo JSON ou CSV."); return; }
    setFileName(file.name);
    setInput(await file.text());
    setFamilies([]); setError(""); setFeedback("Arquivo carregado. Clique em pré-visualizar para validar.");
    event.target.value = "";
  }
  async function copyPrompt() {
    const prompt = buildCardPrompt(reference);
    try {
      await navigator.clipboard.writeText(prompt);
      setFeedback("Solicitação copiada. Cole no ChatGPT e depois traga o JSON de volta.");
    } catch {
      downloadFile("solicitacao-flashcards-ritmo.txt", prompt, "text/plain;charset=utf-8");
      setFeedback("Não foi possível copiar; a solicitação foi baixada em TXT.");
    }
  }
  function preview() {
    setError(""); setFeedback("");
    try {
      const trimmed = input.trim();
      if (!trimmed) throw new Error("Escolha um arquivo ou cole o conteúdo JSON/CSV.");
      const parsed = trimmed.startsWith("{") || trimmed.startsWith("[")
        ? normalizeImport(JSON.parse(trimmed))
        : parseFlashcardCsv(trimmed);
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
    setBusy(true); setError("");
    try {
      for (const family of families) {
        await createConcept({ subject: family.subject, topic: family.topic, source: family.source }, family.variants, "draft");
      }
      setFamilies([]);
      setInput("");
      navigate("/curation");
    } catch {
      setError("A importação foi interrompida. As famílias já salvas continuam como rascunhos na Curadoria.");
      setBusy(false);
    }
  }

  return <div className="stack">
    <header className="heading"><div><small>RITMO / CONTEÚDOS</small><h1>Importar flashcards</h1><p>Crie cartões com IA fora do app ou importe arquivos. Tudo entra como rascunho para sua conferência.</p></div><Link className="secondary-button" to="/flashcards">Flashcards</Link></header>
    <section className="panel wizard-panel">
      <div className="panel-title-row"><div><span className="step-kicker">ETAPA 1 · MATERIAL</span><h2>Prepare uma boa solicitação</h2><p>Forneça o texto que será a única base factual para a criação dos cartões.</p></div><span className="soft-tag"><ShieldCheck size={14}/> Sem API</span></div>
      <div className="field-block"><label htmlFor="flashcard-reference">Material de referência (opcional)</label><textarea id="flashcard-reference" rows={7} value={reference} onChange={event => setReference(event.target.value)} placeholder="Cole um trecho de lei, resumo, material de aula ou conteúdo que você já estudou. Você também pode deixar em branco e enviar o material separadamente à IA."/></div>
      <div className="ai-instructions"><div className="ai-instruction-heading"><Sparkles size={17}/> Prompt com critérios de qualidade</div><p>O pedido orienta a IA a criar famílias pequenas, variar operações mentais, respeitar a lei seca e não inventar informações. Você continua responsável por conferir as fontes e respostas.</p><button className="primary-button" type="button" onClick={copyPrompt}><Clipboard size={15}/>Copiar solicitação para IA</button></div>
    </section>
    <section className="panel wizard-panel">
      <div className="panel-title-row"><div><span className="step-kicker">ETAPA 2 · IMPORTAÇÃO</span><h2>Traga as famílias para o Ritmo</h2><p>O importador aceita JSON no formato Ritmo e CSV com uma linha por versão.</p></div><span className="soft-tag">Até 250 famílias · 10 versões cada</span></div>
      <div className="field-block"><label htmlFor="import-file">Arquivo JSON ou CSV</label><div className="file-picker"><FileJson size={18}/><span>{fileName || "Escolha o arquivo gerado pela IA"}</span><label className="secondary-button" htmlFor="import-file">Procurar</label><input id="import-file" type="file" accept=".json,.csv,application/json,text/csv" onChange={handleFile}/></div></div>
      <div className="field-block"><label htmlFor="import-text">Ou cole o JSON / CSV</label><textarea id="import-text" rows={9} value={input} onChange={event => { setInput(event.target.value); setFamilies([]); }} placeholder='Cole o JSON com "formato": "ritmo-flashcards-v1" e a lista "familias".'/></div>
      <div className="button-row"><button className="primary-button" type="button" onClick={preview}>Pré-visualizar e validar <ArrowRight size={15}/></button><button className="secondary-button" type="button" onClick={() => downloadFile("modelo-flashcards-ritmo.json", JSON.stringify({ formato: "ritmo-flashcards-v1", familias: [{ disciplina: "tae", assunto: "Nome do microconhecimento", fonte: "Lei/artigo/página", cartoes: [{ tipo: "Diferenciação", formato: "basic", pergunta: "Qual é a diferença entre X e Y?", resposta: "…", justificativa: "…", fonte: "…" }] }] }, null, 2), "application/json")}><Download size={14}/>Baixar modelo JSON</button><button className="text-button" type="button" onClick={() => downloadFile("modelo-flashcards-ritmo.csv", "disciplina,assunto,tipo,formato,pergunta,resposta,justificativa,fonte\ntae,Nome do assunto,Comparação,basic,Compare X e Y.,Resposta objetiva.,Explique a distinção.,Lei ou página\n", "text/csv;charset=utf-8")}><FileSpreadsheet size={14}/>Modelo CSV</button></div>
      {error && <p className="inline-feedback" role="alert">{error}</p>}
      {feedback && <p className="inline-feedback" role="status">{feedback}</p>}
      {families.length > 0 && <div className="import-preview">
        <div className="panel-head"><h2>Pré-visualização</h2><span className="soft-tag">{families.length} família(s)</span></div>
        {families.map((family, index) => <article className="import-preview-row" key={`${family.subject}-${family.topic}-${index}`}><div><span className="subject-pill">{family.subject === "tae" ? "TAE" : "Física"}</span><strong>{family.topic}</strong><small>{family.source || "Fonte não informada"}</small></div><span>{family.variants.length} versão(ões)</span></article>)}
        <div className="note-strip">As famílias serão importadas como rascunhos. Nenhuma entra na fila FSRS antes de ser conferida e publicada na Curadoria.</div>
        <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setFamilies([])}>Descartar prévia</button><button className="primary-button" type="button" disabled={busy} onClick={importDrafts}>{busy ? "Importando…" : "Importar para Curadoria"} <ArrowRight size={15}/></button></div>
      </div>}
    </section>
  </div>;
}

export function CurationPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [expanded, setExpanded] = useState("");
  const [feedback, setFeedback] = useState("");
  const navigate = useNavigate();
  async function reload() { setConcepts(await listConcepts()); }
  useEffect(() => { reload(); }, []);
  const drafts = concepts.filter(concept => concept.status === "draft");
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
  return <div className="stack">
    <header className="heading"><div><small>RITMO / CONTEÚDOS</small><h1>Curadoria</h1><p>Confira cada versão, fonte e justificativa. Só famílias aprovadas entram na revisão espaçada.</p></div><Link className="primary-button" to="/import"><Sparkles size={15}/>Importar cartões</Link></header>
    {feedback && <p className="inline-feedback" role="status">{feedback}</p>}
    <section className="panel">
      <div className="panel-head"><h2>Aguardando conferência</h2><span className="soft-tag">{drafts.length} família(s)</span></div>
      {drafts.length ? <div className="curation-list">{drafts.map(concept => <article className="curation-card" key={concept.id}>
        <div className="curation-card-head"><div><span className="subject-pill">{concept.subject === "tae" ? "TAE" : "Física"}</span><h3>{concept.topic}</h3><p>{concept.source || "Fonte da família não informada"}</p></div><div className="curation-actions"><span className="soft-tag">{concept.variants.filter(variant => variant.status === "approved").length}/{concept.variants.length} aprovadas</span><button className="secondary-button compact" onClick={() => navigate(`/flashcards/${concept.id}/edit`)}>Editar família</button><button className="primary-button compact" onClick={() => publish(concept)}>Publicar</button></div></div>
        <button className="text-button" type="button" onClick={() => setExpanded(expanded === concept.id ? "" : concept.id)}>{expanded === concept.id ? "Recolher versões" : "Conferir versões"}</button>
        {expanded === concept.id && <div className="curation-variants">{concept.variants.map((variant, index) => <article className="curation-variant" key={variant.id}>
          <div className="curation-variant-head"><span>VERSÃO {index + 1} · {variant.kind} · {variant.format}</span><span className={`status-pill ${variant.status === "approved" ? "active" : variant.status === "rejected" ? "due" : "draft"}`}>{variant.status === "approved" ? "Aprovada" : variant.status === "rejected" ? "Rejeitada" : "Pendente"}</span></div>
          <strong>{variant.q}</strong><p>Resposta: {variant.a}</p>{variant.reason && <small>Justificativa: {variant.reason}</small>}<small>Fonte: {variant.source || concept.source || "Não informada"}</small>
          <div className="button-row"><button className="secondary-button compact" onClick={() => navigate(`/flashcards/${concept.id}/edit`)}>Editar</button><button className="secondary-button compact" onClick={() => changeVariant(concept, index, "approved")}><Check size={13}/>Aprovar</button><button className="text-button" onClick={() => changeVariant(concept, index, "rejected")}>Rejeitar</button></div>
        </article>)}</div>}
      </article>)}</div> : <div className="empty-state"><ShieldCheck size={28}/><strong>Nenhuma família aguardando curadoria</strong><span>Cartões importados ou criados como rascunho aparecerão aqui para conferência.</span><Link className="primary-button" to="/import">Importar cartões</Link></div>}
    </section>
  </div>;
}
