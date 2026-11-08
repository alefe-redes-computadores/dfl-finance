import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read = path => fs.readFileSync(path, 'utf-8')
const paths = [
  'src/lib/proactiveObservations.ts',
  'src/app/(app)/intelligence-center/observations/page.tsx',
  'src/__tests__/proactiveObservations.test.ts',
  'src/lib/userSettings.ts',
  'src/app/(app)/intelligence-center/page.tsx',
  'src/app/(app)/home/page.tsx',
  'src/app/(app)/more/page.tsx',
]
for(const path of paths){
  const syntax = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  assert.equal(syntax.parseDiagnostics.length,0,`${path}: erro de sintaxe`)
}
const rules=read(paths[0]),page=read(paths[1]),prefs=read(paths[3]),center=read(paths[4]),home=read(paths[5]),more=read(paths[6]),wf=read('.github/workflows/android-build.yml')
const checks=[
 ['Fonte V54+ oficial',rules.includes('FinancialIntelligenceOutput')&&rules.includes('intelligence.insights')],
 ['Fonte V175 oficial',rules.includes('MonthlyReview')&&rules.includes('lastClosed.expenseVariation')],
 ['Dedupe contexto e período',rules.includes('`${context}:engine:${current.month}:${insight.id}`')],
 ['Não duplica fatura',rules.includes('sem duplicar o pagamento da fatura')],
 ['Histórico sem valores financeiros',!rules.includes('amount: number')&&rules.includes('seenAt: string')],
 ['Histórico tem limite',rules.includes('.slice(0, 80)')],
 ['Rotas de ação permitidas',rules.includes('VALID_ROUTES')&&rules.includes('safeRoute')],
 ['Confiança e explicação',page.includes('Por que estou vendo isto?')&&page.includes('item.evidence')],
 ['Controles ativo/adiado/revisado',page.includes("changeHistory(item,'seen')")&&page.includes("changeHistory(item,'snooze')")],
 ['Silêncio selecionável',page.includes("['daily','Diária']")&&page.includes("['off','Pausar']")],
 ['Separado do Android',page.includes('Não são push Android')],
 ['Não pede permissão automaticamente',!page.includes('requestNativeNotificationPermission')],
 ['Sem escrita de lançamentos',!/(safeAdd\(|safeUpdate\(|\.insert\(|\.rpc\(|\.delete\()/.test(page+rules)],
 ['Preferência na conta',prefs.includes('proactive_history: ProactiveHistoryEntry[]')&&prefs.includes('normalizeProactiveHistory(raw.proactive_history)')],
 ['Central aponta para observações',center.includes('href="/intelligence-center/observations"')],
 ['Mais aponta para observações',more.includes('href="/intelligence-center/observations"')],
 ['Home reutiliza inteligência existente',home.includes('intelligenceHighlights.length > 0')&&home.includes("router.push('/intelligence-center/observations')")],
 ['R457 protegida',fs.existsSync('src/lib/nativeNotificationRules.ts')&&fs.existsSync('src/app/(app)/notification-center/page.tsx')],
 ['Android mantém contratos V457',wf.includes('node scripts/check-r457-notification-center.mjs')],
 ['Action testa R458',wf.includes('R458 Proactive Intelligence certification')],
]
checks.forEach(([name,ok])=>assert.ok(ok,`R458: ${name}`))
console.log(`R458_PROACTIVE_OK: ${checks.length} contratos + ${paths.length} fontes TypeScript sintaticamente válidas`)
