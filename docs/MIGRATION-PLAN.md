# Migração — Ritmo 7.1 para 8.0

A branch `main` permanece como versão publicada/legada. A refatoração React/TypeScript é desenvolvida isoladamente em `refactor/ritmo-8`.

Fontes legadas: `ritmo-notion-v7`, `ritmo-notion-v6`, `ritmo-notion-v5`.

## Salvaguardas e conversão atual
- Abrir IndexedDB `ritmo-8`, versão 2.
- Ler as chaves antigas sem removê-las.
- Normalizar versões 5/6/7 e validar o banco antes de importar.
- Gravar uma cópia integral em `appState/legacy-v7-snapshot`.
- Importar conceitos e versões, estado FSRS, revisões, erros, blocos, sessões e planos para stores próprios.
- Preservar IDs, estatísticas das variantes, referências, estados FSRS, histórico de erro e atribuições de cronograma.
- A importação é idempotente; `legacy-data-import` guarda o status e as contagens.
- Manter localStorage intacto como fonte de recuperação.
- `planDraft`, configurações auxiliares e dados não mapeados continuam preservados no snapshot.
- Backup exporta todos os stores e oferece mesclagem ou substituição no IndexedDB; a cópia antiga no localStorage não é apagada.

## Validações antes de publicar
1. Testar com cópia anonimizada de cada versão de origem.
2. Comparar contagens de conceitos, variantes, revisões, erros, blocos, sessões e planos.
3. Conferir imagens e máscaras, respostas digitadas, referências e URLs.
4. Conferir os estados FSRS antes/depois sem recalcular nenhum cartão.
5. Conferir datas e histórico do caderno de erros.
6. Testar migração repetida, interrupção, backup, mesclagem e recuperação.
7. Só depois do aceite, liberar o uso diário e preparar publicação.

A agenda semanal não altera datas FSRS. Nenhuma chave de origem deve ser apagada durante a migração inicial.
