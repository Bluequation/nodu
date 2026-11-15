# Ritmo 9 — Primeiro protótipo vertical

Branch: feat/ritmo-9-first-workspace  
Status: implementação inicial para validação funcional e visual.

## Escopo desta fatia

### Shell
- Navegação principal: Hoje, Meu espaço, Planejar, Estudar e Desempenho.
- Sidebar recolhível no desktop.
- Navegação inferior no celular.
- Criação rápida de página.

### Meu espaço
- Listagem de páginas recentes.
- Criação de página livre ou vinculada a um assunto selecionado de um plano.
- Editor em blocos BlockNote com locale pt-BR.
- Salvamento automático local do título e do documento em JSON versionado.
- Estado de salvamento visível.

### Planejar
- Lista de planos e criação de plano.
- Reutilização das telas existentes de verticalização, cronograma e agenda.

### Estudar
- Acesso às ferramentas atuais de aprendizagem, flashcards, revisões e caderno de erros.
- Página de estudo vinculada a plano/assunto.
- Início e encerramento explícitos de sessão.
- Registro de questão individual com resposta, gabarito, fonte, explicação e tempo opcional.
- Tentativa ligada à sessão ativa, quando houver.
- Erro criado automaticamente a partir de resposta incorreta.
- Gravação atômica de questão, tentativa e erro em uma transação IndexedDB.

### Desempenho
- Precisão baseada em tentativas individuais.
- Agrupamento por assunto do edital.
- Tempo medido somente a partir de sessões encerradas.
- Indicador de amostra pequena para menos de cinco tentativas.
- Separação explícita entre precisão em questões, revisões FSRS e reaplicações do caderno.

## Persistência

A versão de protótipo estende o IndexedDB existente ritmo-8 da versão 2 para a versão 3, criando stores para páginas, questões, tentativas e sessões. O nome do banco é mantido temporariamente para evitar copiar ou apagar a base local durante a prova de conceito. A migração definitiva para o esquema Ritmo 9 será uma etapa separada, com snapshot, dry-run e relatório.

## Dependências

- BlockNote 0.57.0
- Mantine 9.8.x (integração visual do BlockNote)
- React 19 + TypeScript + Vite

A dependência do editor é isolada da camada de dados. O conteúdo persistido usa JSON versionado; o modelo do editor não substitui as entidades de aprendizagem.

## Critérios de validação manual

1. Criar plano, importar/verticalizar edital e selecionar um assunto.
2. Criar página vinculada ao assunto.
3. Escrever, inserir título, lista, checklist e tabela.
4. Atualizar a página e confirmar que o conteúdo permanece.
5. Iniciar e encerrar sessão; confirmar duração.
6. Registrar questão correta e incorreta.
7. Confirmar que a tentativa incorreta cria erro com a questão e o assunto já vinculados.
8. Abrir o caderno de erros e localizar o novo registro.
9. Conferir precisão e volume na tela Desempenho.
10. Repetir em 390 px e 1440 px, sem rolagem horizontal da página.

## Limitações conhecidas desta etapa

- Não há sincronização em nuvem ou multi-dispositivo.
- Ainda não há banco de questões separado com filtros avançados.
- Questões são registradas no contexto da página; uma biblioteca global e visualizações vinculadas serão construídas depois.
- O tempo é medido por sessão iniciada e encerrada explicitamente; não é inferido a partir do tempo de aba aberta.
- A página suporta blocos padrão do BlockNote; blocos de dados incorporados e propriedades avançadas ainda não foram adicionados.
- O visual é um protótipo funcional, ainda sujeito à aprovação da usuária.
