/** R463 — certificação estática do acabamento; não substitui homologação visual Android. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = (path) => fs.readFileSync(path, 'utf8')
let n = 0
function check(name, cond) { assert.ok(cond, `R463: ${name}`); n++ }
const paths = [
  'src/app/(app)/transactions/page.tsx',
  'src/app/(app)/home/page.tsx',
  'src/app/(app)/transactions/new/page.tsx',
  'src/app/(app)/more/page.tsx',
  'src/app/(app)/analysis/page.tsx',
  'src/components/dashboard/ComparisonChart.tsx',
  'src/components/dashboard/ProjectionChart.tsx',
  'src/components/dashboard/CategoryPie.tsx',
  'src/lib/financeReleaseNotes.ts',
  'src/__tests__/r463PremiumUi.test.ts',
]
for (const path of paths) {
  const syntax = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  check(`Sintaxe ${path}`, syntax.parseDiagnostics.length === 0)
}
const tx = read(paths[0])
check('Topo das transações participa da rolagem normal', tx.includes('data-r463-scroll="normal"') && !tx.includes('className="sticky top-0 z-40'))
for (const item of ['<ContextualCommandBar scope="transactions" />','<ContextToggle />', 'transaction-search-status','handleExport(opt.key)','quickFilter === \'pending\'','<PendingCard','<TransactionsSkeleton']) check(`Transações preserva ${item}`,tx.includes(item))
check('Scroll de página continua no layout',read('src/app/(app)/layout.tsx').includes('h-[100dvh] overflow-y-auto'))
const home=read(paths[1])
for (const item of ['data-r463-balance="compact"','setHideBalance(!hideBalance)','totalAccountsBalance','balanceVerifiedAt','router.push(\'/transactions\')']) check(`Home preserva ${item}`,home.includes(item))
const nova=read(paths[2])
for (const item of ['pb-[max(1.25rem,var(--safe-area-bottom))]','handleSave()','disabled={isSubmitting || uploading}','<MoneyInput','<ContextToggle />','setShowQRScanner(true)','setShowReceiptModal(true)']) check(`Formulário preserva ${item}`,nova.includes(item))
const more=read(paths[3]);check('Mais compactado sem moldura duplicada',more.includes('data-r463-menu="compact"')&&!more.includes('rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2 space-y-1'))
for(const path of ['/commercial','/conciliation','/updates','/notifications','/data-safety'])check(`Mais preserva ${path}`,more.includes(`href="${path}"`))
const analysis=read(paths[4]);check('Análise compacta',analysis.includes('data-r463-analysis="compact"'))
for (const key of ['metrics.kpis.burnRate','metrics.kpis.runway','metrics.consolidated.totalBalance','<ComparisonChart data={metrics.comparisonChart} />','<ProjectionChart data={metrics.projections} />']) check(`Análise preserva ${key}`,analysis.includes(key))
const comparison=read(paths[5]);check('Gráfico vazio não inventa dados',comparison.includes('const hasValues =')&&comparison.includes('Sem receitas ou despesas para comparar'))
const projection=read(paths[6]);check('Eixo da projeção não está cortado',projection.includes('formatAxisCurrency')&&projection.includes('width={72}')&&projection.includes('left: 0'))
const pie=read(paths[7]);check('Distribuição vazia preserva mensagem',pie.includes('Nenhuma distribuição registrada.'))
const notes=read(paths[8]);check('Changelog in-app R463 antes da R462',notes.indexOf("version: 'R463'") < notes.indexOf("version: 'R462'"))
const changelog=read('CHANGELOG.md');check('Changelog de repositório',changelog.includes('## R463')&&changelog.includes('## R462'))
const workflow=read('.github/workflows/android-build.yml')
check('R463 registrado na Action Android',workflow.includes('node scripts/check-r463-premium-ui.mjs')&&workflow.includes('r463PremiumUi.test.ts'))
for(const r of ['check-r462-closeout.mjs','check-r461-final-security.mjs','check-r460-search-turbo.mjs'])check(`Gate anterior preservado ${r}`,workflow.includes(r))
check('Bot e ledger não fazem parte dos caminhos modificados',fs.existsSync('supabase/functions/whatsapp-webhook/index.ts')&&fs.existsSync('src/app/(app)/commercial/ledger/page.tsx'))
console.log(`R463_PREMIUM_UI_OK: ${n} contratos de estrutura, navegação e compatibilidade`)
