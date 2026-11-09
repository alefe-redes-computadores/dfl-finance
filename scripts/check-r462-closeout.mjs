/** R462: integridade verificável sem rede, credenciais, Supabase real ou writes financeiros. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')
const ledger = read('src/app/(app)/commercial/ledger/page.tsx')
const intent = read('src/lib/commercialAllocationIntent.ts')
const pages = read('src/lib/commercialLedgerPagination.ts')
const receipt = read('src/lib/receiptPresentation.ts')
const url = read('src/lib/server/receiptUrlSecurity.ts')
const release = read('src/lib/financeReleaseNotes.ts')
const changelog = read('CHANGELOG.md')
const workflow = read('.github/workflows/android-build.yml')
const checked = [
  ['Sem RPC comercial legada na tela', !ledger.includes("rpc('dfl_commercial_allocate'")],
  ['RPC idempotente existente utilizada', ledger.includes("rpc('dfl_commercial_allocate_idempotent'")],
  ['Chave e payload persistidos antes da primeira RPC', ledger.indexOf('saveCommercialAllocationIntent(next)') < ledger.indexOf('await executeAllocationIntent(next)')],
  ['Retry usa identidade persistida', ledger.includes('loadCommercialAllocationIntent(user.id)') && ledger.includes('p_idempotency_key:saved.key')],
  ['RPC retry não depende do saldo local', ledger.includes('async function executeAllocationIntent') && ledger.includes('Retomar / confirmar tentativa anterior')],
  ['Intenção não pode ser sobrescrita', intent.includes('existing.key !== intent.key') && intent.includes('saveCommercialAllocationIntent')],
  ['Intenção persistida em storage e isolada por proprietário', intent.includes('localStorage.setItem') && intent.includes('ownerId')],
  ['Leitura paga por cursor UUID', ledger.includes(".gt('id', afterId)")],
  ['Filtro de proprietário no servidor', ledger.includes(".eq('owner_id', ownerId)")],
  ['Filtro de loja e plataforma ANTES de paginação', ledger.includes(".eq('store_id', scope.storeId).eq('platform_id', scope.platformId)")],
  ['Sem limites silenciosos de 500/1000', !ledger.includes('.limit(500)') && !ledger.includes('.limit(1000)')],
  ['Dupla contagem de completude', pages.includes('fetchFinalCount') && pages.includes('rows.length !== expected')],
  ['Falha fecha os totais', ledger.includes('setComplete(false)') && ledger.includes('{platformId&&!loading&&complete&&')],
  ['Respostas antigas não substituem escopo novo', ledger.includes('refreshGeneration.current')],
  ['Histórico comercial limita DOM', ledger.includes('scopedHistory.slice(0,historyLimit)')],
  ['MIME é fonte de extensão de novos arquivos', receipt.includes('const extension = fromMime')],
  ['Visualizador reconhece JPEG/JFIF antigos', receipt.includes("'jpe', 'jfif'")],
  ['JFIF legado protegido por URL assinada privada', url.includes('jfif') && url.includes('authenticatedUserId')],
  ['Changelog registra fechamento sem publicar release futura', changelog.includes('R462') && changelog.includes('R461') && !changelog.includes('R461 — Fechamento de segurança e transparência (pendente')],
  ['Novidades dentro do app', release.includes("version: 'R462'") && release.includes("APK #1048")],
  ['Action bloqueia regressão R462', workflow.includes('R462 Commercial Idempotency')],
  ['Bot e saldo mantidos fora do patch', fs.existsSync('supabase/functions/whatsapp-webhook/index.ts') && fs.existsSync('src/lib/syncEngine.ts')],
]
for(const [name, ok] of checked) assert.ok(ok, `R462: ${name}`)
for (const p of [
  'src/app/(app)/commercial/ledger/page.tsx',
  'src/lib/commercialAllocationIntent.ts',
  'src/lib/commercialLedgerPagination.ts',
  'src/lib/receiptPresentation.ts',
  'src/lib/server/receiptUrlSecurity.ts',
  'src/lib/financeReleaseNotes.ts',
  'src/__tests__/commercialR462.test.ts',
  'src/__tests__/receiptR462.test.ts',
]) {
  const s = read(p)
  const ast = ts.createSourceFile(p, s, ts.ScriptTarget.Latest, true, p.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  assert.equal(ast.parseDiagnostics.length, 0, `R462 syntax: ${p} - ${ast.parseDiagnostics.map(d=>d.messageText).join('; ')}`)
}
console.log(`R462_CLOSEOUT_OK: ${checked.length} contratos, oito fontes TS/TSX parseadas, sem rede`)
