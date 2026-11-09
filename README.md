# DFL Finance

Aplicativo financeiro **pessoal e empresarial**, local-first e mobile-first, com interface web/PWA (Next.js) e APK Android (Capacitor). Os dados operacionais do dispositivo residem em IndexedDB/Dexie e são reconciliados com Supabase por uma fila de sincronização; saldos e lançamentos exigem confirmação e tratamento de conflitos.

## Componentes atuais

- **Web:** Next.js 15 (App Router), React 19, Tailwind e Lucide; produção Vercel.
- **Android:** Capacitor 6 e exportação estática do mesmo código, sem incluir APIs Next dentro do APK.
- **Dados:** Dexie local + Supabase com autenticação e RLS. A chave `NEXT_PUBLIC_SUPABASE_ANON_KEY` é pública por natureza; credenciais privilegiadas jamais entram no cliente.
- **Integrações:** bot financeiro WhatsApp via Edge Function `whatsapp-webhook`, OCR/IA por APIs autenticadas no servidor, notificações locais Android.
- **Inteligência:** análises financeiras determinísticas, DFL Comando Turbo, conciliação e observações proativas.

## Estrutura

```text
src/app/(app)/                 Páginas autenticadas (Home, Busca, Inteligência, Finanças)
src/app/api/                   APIs web autenticadas (chat, OCR, importação)
src/lib/                      Motores financeiros, segurança, sync, utilitários
src/hooks/                    Hooks de dados locais e experiência
src/components/               Componentes de interface
supabase/functions/           Edge Functions (incluindo bot)
supabase/migrations/          Migrações de banco
scripts/                      Gates de regressão e build Android
.github/workflows/android-build.yml  CI / APK
```

## Desenvolvimento

```bash
npm ci
npm run typecheck
npm run lint
npm run mobile:check
node node_modules/jest/bin/jest.js --config scripts/jest-r449-global.cjs --runInBand
```

Use **Node compatível com a versão instalada** e configure `.env.local` diretamente no dispositivo/ambiente de execução. Nunca publique `.env.local`, tokens, `GEMINI_API_KEY`, `service_role`, dumps ou dados financeiros no Git. `NEXT_PUBLIC_` só deve conter valores intencionalmente públicos.

`npm run dev` inicia a versão web local; `npm run build:mobile` gera o export Capacitor com o servidor web configurado em `NEXT_PUBLIC_DFL_SERVER_ORIGIN`.

## Publicação segura

O GitHub `main` e a Action Android são a autoridade de versão. Cada cirurgia é validada em instalação local, com **backup seletivo e rollback**, antes de um `publicar.sh` separado. Publicar apenas arquivos explicitamente aprovados (não usar `git add .`/`git add -A`). Confirmar SHA do commit, Action `success`, artefato `DFL-Finance-App`, expiração e deploy Vercel READY antes da homologação.

A Central de Atualizações mostra o número de build instalado e a versão certificada. Veja [CHANGELOG.md](CHANGELOG.md) e as notas no app. O `version` de `package.json` é um metadado interno de pacote e **não** substitui `versionCode` Android.

## Privacidade e segurança

O Finance contém dados privados: não publica sitemap de registros e bloqueia indexação. A autorização real depende do servidor e de RLS; esconder menus não é controle de acesso. Os comprovantes ficam em **bucket privado**, com URLs assinadas e pasta por proprietário. O aplicativo não deve oferecer envio de dinheiro, publicação de dados ou instalação silenciosa sem confirmação explícita.

Para revisão dos controles e pendências operacionais, consulte `docs/R461-AUDITORIA-SEGURANCA.md`. O bot financeiro permanece independente dos módulos de mensageria Site/Entregas.

## Homologação real do APK

Verificar a alternância Empresa/Pessoal, conciliação e saldos, pesquisa, alertas com o Android bloqueado/fechado, OCR de imagem e importação PDF/OFX, offline/online, atualização do APK e bot WhatsApp. **Não apagar o IndexedDB nem realizar lançamentos financeiros reais exclusivamente para testar.**


## R462 — Integridade do ledger comercial

- Alocações usam `dfl_commercial_allocate_idempotent` (RPC existente): a tentativa é preservada na instalação local até confirmação do servidor. Se a resposta se perder, reabra o ledger e use **Retomar / confirmar tentativa anterior** antes de criar qualquer outra alocação.
- O resumo usa paginação por UUID e verifica a contagem das páginas; leituras parciais ou com volume excessivo bloqueiam indicadores e operações. O carregamento **não é uma transação com snapshot simultâneo**; para auditoria concorrente de alta escala, utilizar agregação transacional no servidor após homologação específica.
- Os nomes físicos de novos comprovantes seguem o MIME aceito. Arquivos JPEG/JFIF antigos continuam elegíveis para OCR somente por URL assinada e propriedade autenticada.
- Nenhuma atualização da R462 muda o webhook financeiro ou movimenta contas; atualizações Android continuam manuais e exigem Action aprovada.
