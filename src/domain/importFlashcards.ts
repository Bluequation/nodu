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
export const FLASHCARD_MARKDOWN_MODEL = `# RITMO-FLASHCARDS v1

## Família: Nome do microconhecimento
**Fonte da família:** Autor, título, artigo ou página verificável

### Cartão 1
**Tipo:** Definição
**Formato:** basic
**Pergunta:** Pergunta objetiva sobre o microconhecimento.
**Resposta:** Resposta correta sustentada pelo material.
**Justificativa:** Explique por que a resposta está correta.
**Fonte:** Referência específica do cartão.

---

## Família: Outro microconhecimento
**Fonte da família:** Referência verificável

### Cartão 1
**Tipo:** Aplicação
**Formato:** basic
**Pergunta:** Situação que exige aplicar o conceito.
**Resposta:** Resposta correta.
**Justificativa:** Fundamento da resposta.
**Fonte:** Referência específica.
`;
export function parseFlashcardMarkdown(input:string,subject:StudySubject="tae"):ImportedFamily[]{
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
