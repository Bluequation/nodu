# Ritmo 9 — Mapa de navegação e telas

Status: proposta para validação  
Princípio: poucas áreas principais, conteúdo flexível e ações contextuais.

## 1. Shell global

### Desktop
- Sidebar recolhível, persistente e com navegação principal.
- Cabeçalho superior compacto com breadcrumb/contexto, busca global e criação rápida.
- Área central sem cartões decorativos obrigatórios.
- Painéis laterais contextuais somente quando agregarem informação (propriedades, detalhes, relações).
- Navegação não deve ocupar largura excessiva nem empurrar o conteúdo.

### Mobile
- Barra inferior com Hoje, Meu espaço, Planejar, Estudar e Desempenho.
- Sidebar substituída por drawer.
- Ações primárias acessíveis com uma mão.
- Tabelas adaptadas para lista ou rolagem interna, nunca rolagem lateral da página.
- Edição de bloco e campos com controles adequados ao teclado do dispositivo.

### Recursos transversais
- Busca global por página, plano, assunto, questão, erro e flashcard.
- Criar rápido: página, tarefa, questão, erro, sessão, flashcard.
- Breadcrumbs e retorno ao contexto anterior.
- Estado de salvamento discreto: salvando, salvo, offline ou falha.
- Atalhos de teclado no desktop, sem tornar a operação dependente deles.

## 2. Hoje

Objetivo: transformar o sistema em próxima ação clara.

Seções:
1. Saudação e data, sem hero ou banner excessivo.
2. “Continuar de onde parei”: última página, sessão ou plano.
3. Agenda de hoje: horários e tarefas, com duração estimada.
4. Revisões vencidas: flashcards e erros em filas separadas.
5. Prioridade sugerida: no máximo uma ou duas recomendações explicadas.
6. Resumo compacto da semana: planejado x realizado.
7. Captura rápida de atividade.

A tela não deve ser um painel de 15 indicadores. O foco é ação; análise detalhada fica em Desempenho.

## 3. Meu espaço

### Árvore lateral
- Favoritos.
- Recentes.
- Planos.
- Páginas.
- Bancos e coleções.
- Materiais e arquivos.

A árvore pode ser recolhida e não deve obrigar uma hierarquia profunda.

### Página de estudo
- Título editável no local.
- Ícone opcional.
- Propriedades discretas e recolhíveis.
- Corpo em blocos, com espaço de escrita amplo.
- Inserção por comando contextual, menu de bloco ou botão de adicionar.
- Relações com planos e assuntos.
- Materiais incorporados por referência, não por cópia.
- Histórico e comentários ficam fora do caminho principal até serem necessários.

### Bancos de dados
Uma mesma coleção suporta visualizações de tabela, lista, quadro e calendário quando compatíveis. Filtros, ordenação, agrupamento e propriedades não duplicam registros.

Tipos iniciais de banco:
- Questões.
- Caderno de erros.
- Flashcards/conhecimentos.
- Tarefas e sessões.
- Materiais.

A pessoa pode criar visualizações vinculadas dentro de páginas. A mesma questão pode aparecer em “Banco de questões”, “Física” e “Plano SEDUC” sem ser copiada.

## 4. Planejar

### Meus planos
Galeria ou lista compacta com status, cargo/área, data da prova, progresso de organização e próxima sessão.

### Criar plano
Fluxo curto:
1. Concurso/instituição.
2. Cargo.
3. Área/recorte.
4. Banca e data, se conhecidas.
5. Edital ou inclusão posterior.

Não obrigar a preencher dados desconhecidos.

### Edital e verticalização
- Documento e origem.
- Árvore hierárquica fiel ao texto.
- Itens literais, sugestões e itens manuais claramente diferenciados.
- Seleção e edição sem misturar cargos ou áreas.
- Referência e texto original acessíveis.

### Cronograma
- Biblioteca de assuntos selecionados.
- Semana e dias disponíveis.
- Distribuição arrastável e editável.
- Horários e estimativas separados de execução real.
- Nenhum item fictício ou mudança silenciosa do edital.

### Agenda
- Visualização mensal, semanal e diária.
- Filtro por plano.
- Eventos de estudo, simulado, tarefa e revisão com semânticas distintas.
- Conclusão datada e histórico.
- Não misturar revisões FSRS com tarefas comuns sem identificação.

## 5. Estudar

### Mesa de estudo
Contexto visível: plano, disciplina, assunto e objetivo da sessão.
Ações: iniciar sessão, abrir material, responder questões, criar anotação, registrar dificuldade.

### Questões
- Banco com filtros.
- Questão individual e resposta.
- Explicação e fonte.
- Registro da tentativa, tempo e confiança quando disponíveis.
- Resultado e próxima ação.
- Criar erro a partir da tentativa sem redigitar informações.

### Caderno de erros
- Visualização inicial em tabela limpa, com edição direta.
- Filtros por plano, disciplina, assunto, causa, estado e revisão.
- Detalhe em painel lateral ou página, sem empilhar caixas.
- Histórico de reaplicações.
- Anexos e fontes.
- Retomar erro e registrar nova questão/aplicação.

### Flashcards e revisões
- Biblioteca de famílias e variantes.
- Curadoria e publicação.
- Sessão FSRS com intervalos reais.
- Histórico de revisão.
- Contexto por assunto/plano.
- Não confundir avaliação FSRS com domínio do erro.

### Aprender
- Recuperação livre.
- Autoexplicação.
- Retomada de erros.
- Prática intercalada.
- Histórico de sessões.
- Somente materiais existentes ou criados pelo estudante, salvo integração externa explícita.

## 6. Desempenho

### Visão geral
- Precisão global com denominador e período.
- Questões respondidas.
- Tempo medido.
- Sessões realizadas.
- Revisões e erros pendentes.
- Tendência em relação ao período anterior, quando comparável.

### Por plano
- Cobertura do edital: selecionado, estudado e praticado.
- Progresso do cronograma.
- Precisão por disciplina e assunto.
- Questões respondidas e tamanho da amostra.
- Tempo investido.
- Próximas prioridades.

### Por disciplina/assunto
- Evolução temporal.
- Precisão e volume.
- Tipos de erro recorrentes.
- Fontes e bancas.
- Último estudo e próxima revisão.
- Materiais relacionados.

### Análise de questões
- Acertos/erros por banca, prova, ano, dificuldade e assunto.
- Tempo por questão, se medido.
- Confiança x resultado, se coletada.
- Filtros combináveis.

### Retenção e recuperação
- FSRS e revisões previstas.
- Erros reaplicados.
- Persistência ou superação de dificuldades.
- Separação clara entre memória, resolução de questões e autoavaliação.

### Recomendações
Lista curta e explicável. Cada item informa por que apareceu, quais dados foram usados e qual ação pode ser feita.

## 7. Fluxos essenciais

### Fluxo A — questão → erro → análise
1. Responder questão.
2. Registrar tentativa.
3. Se errar, criar ErrorRecord com os dados da tentativa.
4. Relacionar ao assunto do plano.
5. Agendar retomada.
6. Atualizar precisão e padrão de erro.
7. Mostrar prioridade em Hoje.

### Fluxo B — edital → assunto → página → sessão
1. Abrir um PlanNode.
2. Criar página vinculada.
3. Inserir notas e materiais.
4. Iniciar sessão a partir da página.
5. Registrar duração real.
6. Atualizar cobertura e histórico do assunto.

### Fluxo C — plano → cronograma → execução
1. Selecionar tópicos.
2. Distribuir no cronograma.
3. Gerar tarefas datadas.
4. Iniciar/encerrar sessão.
5. Comparar planejado x realizado.
6. Reprogramar sem apagar histórico.

### Fluxo D — flashcard → FSRS → retenção
1. Criar/importar família.
2. Revisar curadoria.
3. Publicar variantes aprovadas.
4. Realizar revisão.
5. Registrar ReviewLog e atualizar FSRS.
6. Exibir retenção separada de precisão em questões.

## 8. Critérios de validação de telas

- Cada tela tem uma tarefa principal clara.
- Evitar card dentro de card e painéis aninhados.
- A pessoa consegue editar no contexto.
- A tela não repete informação já visível no breadcrumb, título ou propriedade.
- Estados vazios oferecem uma ação útil e não parecem erro.
- Carregamento, falha, vazio e offline têm estados próprios.
- A versão mobile não é apenas a desktop espremida.
