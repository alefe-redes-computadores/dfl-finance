# DFL Finance — R428 / Candidato de homologação premium

**Objetivo:** terminar a sequência de cirurgias preventivas R417–R428 e validar o APK real antes de continuar criando funcionalidades.

## Testes no APK (na ordem)

1. Verificar que o APK foi gerado pelo GitHub Actions para **o SHA da R428** e concluir a instalação de teste.
2. Na **Home Empresa**, observar por alguns segundos a barra do DFL Comando, trilha luminosa e insight; verificar se não cobrem os controles.
3. Mudar para **Pessoal** e verificar que a busca/insights não mostram valores ou dados da Empresa.
4. Abrir Busca e comandar; pesquisar **"Nubank"**, **"cartões do Nubank"**, **"despesas do Nubank"**; conferir resultado, ordenação, filtros rápidos e refinamento.
5. Digitar **"nova despesa"**; deve mostrar a ação para abrir o formulário completo, sem busca de dados locais nem mensagem "Nada por aqui". Tocar e **revisar**; não registrar automaticamente.
6. Verificar **"transferir entre contas"**, **"nova receita"**, **"registrar despesa"**. Ação deve ser explicitamente tocada.
7. Abrir **filtros avançados**, selecionar e limpar, fechar com Escape/voltar quando aplicável. Verificar teclado Android e safe area.
8. Tocar o **microfone da barra** e conferir reconhecimento em um toque. Cancelar sem deixar transcrição antiga. Comandos financeiros passam por revisão antes de qualquer gravação.
9. Se habilitado em preferências, testar o **DFL Comando flutuante** e fechar o modal sem travamentos.
10. Fixar/desafixar favoritos, expandir/recolher a central, navegar e voltar; preservar visual premium e fluidez.
11. Abrir **Extrato, Cartões, Análises e Planejamento**, conferir se os atalhos contextuais são pertinentes e se a barra não prejudica a rolagem.
12. Desligar a rede e repetir navegação/busca local compatível; verificar mensagens claras e nenhuma alteração financeira involuntária.

## Gate de fechamento

- `npm run typecheck`, `npm run lint`, R411–R428 e gates de aplicativo precisam passar no Termux e na Action.
- **Bot V2 permanece OFF.** Nenhum deploy ou migração no Supabase faz parte da R428.
- **Sem liberar como publicação ampla** antes de testar o APK e conferir dados/reconciliação no dispositivo.
- Em caso de erro visual no APK, registrar tela, caminho e passos de reprodução; preferir um único reparo consolidado, não uma nova sequência indefinida.
