# Ritmo 8 — contrato de interface
Escopo congelado: Meus planos > cronograma. Não ampliar outras telas antes da aprovação visual.
## Referência aprovada (14/11/2026)
Duas regiões: planner semanal e biblioteca. Sete cartões brancos vazios em uma linha; nomes curtos, horários no próprio cartão, simulado opcional. Biblioteca em duas colunas (Conhecimentos gerais / Conhecimentos específicos), categorias recolhíveis. Peças azuis gerais e lilás específicas. Sem listas duplicadas, seletores repetidos ou painel intermediário. Em telas estreitas, a semana desliza horizontalmente; em largura muito pequena a biblioteca empilha. Não criar assuntos fictícios. Nomes de apresentação não alteram os originais.
## Arquitetura
- plannerModel.ts: adaptação de apresentação, regras puras, distribuição, labels e hierarquia.
- PlannerEditor.tsx: interface, interação e persistência serializada.
- planner.css: estilos locais sob .ritmo-planner, sem novos estilos globais.
- plannerModel.test.ts: regressões de dados.
## Verificação obrigatória
Comparar visualmente com o protótipo aprovado (não apenas build). Verificar plano novo, plano antigo, só gerais, gerais + específicos, biblioteca vazia, 11 assuntos em um dia, domingo, arraste mouse e toque, remover e reabrir após atualização. Não apagar planejamento anterior automaticamente. Diferenciar build verde de validação visual. Não avançar para outras telas sem aprovação.
