# Ritmo 9 — Modelo de domínio e dados

Status: proposta para validação  
Objetivo: fazer planejamento, conteúdo, execução e desempenho compartilharem entidades e identificadores estáveis.

## 1. Regra central

**O Ritmo não deve duplicar conteúdo para cada tela.** Deve manter registros de origem e criar relações e visualizações sobre eles.

Um assunto do edital é uma unidade de contexto. Páginas, questões, erros, flashcards, sessões e tarefas podem se relacionar a esse assunto. Um registro pode estar ligado a mais de um plano ou assunto quando fizer sentido.

Nomes são rótulos, não identificadores. Relações usam IDs estáveis.

## 2. Entidades principais

### Workspace
Espaço local do estudante.
- id
- name
- createdAt
- preferences
- schemaVersion

A primeira versão mantém um workspace local por instalação. Multiusuário e sincronização não fazem parte do escopo inicial.

### StudyPlan
Representa um recorte de preparação: concurso + cargo + área.
- id
- title
- institution
- position
- area
- organizer
- examDate
- status
- sourceDocumentIds
- createdAt
- updatedAt

### PlanNode
Ocorrência de um item do conteúdo programático dentro de um plano.
- id
- planId
- parentId
- name
- origin: edital | suggested | manual
- sourceRef
- sourceText
- selected
- order
- metadata

A árvore mantém a literalidade e a proveniência do edital. Sugestões continuam distinguíveis e desmarcadas por padrão. Um nó não deve ser identificado apenas pelo nome.

### Page
Documento do workspace.
- id
- parentPageId
- title
- icon
- cover opcional
- properties
- content
- contentSchemaVersion
- createdAt
- updatedAt

O conteúdo é uma lista versionada de blocos. A página pode existir livremente ou estar relacionada a planos e assuntos.

### Block
Unidade de conteúdo da página.
Tipos iniciais: paragraph, heading, bulletList, numberedList, todo, quote, callout, divider, image, file, bookmark, tableEmbed, databaseViewEmbed, flashcardEmbed, questionEmbed, errorEmbed, studySummaryEmbed.

Blocos possuem id estável, tipo, dados tipados e ordem. Blocos especiais referenciam registros do domínio; não copiam seus dados como conteúdo independente.

### TopicLink
Relação entre um objeto e um assunto do edital.
- id
- targetType
- targetId
- planId
- nodeId
- relationType
- createdAt

Permite relacionar uma página, questão, erro, coleção ou sessão a mais de um assunto, sem duplicar o objeto. Validar se o nó pertence ao plano informado.

### Resource
Arquivo ou referência externa.
- id
- type: file | link | note | source
- name
- mimeType
- size
- storageKey ou url
- sourceMetadata
- createdAt

Arquivos binários ficam fora do JSON da página. A página guarda referências.

## 3. Entidades de aprendizagem

### QuestionBank
Coleção de questões, identificada por origem, banca, prova, disciplina ou recorte.

### Question
Questão individual.
- id
- statement
- options
- correctAnswer
- explanation
- source
- board
- exam
- year
- difficulty opcional
- tags
- topicLinks
- createdAt

A questão pode existir sem resposta oficial, sem banca ou sem dificuldade conhecida. Não inventar metadados ausentes.

### QuestionAttempt
Uma tentativa individual.
- id
- questionId
- answeredAt
- selectedAnswer
- isCorrect
- timeSpentSeconds opcional
- confidence opcional
- mode: practice | simulation | review
- sessionId opcional
- sourceContext
- topicLinks
- notes

Cada tentativa é histórica e não deve ser sobrescrita por uma tentativa posterior.

### QuestionBlockLegacy
Mantém os registros históricos agregados do Ritmo 8: total, acertos, data e nota. Esses registros não são convertidos em tentativas individuais artificiais.

### ErrorRecord
Registro de uma dificuldade real.
- id
- sourceAttemptId opcional
- origin: questionAttempt | manual | legacy
- statement e alternativas, quando disponíveis
- selectedAnswer e correctAnswer, quando disponíveis
- mistakeType
- mistakeDescription
- correction
- attachments
- status
- nextReview
- history
- topicLinks
- createdAt / updatedAt

Um erro pode nascer de uma tentativa e reutilizar enunciado, alternativas, resposta e fonte. Também pode ser criado manualmente.

### FlashcardConcept
Família de conhecimento com estado FSRS próprio.
- id
- topic
- source
- variants
- fsrsState
- topicLinks
- status
- createdAt

### FlashcardVariant
Versão de um cartão: pergunta, resposta, justificativa, formato, fonte e estatísticas de uso. A edição de uma variante não apaga o histórico da família nem recalcula o FSRS sem uma regra explícita.

### ReviewLog
Registro imutável de cada avaliação FSRS, com data, nota, estado e intervalo calculado. A agenda de revisões deriva do estado FSRS e dos logs; não é o mesmo que tarefa planejada.

### StudySession
Sessão real de estudo.
- id
- startedAt
- endedAt
- durationSeconds
- mode
- planId opcional
- topicLinks
- source
- outcome
- notes

O tempo só é registrado quando existe início e encerramento explícitos ou pausa/retomada controlada. Tempo de aba aberta não é tempo de estudo.

## 4. Planejamento e execução

### StudyTask
Ação planejada: estudar assunto, resolver bloco, revisar material, fazer simulado ou retomar erro.
- id
- type
- title
- dueDate
- estimatedMinutes
- status
- topicLinks
- sourceRef
- recurrence opcional

### TaskOccurrence
Ocorrência datada de uma tarefa recorrente ou planejada. Guarda estado e conclusão da ocorrência, sem transformar uma tarefa recorrente em um único booleano global.

### ScheduleBlock
Reserva de horário para uma tarefa ou sessão planejada.
- id
- date
- startTime
- endTime
- taskId opcional
- planId opcional
- topicLinks
- status

Planejado, agendado, iniciado e concluído são estados distintos. A conclusão da tarefa não declara domínio do assunto.

## 5. Registro de atividade e análise

### ActivityEvent
Livro de eventos append-only para fatos relevantes de aprendizagem.
Tipos iniciais:
- study_session_started
- study_session_paused
- study_session_resumed
- study_session_completed
- question_answered
- error_created
- error_retested
- flashcard_reviewed
- task_completed
- topic_studied

Cada evento tem id, type, occurredAt, entityRefs, topicLinks e payload validado.

Eventos não substituem as entidades principais; registram o que aconteceu e alimentam histórico e agregações.

### AnalyticsProjection
Indicadores derivados e reconstruíveis:
- accuracyByTopic
- accuracyBySubject
- accuracyByBoard
- accuracyByDifficulty
- attemptsByPeriod
- studyTimeByPeriod
- plannedVsCompleted
- fsrsRetention
- errorRecovery
- topicCoverage

Toda projeção deve informar janela temporal, denominador, origem dos dados e limitações. Pode ser descartada e recalculada.

## 6. Relações principais

- Workspace contém Pages, StudyPlans, Resources e bancos.
- StudyPlan contém PlanNodes.
- Page pode ter parentPageId e vários TopicLinks.
- Question, ErrorRecord, FlashcardConcept, StudySession e StudyTask podem ter vários TopicLinks.
- QuestionAttempt referencia uma Question e opcionalmente uma StudySession.
- ErrorRecord pode referenciar a QuestionAttempt que o originou.
- ReviewLog referencia uma família FlashcardConcept e seu estado FSRS.
- StudyTask pode gerar TaskOccurrences e ScheduleBlocks.
- ActivityEvent referencia as entidades afetadas.
- AnalyticsProjection é derivada de tentativas, sessões, revisões, tarefas e eventos.

## 7. Indicadores: definições e limites

### Precisão de questões
Questões corretas divididas por tentativas respondidas no recorte selecionado. Mostrar n de tentativas. Não incluir flashcards ou reaplicações de erros como questões novas.

### Tempo de estudo
Soma das durações medidas de StudySession. Mostrar separadamente estimativas e tempo planejado.

### Cobertura do edital
Mostrar pelo menos três estados: selecionado, estudado e praticado. “Dominado” só poderá existir como avaliação explicitamente definida e sustentada por evidências; nunca será sinônimo de tarefa concluída.

### Retenção
Exibir dados do FSRS separadamente de precisão em questões. Previsão do algoritmo não é prova de domínio.

### Recuperação de erros
Contar reaplicações corretas/erradas e evolução do registro. Autoavaliação de flashcard não encerra automaticamente um erro.

### Consistência
Dias com sessão real e tarefas realizadas, comparados ao plano. Evitar rótulos moralizantes ou punição por dias sem estudo.

### Recomendações
Cada recomendação deve guardar tipo, motivo, evidências usadas, data, status e ação sugerida. Recomendações podem ser aceitas, adiadas ou descartadas.

## 8. Compatibilidade e migração

- Preservar IDs existentes sempre que possível.
- Preservar estados FSRS, due dates, logs, variantes e estatísticas.
- Preservar histórico e anexos do caderno de erros.
- Preservar texto literal, origem e referências do edital.
- Mapear PlanTopicRef atual para TopicLink.
- Mapear QuestionBlock agregado para QuestionBlockLegacy.
- Mapear LearningSession para StudySession quando houver dados suficientes; campos ausentes permanecem ausentes.
- Não criar QuestionAttempt para registros agregados antigos.
- Gerar relatório de itens convertidos, preservados, não mapeados e com avisos.
- Manter snapshot de origem e possibilidade de restauração.

## 9. Regras de integridade

1. IDs de relações devem apontar para entidades existentes.
2. Um PlanNode deve pertencer ao StudyPlan referenciado.
3. Um QuestionAttempt deve apontar para uma Question existente ou para uma questão embutida preservada no modo legado explicitamente identificado.
4. Datas de revisão não podem ser recalculadas durante migração.
5. Evento histórico não pode ser editado para simular uma nova tentativa.
6. Anexos precisam de verificação de tipo, tamanho e integridade.
7. Exclusões de registros relacionados devem ter política explícita: arquivar, desvincular ou excluir em cascata somente quando seguro e confirmado.
8. Importações são idempotentes e versionadas.
