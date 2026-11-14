# Migração — Ritmo 7.1 para 8.0

A branch `main` permanece intacta. A nova aplicação é construída em `refactor/ritmo-8`.

Fontes legadas: `ritmo-notion-v7`, `ritmo-notion-v6`, `ritmo-notion-v5`.

Etapas: abrir IndexedDB; verificar snapshot; ler as chaves antigas sem removê-las; aplicar migrações existentes; validar campos; gravar snapshot e metadados; preservar localStorage como recuperação.

Critérios: nenhuma chave apagada; conferir totais de conceitos, revisões, questões, erros, planos e sessões; preservar imagens e máscaras; migração idempotente; testar equivalência FSRS antes de migrar o motor; agenda não altera datas FSRS; publicar somente após regressão e aceite da usuária.
