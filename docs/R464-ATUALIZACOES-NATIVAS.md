# DFL Finance R464 — Atualização Android sem navegador ou extração manual

Base: `9c7657592dff26baaa6d3c0c4d7a5e6fb080192b` (R463-R1).

## Contrato

1. A Action Android deve aprovar TypeScript, lint, gate V163, regressões R456–R464, export web, identidade e compilação nativa com keystore estável.
2. Somente após sucesso do job Android, o job `release` com `contents: write` isolado publica `DFL-Finance-<GITHUB_RUN_NUMBER>.apk` (não ZIP) em GitHub Releases. O checksum `.sha256` é publicado junto. O artifact tradicional `DFL-Finance-App` permanece como recuperação.
3. O aplicativo compara o `versionCode` Android com o número da Action, confirma `head_sha` da Action bem-sucedida igual ao `target_commitish` da release, nome, URL, bytes e digest SHA256 da asset da API GitHub. Nunca há token no APK.
4. A ponte nativa baixa por HTTPS sob host restrito, sem URL arbitrária de entrada e com limite de tamanho. O download vai para `getFilesDir()/dfl-apk-updates`, sem permissão de armazenamento externo.
5. Antes de instalar, o Android valida SHA256 novamente, pacote, versão superior e certificado de assinatura de APK. `FileProvider` dedicado e não exportado permite apenas leitura temporária pelo instalador do Android. O usuário precisa autorizar a instalação de origem desconhecida quando solicitado. Não há instalação silenciosa.
6. Se a release não existir, o app mantém a Action tradicional. PWA/navegador não recebe ponte nativa. A primeira versão com R464 deve ser instalada manualmente; só as seguintes usam o fluxo integrado.

## Riscos e limites

- `REQUEST_INSTALL_PACKAGES` exige autorização específica no dispositivo e não é apropriado para aplicativos distribuídos pela Play Store sem aderir às políticas de distribuição do Google. Este projeto usa APK fora da Play Store.
- Uma Action verde não demonstra que o sistema Android abrirá a instalação em todos os modelos. Homologar com aparelho real: consentimento, download, SHA, assinatura, troca de versão, dados intactos, fallback, estado offline, permissão negada e retorno do settings.
- O repositório é público e GitHub Releases expõe o APK publicamente. Se a política de distribuição mudar, não publicar o arquivo neste canal.
- Não há modificações no Supabase, no bot WhatsApp, na contabilidade ou nas permissões financeiras.
- Se a release não for publicada (por exemplo, bloqueio de `contents: write` nas configurações do GitHub), a job falha e não há oferta nativa. O artefato tradicional ainda pode ser baixado manualmente.
- A Action identifica o próprio artefato publicado após sua conclusão. O app nunca tenta instalar um build falho, com digest ausente ou de SHA divergente.

## Homologação de dois APKs

O APK R464 inaugura o bridge nativo. Para testar o fluxo do começo ao fim, é necessário um APK **subsequente** aprovado e publicado como nova versão (por exemplo, release de ajuste documental); não criar uma nova release sem mudança ou homologação apenas para aumentar o número. Instalar R464 pelo método manual, depois verificar próxima atualização real pelo botão da Central.
