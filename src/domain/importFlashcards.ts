import type { FlashcardVariant, StudySubject } from "./study";

export interface ImportedFamily {
  subject: StudySubject;
  topic: string;
  source: string;
  variants: FlashcardVariant[];
}
const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => String(value ?? "").trim();
const id = () => globalThis.crypto?.randomUUID?.() ?? `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const allowedFormats = new Set(["basic", "cloze", "typed", "image"]);

export function normalizeImport(raw: unknown): ImportedFamily[] {
  const object = asObject(raw);
  const families = Array.isArray(raw)
    ? raw
    : Array.isArray(object.familias) ? object.familias
    : Array.isArray(object.concepts) ? object.concepts
    : Array.isArray(object.families) ? object.families
    : [];
  if (!families.length || families.length > 250) throw new Error("Arquivo sem famílias ou com mais de 250 famílias.");
  return families.map((value, familyIndex) => {
    const family = asObject(value);
    const cards = family.cartoes ?? family.variants ?? family.cards;
    const subjectText = text(family.disciplina ?? family.subject);
    const subject: StudySubject = /fis/i.test(subjectText) ? "fisica" : "tae";
    const topic = text(family.assunto ?? family.topic);
    if (!topic || !Array.isArray(cards) || cards.length < 1 || cards.length > 10) {
      throw new Error(`Família ${familyIndex + 1}: informe o assunto e de 1 a 10 versões.`);
    }
    const variants = cards.map((value, cardIndex): FlashcardVariant => {
      const card = asObject(value);
      const q = text(card.pergunta ?? card.q);
      const a = text(card.resposta ?? card.a);
      const rawFormat = text(card.formato ?? card.format) || "basic";
      const format = allowedFormats.has(rawFormat) ? rawFormat : "basic";
      if (!q || !a || q.length > 5000 || a.length > 5000) {
        throw new Error(`Família ${familyIndex + 1}, versão ${cardIndex + 1}: pergunta ou resposta inválida.`);
      }
      const imageValue = text(card.image);
      const image = /^data:image\/(png|jpeg|webp);base64,/i.test(imageValue) ? imageValue : "";
      const maskRaw = asObject(card.mask);
      const mask = card.mask && typeof card.mask === "object"
        ? { x: Number(maskRaw.x ?? 0), y: Number(maskRaw.y ?? 0), w: Number(maskRaw.w ?? 0), h: Number(maskRaw.h ?? 0) }
        : null;
      return {
        id: id(),
        kind: text(card.tipo ?? card.kind) || "Definição",
        format,
        q,
        a,
        reason: text(card.justificativa ?? card.reason),
        source: text(card.fonte ?? card.source),
        image,
        mask,
        status: "pending",
        uses: 0,
        passes: 0,
        failures: 0,
      };
    });
    return {
      subject,
      topic: topic.slice(0, 180),
      source: text(family.fonte ?? family.source),
      variants,
    };
  });
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
}
export function parseFlashcardCsv(input: string): ImportedFamily[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let buffer = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { buffer += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(buffer); buffer = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(buffer); buffer = "";
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
    } else buffer += char;
  }
  row.push(buffer);
  if (row.some(cell => cell.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("CSV sem registros. Use cabeçalhos e pelo menos uma versão.");
  const headers = rows[0].map(normalizeHeader);
  const get = (cells: string[], ...names: string[]) => {
    for (const name of names) {
      const index = headers.indexOf(normalizeHeader(name));
      if (index >= 0) return cells[index] || "";
    }
    return "";
  };
  const families = new Map<string, { subject: StudySubject; topic: string; source: string; variants: Array<Record<string, string>> }>();
  for (const cells of rows.slice(1)) {
    const subject: StudySubject = /fis/i.test(get(cells, "disciplina", "subject")) ? "fisica" : "tae";
    const topic = get(cells, "assunto", "topic").trim();
    if (!topic) continue;
    const key = `${subject}|${topic.toLocaleLowerCase()}`;
    const family = families.get(key) || { subject, topic, source: get(cells, "fonte", "source"), variants: [] };
    family.variants.push({
      q: get(cells, "pergunta", "q"),
      a: get(cells, "resposta", "a"),
      kind: get(cells, "tipo", "kind"),
      reason: get(cells, "justificativa", "reason"),
      format: get(cells, "formato", "format"),
      source: get(cells, "fonte", "source"),
    });
    families.set(key, family);
  }
  return normalizeImport([...families.values()]);
}

/** Human-readable interchange format. Heading boundaries and field order are deliberate. */
export const FLASHCARD_MARKDOWN_MODEL = [
  "# Baralho: Nome do baralho",
  "",
  "## Cartão 01",
  "**Assunto:** Nome específico do microconhecimento",
  "**Fonte:** Material fornecido",
  "",
  "### Frente",
  "Pergunta objetiva que faça sentido sozinha.",
  "",
  "### Verso",
  "Resposta curta e precisa, fiel ao material.",
].join("\n");
function parseRitmoFlashcardMarkdown(input:string,subject:StudySubject="tae"):ImportedFamily[]{
 let raw=input.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n").trim();
 const fence=raw.match(/^```(?:markdown|md)?[ \t]*\n([\s\S]*?)\n```[ \t]*$/i);
 if(fence)raw=fence[1].trim();
 const lines=raw.split("\n");
 if(!/^#\s+RITMO-FLASHCARDS\s+v1\s*$/i.test(lines.shift()||""))throw Error("Markdown: comece com # RITMO-FLASHCARDS v1.");
 const families:{subject:StudySubject;topic:string;source:string;variants:Record<string,string>[]}[]=[];
 let family:typeof families[number]|undefined,card:Record<string,string>|undefined,field="",familySourceSeen=false;
 const order=["tipo","formato","pergunta","resposta","justificativa","fonte"];
 function checkCard(){if(!card)return;for(const key of order)if(!(key in card)||!card[key].trim())throw Error("Markdown · "+family?.topic+": campo "+key+" ausente ou vazio.");if(!["basic","typed","cloze"].includes(card.formato))throw Error("Markdown: formato deve ser basic, typed ou cloze.");if(card.formato==="cloze"&&!/\{\{c\d+::[^}]+\}\}/.test(card.pergunta))throw Error("Markdown: lacuna deve usar {{c1::resposta}}.");}
 for(const original of lines){
  const line=original.trim();
  const fam=line.match(/^##\s+Família:\s*(.+)$/i);
  if(fam){checkCard();if(family&&!family.variants.length)throw Error("Markdown: família sem cartões.");family={subject,topic:fam[1].trim(),source:"",variants:[]};families.push(family);card=undefined;field="";familySourceSeen=false;continue;}
  const ver=line.match(/^###\s+Cartão\s+(\d+)\s*$/i);
  if(ver){checkCard();if(!family||!familySourceSeen)throw Error("Markdown: informe a fonte da família antes dos cartões.");if(Number(ver[1])!==family.variants.length+1)throw Error("Markdown: numere os cartões de 1 em diante dentro da família.");card={};family.variants.push(card);field="";continue;}
  if(line==="---"){checkCard();field="";continue;}
  const mark=line.match(/^\*\*(Fonte da família|Tipo|Formato|Pergunta|Resposta|Justificativa|Fonte):\*\*\s*(.*)$/i);
  if(mark){
   const key=mark[1].toLocaleLowerCase("pt-BR");
   if(key==="fonte da família"){if(!family||card||familySourceSeen)throw Error("Markdown: fonte da família fora de posição.");familySourceSeen=true;family.source=mark[2];field="family-source";continue;}
   if(!card||key!==order[Object.keys(card).length])throw Error("Markdown: campos fora de ordem ou repetidos: "+mark[1]+".");
   card[key]=mark[2];field=key;continue;
  }
  if(!line){if(card&&field)card[field]+="\n";else if(family&&field==="family-source")family.source+="\n";continue;}
  if(/^#{1,6}\s/.test(line)||/^\*\*[^*]+:\*\*/.test(line))throw Error("Markdown: marcador não reconhecido: "+line.slice(0,100));
  if(card&&field)card[field]+="\n"+original;
  else if(family&&field==="family-source")family.source+="\n"+original;
  else throw Error("Markdown: texto fora de um campo: "+line.slice(0,100));
 }
 checkCard();
 if(families.some(f=>!f.source.trim()||!f.variants.length))throw Error("Markdown: cada família precisa de fonte e cartões.");
 const parsed=normalizeImport(families);
 for(const f of parsed){const questions=f.variants.map(v=>v.q.toLocaleLowerCase().replace(/\s+/g," "));if(new Set(questions).size!==questions.length)throw Error("Markdown: perguntas repetidas em "+f.topic+".");}
 return parsed;
}
function unwrapFlashcardMarkdown(input: string) {
  let raw = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const fence = String.fromCharCode(96).repeat(3);
  if (raw.startsWith(fence) && raw.endsWith(fence)) {
    const firstBreak = raw.indexOf("\n");
    const closing = raw.lastIndexOf("\n" + fence);
    if (firstBreak >= 0 && closing > firstBreak) raw = raw.slice(firstBreak + 1, closing).trim();
  }
  return raw;
}

type SimpleDeckCard = {
  number: number;
  assunto: string;
  fonte: string;
  frente: string;
  verso: string;
};

function parseBaralhoMarkdown(input: string, subject: StudySubject): ImportedFamily[] {
  const raw = unwrapFlashcardMarkdown(input);
  const lines = raw.split("\n");
  const header = (lines.shift() || "").trim().replace(/\*\*$/, "").trim();
  if (!/^#\s*Baralho\s*:\s*\S/i.test(header)) {
    throw new Error("Markdown: comece com # Baralho: Nome do baralho.");
  }

  const cards: SimpleDeckCard[] = [];
  let current: SimpleDeckCard | undefined;
  let activeField: "frente" | "verso" | "" = "";

  function finishCard() {
    if (!current) return;
    current.assunto = current.assunto.trim();
    current.fonte = current.fonte.trim();
    current.frente = current.frente.trim();
    current.verso = current.verso.trim();
    if (!current.assunto || !current.fonte || !current.frente || !current.verso) {
      throw new Error("Markdown · Cartão " + String(current.number).padStart(2, "0") + ": preencha Assunto, Fonte, Frente e Verso.");
    }
    cards.push(current);
    current = undefined;
    activeField = "";
  }

  for (const original of lines) {
    const line = original.trim();
    if (!line) {
      if (current && activeField && current[activeField]) current[activeField] += "\n";
      continue;
    }
    if (line === "---") continue;

    // Tolerate headings copied with bold markers, but the prompt requests plain headings.
    const heading = line.replace(/^(#{2,3})\s+\*\*(.*?)\*\*\s*$/, "$1 $2");
    const cardHeading = heading.match(/^##\s+Cartão\s+0*(\d+)\s*$/i);
    if (cardHeading) {
      finishCard();
      const number = Number(cardHeading[1]);
      if (number !== cards.length + 1) {
        throw new Error("Markdown: numere os cartões em sequência, começando por Cartão 01.");
      }
      current = { number, assunto: "", fonte: "", frente: "", verso: "" };
      activeField = "";
      continue;
    }

    const section = heading.match(/^###\s+(Frente|Verso)\s*$/i);
    if (section) {
      if (!current) throw new Error("Markdown: cada seção Frente e Verso precisa estar dentro de um cartão.");
      if (section[1].toLowerCase() === "frente") {
        if (!current.assunto || !current.fonte || current.frente || current.verso) {
          throw new Error("Markdown: use Assunto e Fonte antes de ### Frente.");
        }
        activeField = "frente";
      } else {
        if (!current.frente.trim() || current.verso) {
          throw new Error("Markdown: preencha ### Frente antes de ### Verso.");
        }
        activeField = "verso";
      }
      continue;
    }

    const meta = line.match(/^\*\*(Assunto|Fonte):\*\*\s*(.*)$/i);
    if (meta) {
      if (!current || activeField) throw new Error("Markdown: Assunto e Fonte devem aparecer antes de Frente e Verso.");
      const value = meta[2].trim().replace(/\\$/, "").trim();
      if (meta[1].toLowerCase() === "assunto") {
        if (current.assunto || current.fonte) throw new Error("Markdown: informe Assunto uma única vez e antes de Fonte.");
        current.assunto = value;
      } else {
        if (!current.assunto || current.fonte) throw new Error("Markdown: informe Fonte depois de Assunto e apenas uma vez.");
        current.fonte = value;
      }
      continue;
    }

    if (/^#{1,6}\s/.test(heading)) {
      throw new Error("Markdown: título não reconhecido. Use ## Cartão 01, ### Frente e ### Verso.");
    }
    if (current && (activeField === "frente" || activeField === "verso")) {
      current[activeField] += (current[activeField] ? "\n" : "") + original;
      continue;
    }
    throw new Error("Markdown: texto fora de um cartão ou campo: " + line.slice(0, 100));
  }

  finishCard();
  if (!cards.length) {
    throw new Error("Markdown: nenhum cartão encontrado. Use ## Cartão 01, ### Frente e ### Verso.");
  }
  if (cards.length > 250) throw new Error("Markdown: o limite é de 250 cartões por importação.");

  const groups = new Map<string, { topic: string; cards: SimpleDeckCard[] }>();
  for (const card of cards) {
    const key = normalizeHeader(card.assunto);
    const group = groups.get(key) || { topic: card.assunto, cards: [] };
    group.cards.push(card);
    if (group.cards.length > 10) {
      throw new Error("Markdown · " + group.topic + ": use no máximo 10 cartões para o mesmo Assunto.");
    }
    groups.set(key, group);
  }

  const families = [...groups.values()].map(group => ({
    disciplina: subject,
    assunto: group.topic,
    fonte: [...new Set(group.cards.map(card => card.fonte))].join(" · "),
    cartoes: group.cards.map(card => ({
      tipo: "Revisão",
      formato: "basic",
      pergunta: card.frente,
      resposta: card.verso,
      fonte: card.fonte,
    })),
  }));
  const parsed = normalizeImport(families);
  for (const family of parsed) {
    const questions = family.variants.map(variant => variant.q.toLocaleLowerCase().replace(/\s+/g, " "));
    if (new Set(questions).size !== questions.length) {
      throw new Error("Markdown: perguntas repetidas em " + family.topic + ".");
    }
  }
  return parsed;
}

/** Accepts the compact front/back deck format and the previous RITMO-FLASHCARDS v1 format. */
export function parseFlashcardMarkdown(input: string, subject: StudySubject = "tae"): ImportedFamily[] {
  const raw = unwrapFlashcardMarkdown(input);
  const firstLine = (raw.split("\n")[0] || "").trim().replace(/\*\*$/, "").trim();
  if (/^#\s*Baralho\s*:/i.test(firstLine)) return parseBaralhoMarkdown(raw, subject);
  return parseRitmoFlashcardMarkdown(raw, subject);
}
