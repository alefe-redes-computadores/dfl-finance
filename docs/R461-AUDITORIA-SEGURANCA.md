# DFL Finance R461 — Auditoria final de segurança e release

**Base obrigatória:** `189a016d42368ff31245c0319baf33bf05d9271e` (R460). **Estratégia:** macrocirurgia seletiva sem efeitos remotos até aprovação, seguida de homologação real.

## Alterações incluídas

- Preflight CORS limitado à origem nativa `https://localhost`; POST de OCR/importação continua a exigir Bearer JWT autenticado no Supabase.
- OCR aceita somente URL assinada na origem Supabase e na pasta UUID do usuário autenticado, com nome de arquivo de imagem previsto. Bucket `receipts` deve permanecer **privado**, com RLS de usuário; nada de `public=true`.
- Mensagens de erro interno da IA são genéricas na resposta ao cliente, mantendo logs técnicos restritos ao servidor.
- `robots.txt` Disallow e metadados/cabeçalhos `noindex`, `nofollow` para evitar indexar um produto financeiro. Isto **não substitui** autenticação ou RLS.
- Headers web básicos sem CSP arbitrária que quebre PWA, Supabase, WebView ou microfone. Build mobile não recebe `headers()` no output export.
- Console Eruda limitado ao ambiente de desenvolvimento; README/CHANGELOG/notas de atualização e tela 404. Nenhum script histórico, commit, dado de banco ou histórico financeiro é apagado.

## Supabase — diagnóstico, não mutação automática

- Projeto Finance saudável; o bucket `receipts` é privado e políticas de Storage para SELECT/INSERT/DELETE exigem primeira pasta igual a `auth.uid()`.
- Advisors apontaram `leaked password protection` desativada: habilitar manualmente em **Supabase Auth**, após verificar impactos em usuários existentes e testar login.
- Algumas rotinas `SECURITY DEFINER` comerciais são executáveis por `authenticated`. Leitura estática identificou consulta a `auth.uid()` e verificação de proprietário nas quatro rotinas operacionais, mas é necessário testar isolamentos e tentativas de acesso cruzado sem alterar privilégios cegamente.
- Há avisos sobre `pg_trgm` em `public`, índices de FK ausentes e índices sem uso. Não modificar extensões ou índices até existir plano de migração e medição de consultas, sem risco à produção.
- Tabelas server-only com RLS sem policy podem ser intencionais. Não criar policies genéricas.

## Checklist dos prints

**Proteções priorizadas:** chaves server-only, nenhum `.env` versionado, login/JWT, autorização por proprietário, RLS, buckets privados, debug reduzido, erros sem detalhes, limites de payload, validação de URL/arquivo, headers/CORS, testes negativos, CI e auditoria final. As APIs de IA ainda requerem avaliação de **rate limiting durável** (quota por usuário/serviço); não implementar limite em memória de Serverless que dê falsa garantia.

**SEO adaptado:** sem sitemap, indexação, Search Console, Google Analytics ou `schema.org` para registros financeiros. Metadados descritivos só para identificação no navegador/PWA; Open Graph público pode ser futuro produto de marketing separado. 404 útil, `robots.txt`, `noindex`, HTTPS e headers de segurança são adequados.

## Evidências/limites

A compilação e Jest certificam contratos estáticos/isolados, não prova autorização com dois usuários reais, desempenho do aparelho, envio WhatsApp e notificações com APK encerrado. Os erros do PWA e do backend precisam de telemetria controlada sem dados pessoais. Testar no Android: login, OCR com comprovante do próprio usuário, imagem alheia negada, importação, comandos, notificações, bloqueio de tela, assinatura, sincronização e atualização.

**Política de fechamento:** qualquer falha real gera correção específica; não abrir outra macrorefatoração sem evidência.
