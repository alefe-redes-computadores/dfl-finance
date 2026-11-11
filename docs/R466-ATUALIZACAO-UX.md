DFL FINANCE R466 — UX DE ATUALIZACAO NATIVA

O que muda:
- ao voltar das configuracoes Android, continua a instalacao UMA vez;
- nenhum download duplicado;
- botoes de autorizar, instalar e baixar nao competem no mesmo estado;
- conferencia nativa do APK e confirmacao Android inalteradas.

O que NAO muda:
- assinatura, SHA-256, FileProvider, Java do atualizador, Supabase,
  bot financeiro, saldos, transacoes, dados financeiros ou configuracoes.

INSTALACAO:
  cd ~/storage/downloads
  unzip -o DFL-FINANCE-R466-UX.zip
  bash DFL-FINANCE-R466-UX/instalar.sh

PUBLICACAO (somente depois de R466_APROVADA_LOCALMENTE):
  bash ~/storage/downloads/DFL-FINANCE-R466-UX/publicar.sh

NOTA IMPORTANTE: APK com R466 so usara o novo fluxo na atualizacao
seguinte. Da R465 para R466, a tela antiga do APK atual continua em uso.
O teste definitivo do retorno automatico precisa de um APK posterior.
