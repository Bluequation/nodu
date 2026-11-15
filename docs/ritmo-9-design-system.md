# Ritmo 9 — Sistema visual e interação

Status: proposta para validação  
Direção: workspace leve, branco, editorial, silencioso e rápido. A referência é a fluidez de uso do Notion, sem copiar sua identidade visual.

## 1. Sensação desejada

- Leve, organizado e confiável.
- Muito espaço para o conteúdo respirar.
- Branco como superfície principal.
- Tipografia clara e hierarquia evidente.
- Cor usada para orientar, não para decorar.
- Ferramentas aparecem quando necessárias.
- O estudante sente que está trabalhando no próprio espaço, não preenchendo um sistema administrativo.

## 2. O que evitar

- Cartões dentro de cartões dentro de cartões.
- Contornos em volta de cada agrupamento.
- Painéis com fundos coloridos concorrendo entre si.
- Títulos em caixa alta repetidos.
- Textos explicativos permanentes que ocupam espaço.
- Botões grandes para ações secundárias.
- Campos de formulário quando uma edição inline resolveria.
- Muitos indicadores no mesmo nível visual.
- Cores diferentes para cada disciplina em toda a interface.
- Cabeçalhos altos e banners decorativos.

## 3. Princípios de composição

1. Canvas branco ou quase branco.
2. Conteúdo organizado por alinhamento, tipografia, espaçamento e divisores sutis.
3. Um contêiner visual por nível; não aninhar superfícies sem motivo.
4. Páginas de leitura com largura confortável; tabelas e bancos usam largura disponível.
5. Painel lateral contextual só aparece quando solicitado ou quando necessário.
6. Ferramentas de edição aparecem no hover/foco no desktop e por toque no mobile.
7. Separar estrutura de conteúdo: o estudante percebe páginas e assuntos, não a implementação de componentes.
8. Densidade adaptável: edição de tabela compacta; escrita e leitura com espaço.

## 4. Tokens iniciais

Valores de partida para protótipo, sujeitos à validação visual:
- Fundo principal: #FFFFFF.
- Fundo de apoio: #F7F8FA.
- Texto principal: #202938.
- Texto secundário: #667085.
- Linha/divisor: #E7EAF0.
- Azul de ação: #356FA8.
- Azul de foco: #EAF2FA.
- Sucesso: #27845A.
- Atenção: #B7791F.
- Erro: #C54848.

As cores de status são semânticas e econômicas. Áreas e disciplinas podem usar uma pequena marca de cor ou chip discreto, nunca grandes fundos coloridos em toda a tela.

## 5. Tipografia e espaçamento

- Tipografia principal: Inter ou system UI; avaliar legibilidade em telas pequenas.
- Título de página: 26–32 px, peso semibold.
- Título de seção: 16–20 px.
- Corpo: 14–16 px.
- Metadados: 12–13 px.
- Escala de espaçamento baseada em múltiplos de 4 px.
- Linha de texto de leitura: largura aproximada de 680–760 px.
- Conteúdo de trabalho: até 1120–1280 px, ou largura total quando for banco de dados.
- Inputs com altura confortável e sem aparência de formulário corporativo.

## 6. Navegação e shell

- Sidebar entre 220 e 248 px, recolhível.
- Ícones Lucide simples, sempre acompanhados de rótulos na navegação principal.
- Topbar de aproximadamente 48–56 px.
- Breadcrumb discreto.
- Busca global visível.
- Criação rápida com menu de ações.
- Em telas pequenas, navegação inferior com cinco áreas e drawer para árvore do workspace.

## 7. Padrões de interação

### Edição inline
Título, propriedades, nomes de colunas, células e descrições editáveis no local. Salvar automaticamente com debounce e confirmação visual discreta. Erros de salvamento nunca podem sumir silenciosamente.

### Editor em blocos
- Enter cria próximo bloco.
- Slash abre menu contextual.
- Arrastar reorganiza blocos.
- Atalhos acessíveis e comandos visíveis.
- Colar texto preserva estrutura útil.
- Undo/redo confiável.
- Salvamento local e restauração após atualização.

### Bancos de dados
- Tabela como visualização densa e editável.
- Linha abre detalhe em painel lateral ou página.
- Propriedades configuráveis.
- Filtros, ordenação, agrupamento e visualizações salvas.
- Mesma entidade em múltiplas visualizações, sem duplicação.
- Cabeçalho de tabela fixo quando útil.
- Rolagem horizontal restrita ao banco, nunca ao documento inteiro.

### Painel lateral
Usado para propriedades, relações, fonte, histórico ou detalhe rápido. Não é obrigatório em toda tela. Deve poder fechar sem perder o contexto.

### Estados
- Salvo: discreto.
- Salvando: indicador leve.
- Offline: sinal claro sem bloquear edição local.
- Erro: mensagem acionável e preservação do conteúdo não salvo.
- Vazio: ação principal contextual.

## 8. Componentes compartilhados

- AppShell
- SidebarNavigation
- GlobalSearch
- QuickCreateMenu
- Breadcrumbs
- PageHeader
- InlineProperty
- BlockEditor
- SlashCommandMenu
- DatabaseView
- TableView
- ListView
- BoardView
- CalendarView
- FilterBar
- ContextPanel
- RelationPicker
- StatusChip
- SaveStatus
- EmptyState
- ConfirmDialog
- Toast/InlineFeedback

Componentes devem ser compostos, não embrulhar automaticamente tudo em cards.

## 9. Responsividade e acessibilidade

- Alvos de toque adequados, preferencialmente 40–44 px.
- Foco de teclado visível.
- Contraste WCAG AA para texto.
- Rótulos acessíveis para ícones.
- Não depender apenas de hover.
- Campos longos não podem ficar comprimidos.
- Tabelas têm alternativa mobile.
- Respeitar zoom do navegador.
- Testar 1440 px, 1024 px, 768 px e 390 px.

## 10. Prova visual obrigatória

Antes de adotar o sistema:
1. Montar uma página de estudo com título, texto, checklist, tabela e relação com assunto.
2. Montar um banco de questões com filtros e edição inline.
3. Montar o caderno de erros em tabela e detalhe lateral.
4. Montar Hoje com agenda e uma recomendação.
5. Testar os mesmos fluxos em desktop e celular.

O usuário precisa aprovar a sensação e a facilidade de uso antes de migrar todas as telas.
