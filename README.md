# Nodu — Ritmo

Aplicativo de estudos. A branch `main` preserva a interface legada 7.1. A refatoração React/TypeScript está em desenvolvimento na branch `refactor/ritmo-8`.

## Rodar localmente
```bash
npm install
npm run dev
```

Verificações:
```bash
npm run typecheck
npm test
npm run build
```

## Estado da versão 8.0
- React + TypeScript + Vite, com IndexedDB local-first.
- Plano guiado: identificação, verticalização assistida por Markdown, seleção por seções e cronograma semanal.
- Flashcards em famílias de até dez versões, com importação JSON/CSV, curadoria e sessão FSRS-6.
- Caderno de erros, registro de blocos de questões e atividades de aprendizagem ativa.
- Ajustes FSRS e backup/restauração local.
- A IA é opcional e externa na verticalização e na elaboração de cartões; não há API key embutida no app.
- Dados legados 7.1 são copiados para snapshot e importados por stores sem apagar o localStorage.
- Biblioteca compartilhável e validação final da migração com dados reais anonimizados ainda precisam ser concluídas antes da publicação.

Não configure GitHub Pages para a branch de desenvolvimento até a versão de teste estar aprovada.
