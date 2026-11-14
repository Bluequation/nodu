import { describe, expect, it } from "vitest";
import { normalizeImport, parseFlashcardCsv } from "./importFlashcards";

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
