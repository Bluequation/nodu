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
- React + TypeScript + Vite.
- IndexedDB local-first.
- Fluxo guiado de plano: identificação, verticalização assistida por Markdown, seleção por seções e cronograma semanal.
- A IA é opcional e externa nesta etapa; não há API key embutida no app.
- A cópia legada fica preservada em snapshot, sem apagar localStorage.
- Flashcards, FSRS, questões e caderno de erros ainda precisam ser integrados e validados antes da migração final.

Não configure GitHub Pages para a branch de desenvolvimento até a versão de teste estar aprovada.
