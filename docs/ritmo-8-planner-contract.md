# Ritmo 8 — contrato de interface
Escopo congelado: Meus planos > cronograma. Não ampliar outras telas antes da aprovação visual.
## Referência aprovada (14/11/2026)
Duas regiões: planner semanal e biblioteca. Layout desktop 40/60: sete cartões brancos vazios na vertical à esquerda; nomes curtos, horários no próprio cartão, simulado opcional. Biblioteca à direita com seções empilhadas (Conhecimentos gerais / Conhecimentos específicos) e cards de área coloridos, recolhíveis, com peças da mesma cor no planner. Sem listas duplicadas, seletores repetidos ou painel intermediário. As duas regiões têm rolagem independente. Em telas estreitas ficam empilhadas, mantendo ambas disponíveis. Não criar assuntos fictícios. Nomes de apresentação não alteram os originais.
## Arquitetura
- plannerModel.ts: adaptação de apresentação, regras puras, distribuição, labels e hierarquia.
- PlannerEditor.tsx: interface, interação e persistência serializada.
- planner.css: estilos locais sob .ritmo-planner, sem novos estilos globais.
- plannerModel.test.ts: regressões de dados.
## Verificação obrigatória
Comparar visualmente com o protótipo aprovado (não apenas build). Verificar plano novo, plano antigo, só gerais, gerais + específicos, biblioteca vazia, 11 assuntos em um dia, domingo, arraste mouse e toque, remover e reabrir após atualização. Não apagar planejamento anterior automaticamente. Diferenciar build verde de validação visual. Não avançar para outras telas sem aprovação.

## Referência visual
O arquivo [planner-reference.svg](planner-reference.svg) é uma reprodução esquemática da composição aprovada (dados fictícios, sem substituir a imagem original). Compare os artefatos de screenshots do workflow Validate Ritmo 8 com essa composição. O script scripts/check-planner.mjs usa uma base IndexedDB descartável criada no navegador de teste, sem acessar dados pessoais. Para executar localmente após build: `npm install --no-save --package-lock=false playwright@1.56.1`, `npx playwright install chromium`, `node scripts/check-planner.mjs`.

## Refinamento aprovado
Peças da biblioteca compactas, de largura conforme o título, agrupadas por categoria. Categorias permanecem mesmo quando todos os seus assuntos estão no planner. Rótulos conhecidos usam abreviações semânticas; os demais preservam o texto sem truncamento arbitrário. O número de assuntos e a rolagem do cartão indicam seu conteúdo. Recomeçar semana é uma ação explícita com confirmação, devolve todos os itens à biblioteca e zera horários e simulados sem alterar edital, datas do plano ou registros de conclusão. Planos novos sempre começam vazios; nenhuma migração apaga planos existentes.

## Revisão autorizada — planner vertical
A proporção 40/60 substitui o desenho anterior de sete dias lado a lado. Cores por área: legislação azul, pedagogia lilás, administração âmbar, português verde acinzentado, dados petróleo, específicos índigo; fallback neutro. Os cards expandidos usam a largura disponível. Os testes verificam geometria desktop, cor persistente e os gestos existentes. A referência SVG é esquemática e não equivale à captura do aplicativo.

## Consistência de Meus planos
Peças em ordem alfabética pelo título apresentado dentro de cada grupo, com ordenação pt-BR; a ordem original do edital não muda. Navegação pelas etapas já disponíveis, aguardando salvamento antes de sair. A aparência das telas Edital, Seleção, Novo plano, galeria e Ver plano usa a mesma paleta e superfícies compactas; cobertura por área e títulos curtos não alteram dados oficiais.
