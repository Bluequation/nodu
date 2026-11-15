import { describe, expect, it } from "vitest";
import { normalizeImport, parseFlashcardCsv, parseFlashcardMarkdown, FLASHCARD_MARKDOWN_MODEL } from "./importFlashcards";

const compactDeck = [
  "# Baralho: Leis de Newton — Dinâmica",
  "",
  "## Cartão 01",
  "**Assunto:** Primeira Lei de Newton — Lei da Inércia",
  "**Fonte:** Material fornecido",
  "",
  "### Frente",
  "O que estabelece a Primeira Lei de Newton?",
  "",
  "### Verso",
  "Um corpo mantém seu estado de repouso ou movimento retilíneo uniforme se a força resultante for nula.",
  "",
  "## Cartão 02",
  "**Assunto:** Segunda Lei de Newton — Princípio Fundamental da Dinâmica",
  "**Fonte:** Material fornecido",
  "",
  "### Frente",
  "Qual é a relação matemática estabelecida pela Segunda Lei de Newton?",
  "",
  "### Verso",
  "A força resultante é igual ao produto da massa pela aceleração: F = m · a.",
].join("\n");

const legacyDeck = [
  "# RITMO-FLASHCARDS v1",
  "",
  "## Família: Energia cinética",
  "**Fonte da família:** Material fornecido",
  "",
  "### Cartão 1",
  "**Tipo:** Definição",
  "**Formato:** basic",
  "**Pergunta:** O que é energia cinética?",
  "**Resposta:** Energia associada ao movimento.",
  "**Justificativa:** Depende do movimento do corpo.",
  "**Fonte:** Material fornecido",
].join("\n");

describe("importação de flashcards", () => {
  it("aceita o formato legado e mantém versões pendentes para curadoria", () => {
    const families = normalizeImport({
      formato: "ritmo-flashcards-v1",
      familias: [{
        disciplina: "fisica",
        assunto: "Energia",
        fonte: "Edital",
        cartoes: [
          { tipo: "Comparação", formato: "basic", pergunta: "Compare energia cinética e potencial.", resposta: "A cinética depende do movimento; a potencial, da posição." },
          { tipo: "Lei seca", formato: "cloze", pergunta: "A energia mecânica é a soma de {{c1::cinética}} e potencial.", resposta: "cinética" },
        ],
      }],
    });
    expect(families).toHaveLength(1);
    expect(families[0].subject).toBe("fisica");
    expect(families[0].variants).toHaveLength(2);
    expect(families[0].variants.every(variant => variant.status === "pending")).toBe(true);
  });

  it("agrupa CSV por área e assunto e respeita campos entre aspas", () => {
    const csv = 'disciplina,assunto,tipo,pergunta,resposta,fonte\nTAE,"Lei, artigo 1",Comparação,"O que a lei define?","Define o objeto.","Lei X"\nTAE,"Lei, artigo 1",Lei seca,"Qual é a condição?","A condição é expressa.","Lei X"';
    const families = parseFlashcardCsv(csv);
    expect(families).toHaveLength(1);
    expect(families[0].topic).toBe("Lei, artigo 1");
    expect(families[0].variants).toHaveLength(2);
  });

  it("rejeita famílias com mais de dez versões", () => {
    const cards = Array.from({ length: 11 }, (_, index) => ({ q: `Pergunta ${index}`, a: "Resposta" }));
    expect(() => normalizeImport([{ subject: "tae", topic: "Tema", variants: cards }])).toThrow("1 a 10");
  });

  it("rejeita pergunta ou resposta vazia", () => {
    expect(() => normalizeImport([{ subject: "tae", topic: "Tema", variants: [{ q: "", a: "Resposta" }] }])).toThrow("pergunta ou resposta");
  });
});

describe("Markdown de flashcards", () => {
  it("importa o formato simples de baralho e agrupa cartões pelo Assunto", () => {
    const families = parseFlashcardMarkdown(compactDeck, "fisica");
    expect(families).toHaveLength(2);
    expect(families[0].subject).toBe("fisica");
    expect(families[0].topic).toBe("Primeira Lei de Newton — Lei da Inércia");
    expect(families[0].variants[0].q).toBe("O que estabelece a Primeira Lei de Newton?");
    expect(families[0].variants[0].a).toContain("movimento retilíneo uniforme");
    expect(families[0].variants[0].status).toBe("pending");
    expect(families[0].variants[0].source).toBe("Material fornecido");
  });

  it("aceita cercas, títulos em negrito e conteúdo com várias linhas", () => {
    const adjusted = compactDeck
      .replace("## Cartão 01", "## **Cartão 01**")
      .replace("### Frente", "### **Frente**")
      .replace("### Verso", "### **Verso**")
      .replace("O que estabelece a Primeira Lei de Newton?", "O que estabelece a Primeira Lei de Newton?\nConsidere a força resultante.");
    const fence = String.fromCharCode(96).repeat(3);
    const families = parseFlashcardMarkdown(fence + "markdown\n" + adjusted + "\n" + fence, "fisica");
    expect(families[0].variants[0].q).toContain("Considere a força resultante.");
  });

  it("rejeita fonte ausente, numeração fora de sequência e cartão incompleto", () => {
    expect(() => parseFlashcardMarkdown(compactDeck.replace("**Fonte:** Material fornecido\n", ""), "fisica")).toThrow("Assunto, Fonte, Frente e Verso");
    expect(() => parseFlashcardMarkdown(compactDeck.replace("## Cartão 02", "## Cartão 03"), "fisica")).toThrow("em sequência");
    expect(() => parseFlashcardMarkdown(compactDeck.replace("### Verso\nA força resultante é igual ao produto da massa pela aceleração: F = m · a.", ""), "fisica")).toThrow();
  });

  it("continua aceitando o formato RITMO-FLASHCARDS v1 anterior", () => {
    const families = parseFlashcardMarkdown(legacyDeck, "fisica");
    expect(families).toHaveLength(1);
    expect(families[0].topic).toBe("Energia cinética");
    expect(families[0].variants[0].a).toBe("Energia associada ao movimento.");
  });

  it("fornece um modelo pronto que o próprio importador consegue ler", () => {
    const families = parseFlashcardMarkdown(FLASHCARD_MARKDOWN_MODEL, "fisica");
    expect(families.length).toBeGreaterThan(0);
    expect(families[0].variants[0].status).toBe("pending");
  });
});
