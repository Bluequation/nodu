import { describe, expect, it } from "vitest";
import { migrateLegacy, migrateLegacyPlan, normalizeLegacyConcept, normalizeLegacyError, validateLegacy } from "./migration";

const fixture = (version = 7) => ({
  version,
  concepts: [{ id: "c1" }],
  reviews: [{ id: "r1" }],
  errors: [{ id: "e1" }],
  blocks: [{ id: "b1" }],
  settings: { retention: 0.9 },
  confidence: {},
  catalog: {},
  plans: version === 7 ? [{ id: "p1" }] : undefined,
  planDraft: null,
  learningSessions: version === 7 ? [{ id: "s1" }] : undefined,
});

describe("migração legada", () => {
  it("valida e preserva banco v7", () => {
    const result = migrateLegacy(fixture());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.errors[0]).toHaveProperty("questionText", "");
      expect(result.data.plans).toHaveLength(1);
    }
  });
  it("migra v6", () => {
    const result = migrateLegacy(fixture(6));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.version).toBe(7);
  });
  it("migra v5 sem descartar conceitos", () => {
    const result = migrateLegacy(fixture(5));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.concepts).toHaveLength(1);
      expect(result.data.plans).toEqual([]);
    }
  });
  it("converte planos legados preservando cargo, área, árvore e cronograma", () => {
    const plan = migrateLegacyPlan({
      id: "old-plan-1",
      meta: { title: "SEDUC", institution: "SEDUC-CE", cargo: "Professor", area: "Física", organizer: "UECE", examDate: "2026-12-05" },
      sourceText: "Conteúdo do edital",
      tree: [{ id: "n1", name: "Mecânica", origin: "edital", selected: true, children: [
        { id: "n2", name: "Cinemática", origin: "suggested", selected: false, children: [] },
      ] }],
      scheduleConfig: { startDate: "2026-11-14", examDate: "2026-12-05", days: [1, 3, 5], minutes: 90, mode: "round" },
      assignments: [{ nodeId: "n1", name: "Mecânica", path: ["Física", "Mecânica"], origin: "edital", day: 1 }],
      createdAt: 100,
      updatedAt: 200,
    });
    expect(plan?.id).toBe("old-plan-1");
    expect(plan?.position).toBe("Professor");
    expect(plan?.area).toBe("Física");
    expect(plan?.tree[0].children[0].selected).toBe(false);
    expect(plan?.scheduleConfig?.mode).toBe("alternate");
    expect(plan?.assignments).toHaveLength(1);
    expect(plan?.status).toBe("active");
  });

  it("normaliza flashcards preservando FSRS e versões", () => {
    const concept = normalizeLegacyConcept({
      id: "concept-1", subject: "fisica", topic: "Energia", source: "Livro",
      fsrs: { s: 12.5, d: 4.2, last: 100, due: 200, reps: 3, lapses: 1, interval: 7 },
      variants: [{ id: "variant-1", kind: "Comparação", q: "Compare", a: "Resposta", uses: 4, passes: 3, failures: 1 }],
    });
    expect(concept.id).toBe("concept-1");
    expect(concept.fsrs.s).toBe(12.5);
    expect(concept.fsrs.reps).toBe(3);
    expect(concept.variants[0].uses).toBe(4);
    expect(concept.variants[0].kind).toBe("Comparação");
  });
  it("completa campos opcionais do caderno sem perder o registro", () => {
    const error = normalizeLegacyError({ id: "error-1", subject: "tae", topic: "SINAES", mistake: "Erro", fix: "Correção" });
    expect(error.id).toBe("error-1");
    expect(error.history).toEqual([]);
    expect(error.questionText).toBe("");
    expect(error.reviewDays).toBe(15);
  });
  it("rejeita dados inválidos", () => {
    expect(validateLegacy({ version: 7, concepts: [] })).toBe(false);
    expect(migrateLegacy("x").ok).toBe(false);
  });
});
