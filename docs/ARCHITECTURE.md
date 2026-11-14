# Arquitetura — Ritmo 8.0

## Decisões
- React + TypeScript + Vite.
- Refatoração estrutural em branch independente: `refactor/ritmo-8`.
- IndexedDB como persistência principal; migração não destrutiva do localStorage.
- React Router; Zustand somente quando estado compartilhado for necessário.
- CSS próprio e identidade visual Ritmo: azul como cor de ação, superfícies marfim/branco quente e texto grafite/marrom.
- Aplicação local-first, sem dependência obrigatória de IA, API ou nuvem.

## Camadas
- `app`: shell, navegação e rotas.
- `features`: fluxos de cada funcionalidade.
- `domain`: modelos e regras puras, testáveis sem interface.
- `data`: persistência, repositórios e migração.
- `shared`: componentes e estilos reutilizáveis (a consolidar durante a refatoração).

## Plano de estudos
Cada plano representa um concurso + cargo + área/recorte. Um concurso com vários cargos ou áreas deve ter planos separados para evitar misturar programas.
O plano guarda os dados do concurso, o texto de origem, a árvore verticalizada, alertas, seleção, configuração semanal e distribuição dos tópicos.

### Verticalização assistida
- O edital é lido localmente no navegador; PDF textual usa PDF.js carregado sob demanda, e TXT/MD são aceitos diretamente.
- A IA é externa e opcional: o Ritmo prepara uma solicitação com o recorte e o texto; a pessoa usa ChatGPT ou outra IA e importa uma resposta Markdown.
- Não há chave de IA no cliente, servidor de IA ou cobrança de API nessa etapa.
- Itens literais, sugestões e inclusões manuais usam origens distintas. Sugestões começam desmarcadas.
- A estrutura importada é revisada e selecionada em seções, com salvamento no IndexedDB.
- Referência e trecho original são guardados separadamente do título editável.

### Cronograma
- A pessoa define data inicial, dias disponíveis, tempo diário e estratégia de distribuição.
- O sistema propõe uma distribuição semanal editável. O tempo diário é disponibilidade declarada, não uma estimativa automática de domínio do conteúdo.
- A agenda semanal lê as atribuições salvas; não altera datas ou estados do FSRS.

## Aprendizagem e FSRS
A interface React não deve recalcular FSRS. A integração futura deve preservar o motor, parâmetros, histórico e estados da versão anterior. Questões, cartões e erros devem relacionar-se por IDs estáveis.

## Banco
- IndexedDB: `ritmo-8`, versão 1; object stores `appState` e `plans`.
- A cópia legada é armazenada como snapshot em `appState`; a origem localStorage não é apagada.
- A migração de conceitos, revisões, questões, erros, flashcards e sessões ainda precisa de mapeamento e testes de equivalência antes de ativar a versão 8 para uso real.
