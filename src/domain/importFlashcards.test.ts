import { describe, expect, it } from "vitest";
import { normalizeImport, parseFlashcardCsv, parseFlashcardMarkdown, FLASHCARD_MARKDOWN_MODEL } from "./importFlashcards";

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

describe("Markdown de flashcards",()=>{
 it("importa modelo legível, separadores, múltiplas famílias e mantém pendentes",()=>{const fs=parseFlashcardMarkdown(FLASHCARD_MARKDOWN_MODEL,"fisica");expect(fs).toHaveLength(2);expect(fs[0].subject).toBe("fisica");expect(fs[0].variants[0].status).toBe("pending");expect(fs[0].variants[0].a).toContain("Resposta correta");});
 it("aceita cercas e campos com várias linhas",()=>{const raw=FLASHCARD_MARKDOWN_MODEL.replace("Pergunta objetiva sobre o microconhecimento.","Pergunta?\n- Item A\n- Item B");expect(parseFlashcardMarkdown("```markdown\n"+raw+"\n```")[0].variants[0].q).toContain("- Item B");});
 it("rejeita ausência de fonte, campos fora de ordem, questões duplicadas e formatos inválidos",()=>{expect(()=>parseFlashcardMarkdown(FLASHCARD_MARKDOWN_MODEL.replace("**Fonte:** Referência específica do cartão.",""))).toThrow();expect(()=>parseFlashcardMarkdown(FLASHCARD_MARKDOWN_MODEL.replace("**Formato:** basic","**Formato:** desconhecido"))).toThrow();expect(()=>parseFlashcardMarkdown(FLASHCARD_MARKDOWN_MODEL.replace("**Resposta:**","**Pergunta:**"))).toThrow();});
});
