# Ritmo 9 — Arquitetura do produto

Status: proposta para validação antes da implementação  
Base de trabalho: refactor/ritmo-8, commit 3f04ed5  
Branch desta etapa: refactor/ritmo-9-architecture

## 1. Definição do produto

**Ritmo é um espaço inteligente de estudos que combina organização flexível, execução orientada e acompanhamento de desempenho.**

Promessa: ajudar quem precisa organizar muito conteúdo, estudar com constância, identificar dificuldades e decidir o que fazer a seguir para aumentar suas chances de aprovação.

O Ritmo combina:
- A liberdade de organização de um workspace: páginas, materiais, tabelas, relações e visualizações.
- Um motor de aprendizagem: planejamento, questões, caderno de erros, flashcards, revisões e sessões.
- Uma camada de inteligência: indicadores confiáveis, histórico, diagnóstico e recomendações explicáveis.

O Ritmo não deve exigir que o estudante aprenda a operar um sistema burocrático antes de conseguir estudar.

## 2. Princípios de produto

1. **Conteúdo primeiro:** o estudante começa por uma página, assunto ou atividade, não por um formulário longo.
2. **Uma informação, várias visualizações:** o mesmo dado pode aparecer em página, tabela, agenda, coleção ou painel sem ser duplicado.
3. **Registrar uma vez, aproveitar em todo lugar:** uma questão respondida pode alimentar o histórico, o caderno de erros e os indicadores, sem cadastros repetidos.
4. **Contexto preservado:** plano, edital, disciplina, assunto, fonte e data acompanham o estudante entre as áreas do produto.
5. **Edição próxima do conteúdo:** editar uma célula, título, propriedade ou bloco deve ser simples e imediato.
6. **Complexidade progressiva:** opções avançadas aparecem quando são necessárias; a tela inicial não mostra todos os controles.
7. **Dados honestos:** distinguir tempo planejado de tempo estudado, tarefa concluída de domínio, acerto de retenção e estimativa de evidência real.
8. **Local-first e recuperável:** o uso básico funciona localmente; backup e restauração são compreensíveis e testáveis.
9. **Explicabilidade:** recomendações mostram o motivo e os dados que as sustentam.
10. **Acessível em todos os tamanhos:** desktop favorece organização; celular favorece execução rápida e consulta.

## 3. O ciclo central do Ritmo

Organizar → Planejar → Estudar → Registrar → Analisar → Ajustar.

- Organizar: criar planos, páginas, materiais, bancos e relações.
- Planejar: selecionar conteúdos do edital, distribuir assuntos e reservar tempo.
- Estudar: realizar sessões, responder questões, revisar flashcards e retomar erros.
- Registrar: guardar tentativas, respostas, duração, confiança, fonte e contexto.
- Analisar: calcular desempenho por plano, disciplina, assunto, banca, dificuldade e período.
- Ajustar: recomendar a próxima ação com base em evidências e permitir que a pessoa aceite ou altere a sugestão.

Este ciclo deve ser perceptível, mas não deve obrigar uma sequência rígida. O estudante pode entrar por qualquer ponto.

## 4. Arquitetura de navegação

Navegação principal com cinco áreas:

### Hoje
Painel de ação diária. Responde: o que está previsto, o que está atrasado, o que merece atenção e de onde continuar.

### Meu espaço
Workspace flexível com páginas, subpáginas, editais, materiais, arquivos, bancos de dados e coleções. Permite criar e relacionar conteúdo sem exigir que tudo esteja dentro de um plano.

### Planejar
Planos de concurso, identificação de cargo e recorte, edital, verticalização, seleção de conteúdo, cronograma, metas e agenda.

### Estudar
Sessões, questões, simulados, caderno de erros, flashcards, revisões e técnicas de aprendizagem.

### Desempenho
Visão geral, análise por plano, disciplina e assunto, evolução temporal, questões, tempo, retenção, padrões de erro e recomendações.

Busca global, criação rápida e configurações são recursos transversais, não áreas que competem com a navegação principal.

## 5. Camadas funcionais

### Workspace
- Páginas e subpáginas.
- Editor em blocos.
- Anotações e materiais de referência.
- Tabelas e bancos de dados com visualizações.
- Links internos, relações e propriedades.
- Busca global e captura rápida.

### Planejamento
- Concurso, instituição, cargo, área/recorte, banca e data.
- Documento de origem e texto literal do edital.
- Árvore de tópicos com proveniência: edital, sugestão ou inclusão manual.
- Seleção e priorização de assuntos.
- Distribuição semanal editável.
- Agenda diária, semanal e mensal.
- Metas planejadas e execução registrada.

### Aprendizagem
- Banco de questões e tentativas individuais.
- Simulados e blocos históricos agregados.
- Caderno de erros com causa, correção, fonte e reaplicações.
- Flashcards, famílias, variantes, curadoria e FSRS.
- Sessões de estudo e técnicas de recuperação.
- Histórico de atividades.

### Inteligência de desempenho
- Precisão: acertos / questões efetivamente respondidas.
- Volume: questões respondidas e sessões concluídas.
- Ritmo: tempo medido em sessões, separado de tempo planejado.
- Cobertura: assuntos selecionados, estudados e praticados, com definições distintas.
- Evolução: comparação temporal com amostra e período visíveis.
- Retenção: estado e previsões do FSRS, sem confundir com percentual de acertos.
- Recuperação de erros: reaplicações e resultados posteriores.
- Consistência: dias e sessões realizadas em relação ao planejamento.
- Prioridades: assuntos com baixa precisão, recorrência de erros ou revisão vencida.

## 6. Regras para indicadores e recomendações

- Não inferir domínio apenas porque o estudante marcou uma tarefa como concluída.
- Não inferir tempo de estudo pelo tempo em que uma aba ficou aberta.
- Não transformar um bloco antigo de 20 questões e 15 acertos em 20 tentativas individuais fictícias.
- Não comparar percentuais sem mostrar quantidade de questões, período e contexto.
- Mostrar “amostra pequena” quando houver poucas tentativas.
- Separar questões, flashcards, reaplicações de erro e autoavaliações.
- Distinguir desempenho por banca, fonte, dificuldade e assunto quando esses dados existirem.
- Uma recomendação deve apresentar motivo, evidência, ação sugerida e opção de ignorar.
- Métricas derivadas devem poder ser recalculadas a partir dos registros de origem.

## 7. Arquitetura técnica proposta

### Decisões mantidas
- React + TypeScript + Vite.
- Aplicação local-first.
- IndexedDB como persistência principal.
- React Router para navegação.
- Zustand somente para estado de interface compartilhado e transitório, não como banco de dados.
- Regras de domínio puras e testáveis.
- Sem exigir conta, backend, sincronização em nuvem ou IA paga para o funcionamento essencial.

### Camadas de software
- app: shell, rotas, layout, navegação e inicialização.
- features: fluxos e telas por domínio.
- domain: entidades, invariantes, cálculos e políticas puras.
- application: casos de uso que coordenam domínio e repositórios.
- data: IndexedDB, repositórios, importação, exportação, backup e migração.
- analytics: eventos, agregações, indicadores e recomendações.
- shared: design system, componentes, editor, acessibilidade e utilitários.

### Persistência
A interface não acessa IndexedDB diretamente. Componentes chamam casos de uso; casos de uso usam repositórios. A implementação IndexedDB fica substituível por outra infraestrutura sem reescrever regras de domínio.

### Editor
BlockNote é o primeiro candidato para um protótipo de editor em blocos, por oferecer experiência React baseada em blocos e customização de blocos. Tiptap e Lexical permanecem alternativas de comparação. A escolha final depende de uma prova técnica com edição, tabelas, blocos personalizados, colagem, acessibilidade, celular, salvamento local, exportação e desempenho.

O formato persistido das páginas deve ter versão e uma camada de adaptação. Não permitir que o formato interno de uma biblioteca de editor se torne o modelo de dados inteiro do Ritmo.

### PWA
Preparar a arquitetura para instalação e funcionamento offline, sem antecipar sincronização multi-dispositivo. A estratégia de sincronização, caso seja necessária, será uma decisão posterior com resolução explícita de conflitos.

## 8. Critérios de sucesso do produto

1. Criar uma página e escrever sem passar por um formulário de cadastro.
2. Relacionar a página a um plano e assunto em poucos passos.
3. Registrar uma questão e, se errar, criar um registro de erro reaproveitando os dados.
4. Visualizar a mesma informação em página, tabela e desempenho sem duplicação.
5. Abrir Hoje e compreender a próxima ação.
6. Entender por que um assunto foi recomendado.
7. Usar o fluxo principal em celular sem rolagem horizontal indevida.
8. Exportar, restaurar e migrar dados sem perda.
9. Continuar útil mesmo sem internet.
10. Não exigir que a pessoa preencha campos que o sistema já conhece.

## 9. Fora do escopo inicial

- Rede social, ranking público ou competição entre estudantes.
- Chatbot que inventa aulas ou conteúdos.
- Sincronização em nuvem obrigatória.
- Integração paga com bancos externos de questões.
- Recomendações automáticas sem explicação.
- Construtor visual genérico que tente reproduzir todo o Notion.
- Transformar cada tela em um dashboard com dezenas de cartões.

## 10. Primeira entrega vertical

A primeira versão funcional deve provar um único fluxo completo:

1. Criar um plano de estudos.
2. Abrir um assunto do edital.
3. Criar uma página de estudo com blocos.
4. Registrar uma sessão real.
5. Registrar uma questão individual e sua resposta.
6. Criar um erro a partir da tentativa, sem redigitar o enunciado.
7. Exibir a atualização do desempenho daquele assunto.
8. Mostrar uma próxima ação justificável em Hoje.

Somente depois da validação deste fluxo iniciaremos a migração em escala dos módulos atuais.
