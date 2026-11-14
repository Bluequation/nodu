# Checklist de liberação — Ritmo 8.0

A versão 8.0 não deve substituir a versão publicada enquanto os itens abaixo não forem aprovados.

## Validação automatizada
- [x] TypeScript sem erros.
- [x] Testes unitários do domínio, FSRS, importação, migração e backup.
- [x] Build de produção.
- [ ] Testes de interface em navegador real (desktop e celular).

## Validação funcional
- [ ] Criar plano com concurso, cargo e área específica.
- [ ] Ler edital PDF textual e confirmar o conteúdo extraído.
- [ ] Importar verticalização Markdown e conferir referências, trechos e alertas.
- [ ] Confirmar sugestões desmarcadas e seleção por seção.
- [ ] Sair e retornar ao onboarding sem perder seleção.
- [ ] Gerar cronograma, alterar dias e mover tópicos.
- [ ] Importar JSON e CSV de flashcards; confirmar rascunhos na Curadoria.
- [ ] Aprovar, rejeitar, editar e publicar versões com fonte.
- [ ] Revisar cartões e conferir intervalos FSRS e rotação de versões.
- [ ] Registrar erro, aplicar nova questão e conferir o ciclo próprio do caderno.
- [ ] Registrar blocos de questões.
- [ ] Testar as quatro técnicas de aprendizagem sem alterar FSRS.
- [ ] Baixar backup, mesclar e substituir em ambiente descartável.

## Migração de dados
- [ ] Usar uma cópia anonimizada do banco 7.1.
- [ ] Comparar contagens e IDs antes/depois.
- [ ] Conferir imagens/máscaras e histórico de revisões.
- [ ] Conferir estados FSRS sem recalcular cartões.
- [ ] Testar interrupção e repetição da migração.

## Publicação
- [ ] Criar preview separado, sem substituir o endereço atual.
- [ ] Fazer a rodada de teste com a usuária.
- [ ] Corrigir os problemas encontrados e repetir as verificações.
- [ ] Só então avaliar a substituição da versão publicada.

**Estado atual:** CI aprovado (typecheck, 24 testes unitários e build). A validação visual e a migração com dados reais ainda não foram aprovadas.
