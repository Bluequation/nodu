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
      sourceText: "",
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
  return `Você é especialista em análise de editais de concursos públicos e organização de conteúdo programático. Organize SOMENTE o conteúdo programático pertinente ao cargo/área indicado abaixo.

CONCURSO/PLANO: ${plan.title}
INSTITUIÇÃO: ${plan.institution || "não informada"}
CARGO: ${plan.position}
ÁREA/RECORTE: ${plan.area || "não informado"}
BANCA: ${plan.organizer || "não informada"}

REGRAS OBRIGATÓRIAS:
1. Identifique apenas o conteúdo programático pertinente ao cargo/área selecionado. Não misture conteúdos de outros cargos.
2. Preserve literalmente os itens expressos no edital. Organize-os em hierarquia somente quando essa relação estiver indicada no documento: disciplina > área/eixo > assunto > subassunto.
3. NÃO amplie o edital. Não crie sugestões, subassuntos, exemplos, definições, pré-requisitos, tópicos complementares ou conteúdos de conhecimento geral.
4. Se um item for amplo e não tiver subdivisões no edital, mantenha-o como um único item. Não invente filhos para facilitar o estudo.
5. Para cada item literal, informe a referência disponível em uma linha iniciada por "> Referência:". Não invente páginas, itens ou anexos.
6. Inclua "> Trecho literal:" somente quando for necessário registrar o trecho original completo que não aparece integralmente no título. Não repita o próprio título como trecho.
7. Se o cargo, a área ou a seção do conteúdo programático não estiverem claros, registre a dúvida em uma linha "> ALERTA:".
8. Não complete lacunas com conhecimento geral. Se o texto estiver incompleto, informe isso em ALERTA.
9. Retorne APENAS uma estrutura Markdown legível. NÃO use JSON, tabelas, bloco de código ou explicações antes/depois.
10. Use títulos Markdown para representar apenas a hierarquia encontrada no edital. Cada título representa um único nó:
# [EDITAL] Disciplina ou bloco
## [EDITAL] Área ou eixo, se houver
### [EDITAL] Assunto literal
#### [EDITAL] Subassunto literal, somente se existir no edital
11. Use níveis de # conforme a hierarquia real. Não pule níveis sem necessidade. Não use listas para os conteúdos: use títulos.
12. Identifique todos os títulos como [EDITAL]. Não crie categorias de conteúdo que não existam no documento.

EXEMPLO DE FORMATO (apenas para demonstrar a estrutura; não copie os assuntos):
# [EDITAL] Conhecimentos específicos
## [EDITAL] Física
### [EDITAL] 11.1 Competências e habilidades propostas para o componente curricular
> Referência: p. 16, item 11.1

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
      const activeNode: PlanNode = current;
      const officialChildren: PlanNode[] = activeNode.children.filter((child: PlanNode) => child.origin !== "suggested");
      if (officialChildren.length === 1) {
        path.push(activeNode.name);
        current = officialChildren[0];
        continue;
      }
      if (officialChildren.length > 1) {
        sections.push(...officialChildren.map((child: PlanNode) => ({ node: child, path: [...path, activeNode.name] })));
        current = undefined;
        break;
      }
      sections.push({ node: activeNode, path });
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


export function renameNodeInTree(nodes: PlanNode[], id: string, name: string): PlanNode[] {
  return nodes.map(node => node.id === id
    ? { ...node, name: name.trim().slice(0, 240) }
    : { ...node, children: renameNodeInTree(node.children, id, name) });
}

export function addManualChildToTree(nodes: PlanNode[], parentId: string, name: string): PlanNode[] {
  return nodes.map(node => {
    if (node.id === parentId) {
      const child: PlanNode = {
        id: makeId(),
        name: name.trim().slice(0, 240),
        origin: "manual",
        sourceRef: "",
        sourceText: "",
        selected: true,
        children: [],
      };
      return { ...node, children: [...node.children, child] };
    }
    return { ...node, children: addManualChildToTree(node.children, parentId, name) };
  });
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
