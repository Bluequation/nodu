# Migração — Ritmo 7.1 para 8.0

A branch `main` permanece como versão publicada/legada. A nova aplicação é construída isoladamente em `refactor/ritmo-8`.

Fontes legadas: `ritmo-notion-v7`, `ritmo-notion-v6`, `ritmo-notion-v5`.

## Salvaguardas atuais
- Abrir IndexedDB `ritmo-8`.
- Ler as chaves antigas sem removê-las.
- Aplicar a normalização de versões 5/6/7.
- Gravar uma cópia integral em `appState/legacy-v7-snapshot` e metadados da migração.
- Manter localStorage intacto como fonte de recuperação.
- Não afirmar que os dados legados já estão ativos nas telas React: por enquanto, há snapshot preservado, não migração funcional de cada módulo.

## Próximas etapas
1. Mapear conceitos, cartões/versões, revisões FSRS, questões, erros, blocos, configurações, planos e sessões.
2. Definir IDs estáveis e relações entre entidades.
3. Criar conversores puros e testes com fixtures reais anonimizadas.
4. Comparar contagens, campos, imagens/máscaras e datas antes/depois.
5. Verificar equivalência FSRS com casos de referência antes de migrar o motor.
6. Executar migração idempotente e relatório de divergências.
7. Somente depois do aceite, liberar o uso diário e preparar publicação.

A agenda não altera datas FSRS. Nenhuma chave de origem deve ser apagada durante a migração inicial.
