# Arquitetura — Ritmo 8.0

- React + TypeScript + Vite.
- Refatoração estrutural em branch independente.
- IndexedDB como persistência principal; migração não destrutiva do localStorage.
- React Router; Zustand somente quando estado compartilhado for necessário.
- CSS próprio e identidade visual do Ritmo.
- Aplicação local-first, sem dependência obrigatória de IA, API ou nuvem.

Camadas: app (rotas/shell), features (fluxos), domain (modelos e regras puras), data (repositórios, armazenamento e migração), shared (componentes e estilos).

A interface não implementa FSRS. A agenda agrega atividades sem recalcular FSRS. Tópicos, questões, cartões e erros devem relacionar-se por IDs estáveis. As fontes legadas nunca são apagadas durante a migração inicial.

Banco inicial: `ritmo-8`, IndexedDB versão 1; object stores `appState` e `plans`.
