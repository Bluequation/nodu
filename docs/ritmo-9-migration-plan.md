# Ritmo 9 — Estratégia de migração

Status: proposta para validação  
Regra: a migração deve preservar o que funciona e substituir a experiência de forma incremental, sem colocar dados reais em risco.

## 1. Branches e segurança

- main permanece intocada durante a arquitetura e a refatoração.
- refactor/ritmo-8 fica preservada como referência executável da versão atual.
- refactor/ritmo-9-architecture guarda decisões e documentação.
- A implementação futura terá branch própria após aprovação da arquitetura.
- Nenhuma promoção para produção sem validação funcional, visual e de dados.

## 2. Inventário da versão atual

Recursos existentes:
- Planos, editais, árvore de verticalização e cronograma.
- Agenda e conclusão datada.
- Questões em blocos agregados.
- Caderno de erros, histórico, anexos e revisões.
- Flashcards, variantes, curadoria e FSRS.
- Técnicas de aprendizagem e sessões.
- Importação, configurações, backup e migração.
- Persistência IndexedDB e snapshots das versões legadas.

A migração começa com uma matriz de origem → destino → regra → validação para cada entidade.

## 3. Estratégia de migração

### Fase 0 — Congelamento e inventário
- Não desenvolver novas funcionalidades na versão 8.
- Capturar a árvore de código, rotas, modelos, stores e testes.
- Listar campos obrigatórios, opcionais, relações e dados legados.
- Criar cópias anonimizadas para ensaios.
- Registrar contagens e checksums quando aplicável.

### Fase 1 — Arquitetura e protótipo
- Aprovar modelo de domínio e mapa de telas.
- Fazer prova técnica do editor.
- Construir uma única fatia vertical em dados de teste.
- Validar edição, relações, questão, erro e indicador.
- Não migrar dados reais ainda.

### Fase 2 — Fundação técnica
- Criar camada application e contratos de repositório.
- Definir schema versionado.
- Criar design system e shell.
- Implementar salvamento, backup e tratamento offline.
- Testes unitários e de integração dos casos de uso.

### Fase 3 — Migração de dados
- Ler dados Ritmo 8 e snapshots 5/6/7.
- Executar dry-run sem gravar.
- Gerar relatório de contagens, perdas potenciais, campos ausentes e conflitos.
- Preservar IDs e dados de origem.
- Converter PlanTopicRef para TopicLink com validação de integridade.
- Preservar Questões em blocos como QuestionBlockLegacy.
- Não criar tentativas individuais fictícias a partir de totais antigos.
- Preservar estados FSRS e ReviewLogs sem recalcular.
- Preservar histórico, anexos, imagens, máscaras, datas, fontes e texto literal.
- Gravar snapshot imutável antes de qualquer conversão.

### Fase 4 — Migração funcional por fatias
Ordem sugerida:
1. Shell, busca e Meu espaço.
2. Páginas e editor.
3. Planos, edital e TopicLinks.
4. Planejamento e agenda.
5. Questões e tentativas individuais.
6. Caderno de erros ligado às tentativas.
7. Flashcards, curadoria e FSRS.
8. Sessões de estudo e técnicas.
9. Desempenho e recomendações.
10. Importação, ajustes e backup.

Cada fatia deve ser testada antes da seguinte.

### Fase 5 — Validação
- Testes com bases artificiais e cópias anonimizadas reais.
- Conferência de contagens e integridade de relações.
- Conferência de estados FSRS e datas.
- Testes de migração repetida e interrompida.
- Testes de backup, restauração e exportação.
- Testes de navegador em desktop, tablet e celular.
- Comparação visual com telas aprovadas.
- Teste offline e após atualização da página.

### Fase 6 — Liberação
- Usuário valida o fluxo completo.
- Fazer backup explícito.
- Liberar versão de teste sem apagar versão anterior.
- Acompanhar problemas e corrigir.
- Somente após aceite, preparar promoção para produção.

## 4. Regras de não perda

1. Nunca apagar a base 8 durante a migração.
2. Nunca apagar chaves localStorage 5/6/7.
3. Nunca sobrescrever o único snapshot legado.
4. Nunca recalcular FSRS na conversão.
5. Nunca transformar agregados em tentativas individuais fictícias.
6. Nunca remover anexos ou arquivos sem relatório e confirmação.
7. Toda conversão deve ser idempotente.
8. Todo registro não mapeado deve permanecer recuperável.
9. Falha de migração deve permitir retomada ou rollback.
10. Antes de liberar, comparar contagens e amostras de registros.

## 5. Critérios de aceite da migração

- 100% dos registros identificados têm destino ou justificativa de preservação.
- IDs preservados ou mapeados com tabela de equivalência.
- Estados FSRS e histórico iguais antes/depois.
- Nenhuma perda de datas, anexos, imagens, fontes ou referências.
- Nenhuma tentativa inventada.
- Backup restaurável.
- Migração repetida não duplica registros.
- O usuário consegue voltar à versão anterior durante a fase de teste.

## 6. Entrega da arquitetura

A etapa atual termina quando:
- Os documentos Ritmo 9 estiverem revisados.
- O modelo de domínio estiver aprovado.
- O mapa de telas estiver aprovado.
- O sistema visual estiver aprovado.
- A tecnologia do editor estiver decidida por uma prova prática.
- A fatia vertical estiver especificada.

Até lá, não iniciar a implementação geral nem alterar a main.
