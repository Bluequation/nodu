# Arquitetura — Ritmo 8.0

## Decisões
- React + TypeScript + Vite.
- Refatoração estrutural em branch independente: `refactor/ritmo-8`.
- IndexedDB como persistência principal; migração não destrutiva do localStorage.
- React Router; Zustand somente quando estado compartilhado for necessário.
- CSS próprio e identidade visual Ritmo: azul como cor de ação, superfícies marfim/branco quente e texto grafite/marrom.
- Aplicação local-first, sem conta, API de IA ou serviço de nuvem obrigatório.

## Camadas
- `app`: shell, navegação e rotas.
- `features`: fluxos de cada funcionalidade.
- `domain`: modelos e regras puras, testáveis sem interface.
- `data`: persistência, repositórios e migração.
- `shared`: componentes e estilos reutilizáveis (a consolidar durante a refatoração).

## Planejamento
Cada plano representa um concurso + cargo + área/recorte. Um concurso com vários cargos ou áreas deve ter planos separados para evitar misturar programas.
O plano guarda os dados do concurso, o texto de origem, a árvore verticalizada, alertas, seleção, configuração semanal e distribuição dos tópicos.

### Verticalização assistida
- O edital é lido localmente no navegador; PDF textual usa PDF.js carregado sob demanda, e TXT/MD são aceitos diretamente.
- A IA é externa e opcional: o Ritmo prepara uma solicitação com o recorte e o texto; a pessoa usa ChatGPT ou outra IA e importa uma resposta Markdown.
- Não há chave de IA no cliente, servidor de IA ou cobrança de API nesse fluxo.
- Itens literais, sugestões e inclusões manuais usam origens distintas. Sugestões começam desmarcadas.
- A estrutura importada é revisada e selecionada em seções, com salvamento no IndexedDB.
- Referência e trecho original são guardados separadamente do título editável.

### Cronograma
- A pessoa define data inicial, dias disponíveis, tempo diário e estratégia de distribuição.
- O sistema propõe uma distribuição semanal editável. O tempo diário é disponibilidade declarada, não uma estimativa automática de domínio do conteúdo.
- A agenda semanal lê as atribuições salvas; não altera datas ou estados do FSRS.

## Aprendizagem e FSRS
- A implementação FSRS-6 foi portada das equações e pesos usados pela versão 7.1 e tem testes próprios.
- Cada família de flashcards mantém seu estado FSRS; suas versões têm estatísticas individuais de uso, acertos e falhas.
- A fila de revisão respeita retenção desejada, limites diários, cartões novos e cartões vencidos.
- Autoexplicação, recuperação livre, retomada de erros e prática intercalada usam apenas conteúdo inserido pela pessoa. Essas sessões não atualizam o FSRS nem o calendário do caderno.
- O caderno de erros tem ciclo separado: a pessoa registra o erro, a correção e depois avalia uma nova questão. Duas aplicações corretas em dias distintos podem marcar o registro como dominado.
- Blocos de questões registram total e acertos, sem alterar o FSRS.

## Persistência e migração
- IndexedDB `ritmo-8`, versão 2; stores: `appState`, `plans`, `concepts`, `reviews`, `errors`, `blocks` e `learningSessions`.
- Na primeira inicialização, o banco 7.1 é copiado integralmente para `appState/legacy-v7-snapshot`.
- Conceitos, variantes, estados FSRS, revisões, erros, blocos, sessões e planos são normalizados e importados com seus IDs. A importação é idempotente e registra contagens.
- A origem localStorage não é apagada nem sobrescrita. `planDraft`, configurações e dados auxiliares permanecem no snapshot quando não têm conversão ativa.
- A equivalência do FSRS é coberta por testes de regra; antes da publicação, ainda será necessário validar a migração com cópias reais anonimizadas e conferir as contagens.
