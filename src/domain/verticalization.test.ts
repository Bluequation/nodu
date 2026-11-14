import { describe, expect, it } from "vitest";
import {
  buildVerticalPrompt,
  clearWholeSection,
  getNodeSelectionState,
  getPlanSections,
  getSelectedLeaves,
  parseVerticalMarkdown,
  toggleNodeInTree,
} from "./verticalization";
import type { PlanNode } from "./models";

const sample = `# [EDITAL] Conhecimentos específicos
## [EDITAL] Física
### [EDITAL] 1. Mecânica
> Referência: p. 14, item 1
> Trecho literal: "1. Mecânica."
#### [EDITAL] 1.1 Cinemática
##### [SUGERIDO] Movimento uniforme
##### [SUGERIDO] Movimento variado
#### [EDITAL] 1.2 Dinâmica
> ALERTA: O edital não informa o nível de detalhamento.
`;

describe("verticalização em Markdown", () => {
  it("preserva origem, referência e trecho literal", () => {
    const parsed = parseVerticalMarkdown(sample);
    const mechanics = parsed.tree[0].children[0].children[0];
    expect(mechanics.name).toBe("1. Mecânica");
    expect(mechanics.sourceRef).toBe("p. 14, item 1");
    expect(mechanics.sourceText).toBe("1. Mecânica.");
    expect(parsed.warnings).toHaveLength(1);
  });

  it("não cria trechos originais artificiais quando o edital não os fornece", () => {
    const parsed = parseVerticalMarkdown(sample);
    const mechanics = parsed.tree[0].children[0].children[0];
    const kinematics = mechanics.children[0];
    expect(mechanics.sourceText).toBe("1. Mecânica.");
    expect(kinematics.sourceText).toBe("");
  });

  it("orienta a IA a organizar sem ampliar o edital", () => {
    const prompt = buildVerticalPrompt({
      title: "SEDUC-CE",
      institution: "SEDUC",
      position: "Professor",
      area: "Física",
      organizer: "UECE",
      sourceText: "1. Mecânica",
    });
    expect(prompt).toContain("NÃO amplie o edital");
    expect(prompt).toContain("mantenha-o como um único item");
    expect(prompt).not.toContain("[SUGERIDO]");
  });

  it("mantém sugestões desmarcadas por padrão", () => {
    const parsed = parseVerticalMarkdown(sample);
    const suggestions = parsed.tree[0].children[0].children[0].children[0].children;
    expect(suggestions).toHaveLength(2);
    expect(suggestions.every(node => node.origin === "suggested" && !node.selected)).toBe(true);
  });

  it("divide a seleção em seções nos ramos do edital", () => {
    const parsed = parseVerticalMarkdown(sample);
    const sections = getPlanSections(parsed.tree);
    expect(sections.map(section => section.node.name)).toEqual(["1.1 Cinemática", "1.2 Dinâmica"]);
  });

  it("inclui somente itens selecionados e não inclui sugestões por acidente", () => {
    const parsed = parseVerticalMarkdown(sample);
    const leaves = getSelectedLeaves(parsed.tree);
    expect(leaves.map(node => node.name)).toEqual(["1.1 Cinemática", "1.2 Dinâmica"]);
    const [root] = parsed.tree;
    const selected = toggleNodeInTree(parsed.tree, root.id, false);
    expect(getSelectedLeaves(selected)).toHaveLength(0);
  });

  it("permite limpar uma seção incluindo sugestões e informa seleção parcial", () => {
    const parsed = parseVerticalMarkdown(sample);
    const section = getPlanSections(parsed.tree)[0].node;
    const cleared = clearWholeSection(section);
    expect(getSelectedLeaves([cleared])).toHaveLength(0);
    const partial: PlanNode = {
      id: "parent", name: "Parent", origin: "edital", sourceRef: "", sourceText: "", selected: true,
      children: [
        { id: "one", name: "One", origin: "edital", sourceRef: "", sourceText: "", selected: true, children: [] },
        { id: "two", name: "Two", origin: "edital", sourceRef: "", sourceText: "", selected: false, children: [] },
      ],
    };
    expect(getNodeSelectionState(partial).some).toBe(true);
    expect(getNodeSelectionState(partial).all).toBe(false);
  });
});
