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
