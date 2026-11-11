# R467 — DFL Finance: Atualização 360

Base: R466 `187e5fa540ae17d6e019533e1853083d045484ed`.

## Mudanças

- Notificação nativa de nova release, opt-in explícito **por dispositivo** na Central de Atualizações; somente após o Finance descobrir uma release certificada com build superior. Deduplicação por build persistida. Notificação abre `/updates` via listener nativo existente. Sem push remoto e sem consulta permanente com o aplicativo fechado.
- O aviso não usa dados financeiros, não altera preferências do usuário no Supabase e não interfere nos lembretes financeiros. Permissão de notificação solicitada somente ao ativar.
- Progresso do download mostra % e MB. Botão **Cancelar download** requisita cancelamento na ponte Android. A leitura é interrompida em ponto de verificação, parcial descartado e não se abre o instalador após cancelamento. Em rede bloqueada, o efeito pode aguardar timeout de leitura de até 30s.
- Mantido download a partir do GitHub Releases aprovado, SHA-256, pacote, versão, assinatura, FileProvider privado, consentimento e retomada R466.
- A primeira atualização R466 → R467 ainda usa o mecanismo de download R466; o cancelamento R467 só existe ao usar APK que já o contenha. Validar em release posterior com teste real.

## Não incluído

Nenhuma alteração em banco, Supabase, bot, WhatsApp, Auth, ledger, saldos, notificações financeiras ou assinatura de APK. Não há instalação silenciosa nem solicitação automática de permissão.

## Gates

- `npm run typecheck`
- `npm run lint`
- `node scripts/check-r464-native-updater.mjs`
- `node scripts/check-r466-native-resume.mjs`
- `node scripts/check-r467-updates.mjs`
- Jest isolado com `scripts/jest-r449-global.cjs`
- `npm run mobile:check`

Publicação seletiva separada, após aprovação local. Teste real no Android ainda necessário.
