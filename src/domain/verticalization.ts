import type { PlanNode, PlanOrigin, StudyPlan } from "./models";

export interface VerticalSection {
  node: PlanNode;
  path: string[];
}
export interface ParsedVerticalization {
  tree: PlanNode[];
  warnings: string[];
}
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function cleanMetadata(value: string): string {
  return value.trim().replace(/^\*\*|\*\*$/g, "").replace(/^["“]|["”]$/g, "").trim();
}
function decodeText(value: string): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/&#x([0-9a-f]+);?/gi, (_, n: string) => {
      const code = Number.parseInt(n, 16);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    })
    .replace(/&#(\d+);?/g, (_, n: string) => {
      const code = Number.parseInt(n, 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    })
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/^\s*`{3}(?:markdown|md|text)?[ \t]*\r?\n?/i, "")
    .replace(/\r?\n?`{3}[ \t]*$/, "")
    .trim();
}

export function parseVerticalMarkdown(input: string): ParsedVerticalization {
  const roots: PlanNode[] = [];
  const stack: Array<{ level: number; node: PlanNode }> = [];
  const warnings: string[] = [];
  let current: PlanNode | undefined;

  for (const rawLine of decodeText(input).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let meta = line.match(/^>\s*(?:\*\*)?(?:ALERTA|AVISO|OBSERVA[ÇC][ÃA]O)\s*:\s*(.+?)(?:\*\*)?$/i);
    if (meta) {
      warnings.push(cleanMetadata(meta[1]));
      continue;
    }
    meta = line.match(/^>\s*(?:\*\*)?Refer[eê]ncia\s*:\s*(.+?)(?:\*\*)?$/i);
    if (meta && current) {
      current.sourceRef = cleanMetadata(meta[1]).slice(0, 180);
      continue;
    }
    meta = line.match(/^>\s*(?:\*\*)?Trecho literal\s*:\s*(.+?)(?:\*\*)?$/i);
    if (meta && current) {
      current.sourceText = cleanMetadata(meta[1]).slice(0, 1200);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (!heading) continue;

    let name = heading[2].trim();
    let origin: PlanOrigin = "edital";
    const tag = name.match(/^\[(EDITAL|SUGERIDO|MANUAL)\]\s*/i);
    if (tag) {
      origin = tag[1].toLowerCase() === "sugerido" ? "suggested" : tag[1].toLowerCase() === "manual" ? "manual" : "edital";
      name = name.slice(tag[0].length).trim();
    }
    name = name.replace(/\*\*/g, "").replace(/`/g, "").trim();
    if (!name) continue;

    const node: PlanNode = {
      id: makeId(),
      name: name.slice(0, 240),
      origin,
      sourceRef: "",
      sourceText: origin === "edital" ? name.slice(0, 1200) : "",
      selected: origin !== "suggested",
      children: [],
    };
    const level = heading[1].length;
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else roots.push(node);
    stack.push({ level, node });
    current = node;
  }

  if (!roots.length) {
    throw new Error("Não encontrei uma estrutura em Markdown. Use títulos com #, ## e ###, identificados como [EDITAL] ou [SUGERIDO].");
  }
  return { tree: roots, warnings };
}

export function buildVerticalPrompt(plan: Pick<StudyPlan, "title" | "institution" | "position" | "area" | "organizer" | "sourceText">): string {
  return `Você é especialista em análise de editais de concursos públicos e organização de conteúdo programático. Verticalize SOMENTE o conteúdo programático pertinente ao cargo/área indicado abaixo.

CONCURSO/PLANO: ${plan.title}
INSTITUIÇÃO: ${plan.institution || "não informada"}
CARGO: ${plan.position}
ÁREA/RECORTE: ${plan.area || "não informado"}
BANCA: ${plan.organizer || "não informada"}

REGRAS OBRIGATÓRIAS:
1. Identifique apenas o conteúdo programático pertinente ao cargo/área selecionado. Não misture conteúdos de outros cargos.
2. Preserve literalmente os itens expressos no edital. Organize em hierarquia: disciplina > área/eixo > assunto > subassunto, conforme o texto permitir.
3. Não invente assuntos e não apresente conhecimento geral como se estivesse no edital.
4. Quando um item amplo precisar de desdobramento para facilitar o estudo, coloque os filhos com a etiqueta [SUGERIDO] e mantenha o texto original do edital com a etiqueta [EDITAL]. Sugestões devem começar desmarcadas.
5. Para cada item literal, informe a referência disponível em uma linha iniciada por "> Referência:". Não invente páginas, itens ou anexos.
6. Se o trecho original for diferente do título resumido, acrescente uma linha "> Trecho literal:" com a transcrição fiel.
7. Se o cargo, a área ou a seção do conteúdo programático não estiverem claros, registre a dúvida em uma linha "> ALERTA:".
8. Não complete lacunas com conhecimento geral. Se o texto estiver incompleto, informe isso em ALERTA.
9. Retorne APENAS uma estrutura Markdown legível. NÃO use JSON, tabelas, bloco de código ou explicações antes/depois.
10. Use títulos Markdown para representar a hierarquia. Cada título representa um único nó:
# [EDITAL] Disciplina ou bloco
## [EDITAL] Área ou eixo
### [EDITAL] Assunto literal
#### [SUGERIDO] Desdobramento didático
11. Use níveis de # conforme a hierarquia real. Não pule níveis sem necessidade. Não use listas para os conteúdos: use títulos.
12. Marque cada título com [EDITAL], [SUGERIDO] ou [MANUAL]. Não acrescente [SUGERIDO] a um item que esteja escrito no edital.

EXEMPLO DE FORMATO (apenas para demonstrar a estrutura; não copie os assuntos):
# [EDITAL] Conhecimentos específicos
## [EDITAL] Física
### [EDITAL] 11.1 Competências e habilidades propostas para o componente curricular
> Referência: p. 16, item 11.1
> Trecho literal: "11.1 Competências e habilidades propostas para o componente curricular"
#### [SUGERIDO] Relação entre competências, habilidades e objetivos de aprendizagem

CONTEÚDO EXTRAÍDO DO EDITAL:
${plan.sourceText.slice(0, 160000)}

Se o texto não trouxer o conteúdo programático do cargo/área selecionado, não fabrique a estrutura: explique a ausência em uma linha "> ALERTA:".`;
}

export function getPlanSections(tree: PlanNode[]): VerticalSection[] {
  const sections: VerticalSection[] = [];
  for (const root of tree) {
    let current: PlanNode | undefined = root;
    const path: string[] = [];
    let guard = 0;
    while (current && guard++ < 12) {
      const officialChildren = current.children.filter(child => child.origin !== "suggested");
      if (officialChildren.length === 1) {
        path.push(current.name);
        current = officialChildren[0];
        continue;
      }
      if (officialChildren.length > 1) {
        sections.push(...officialChildren.map(node => ({ node, path: [...path, current!.name] })));
        current = undefined;
        break;
      }
      sections.push({ node: current, path });
      current = undefined;
    }
    if (current) sections.push({ node: current, path });
  }
  return sections;
}

export function setNodeSelection(node: PlanNode, selected: boolean, includeSuggestions = false): PlanNode {
  const includeChildren = includeSuggestions || node.origin === "suggested";
  return {
    ...node,
    selected,
    children: node.children.map(child =>
      child.origin === "suggested" && !includeChildren
        ? child
        : setNodeSelection(child, selected, includeChildren)
    ),
  };
}

export function toggleNodeInTree(nodes: PlanNode[], id: string, selected: boolean, includeSuggestions = false): PlanNode[] {
  return nodes.map(node => {
    if (node.id === id) return setNodeSelection(node, selected, includeSuggestions);
    if (node.children.length) return { ...node, children: toggleNodeInTree(node.children, id, selected, includeSuggestions) };
    return node;
  });
}

export function getNodeSelectionState(node: PlanNode): { all: boolean; some: boolean } {
  const relevant = node.origin === "suggested"
    ? node.children
    : node.children.filter(child => child.origin !== "suggested");
  if (!relevant.length) return { all: node.selected, some: node.selected };
  const states = relevant.map(getNodeSelectionState);
  return { all: states.every(state => state.all), some: states.some(state => state.some) };
}

export interface SelectedPlanLeaf {
  id: string;
  name: string;
  path: string[];
  origin: PlanOrigin;
  sourceRef: string;
}
export function getSelectedLeaves(nodes: PlanNode[], parentPath: string[] = []): SelectedPlanLeaf[] {
  const result: SelectedPlanLeaf[] = [];
  for (const node of nodes) {
    const path = [...parentPath, node.name];
    const officialChildren = node.children.filter(child => child.origin !== "suggested");
    const suggestedChildren = node.children.filter(child => child.origin === "suggested");
    if (officialChildren.length) result.push(...getSelectedLeaves(officialChildren, path));
    else if (node.origin !== "suggested" && node.selected) {
      result.push({ id: node.id, name: node.name, path, origin: node.origin, sourceRef: node.sourceRef });
    } else if (node.origin === "suggested" && !node.children.length && node.selected) {
      result.push({ id: node.id, name: node.name, path, origin: node.origin, sourceRef: node.sourceRef });
    }
    if (suggestedChildren.length) result.push(...getSelectedLeaves(suggestedChildren, path));
  }
  return result;
}

export function countTreeNodes(nodes: PlanNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countTreeNodes(node.children), 0);
}

export function selectWholeSection(node: PlanNode, includeSuggestions = false): PlanNode {
  return setNodeSelection(node, true, includeSuggestions);
}

export function clearWholeSection(node: PlanNode): PlanNode {
  return setNodeSelection(node, false, true);
}
