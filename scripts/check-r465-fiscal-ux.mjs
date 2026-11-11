/** R465 — gate sem I/O financeiro nem credenciais. Complementa os gates anteriores. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const read = path => fs.readFileSync(path, 'utf8')
const paths = [
  'src/lib/meiObligations.ts',
  'src/lib/nativeNotifications.ts',
  'src/lib/nativeNotificationRules.ts',
  'src/lib/userSettings.ts',
  'src/app/(app)/commercial/mei/page.tsx',
  'src/app/(app)/commercial/page.tsx',
  'src/app/(app)/more/page.tsx',
  'src/app/(app)/notifications/page.tsx',
  'src/app/(app)/notification-center/page.tsx',
  'src/__tests__/meiObligationsR465.test.ts',
  'src/__tests__/r463PremiumUi.test.ts',
]
for (const path of paths) {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  assert.equal(source.parseDiagnostics.length, 0, `R465: sintaxe de ${path}: ${source.parseDiagnostics.map(x => x.messageText).join(', ')}`)
}
const app = read(paths[4]), pure = read(paths[0]), native = read(paths[1]), rules = read(paths[2])
const settings = read(paths[3]), commercial = read(paths[5]), more = read(paths[6]), inbox = read(paths[7]), prefs = read(paths[8])
const historicalUiTest = read('src/__tests__/r463PremiumUi.test.ts')
const tests = [
  ['R463 atualizado para novos quatro grupos e links seguros', ['Contas e empresas', 'Planejamento e compromissos', 'Inteligência e relatórios', 'Sistema, avisos e segurança', 'href=\"/commercial/mei\"'].every(item => historicalUiTest.includes(item))],
  ['Perfil MEI isolado por organização UUID', pure.includes('ID.test(organizationId)')],
  ['Competência sem rollover', pure.includes('validCompetence') && pure.includes('estimatedDasDue')],
  ['Taxa não calculada sem Receita', !pure.includes('salarioMinimo') && !pure.includes('calculateTax')],
  ['Baixa é manual e explícita', app.includes('manuallyConfirmedDas') && app.includes('Paguei')],
  ['Empresa não é assumida como MEI', pure.includes("regime: 'unknown'") && app.includes('Não informado')],
  ['Sem seletor nativo', !/<select[\s>]/i.test(app)],
  ['Sem ação automática de caixa', !/safeAdd|applyAccountCashDelta|transfer_execute|\.rpc\(/i.test(app)],
  ['Portais oficiais somente', pure.includes('gov.br/pt-br/servicos/emitir-das') && pure.includes('gov.br/pt-br/servicos/declarar-receita')],
  ['Perfil sincronizado com políticas existentes', settings.includes('commercial_tax_profiles: normalizeCommercialTaxProfiles(raw.commercial_tax_profiles)') && settings.includes('commercial_tax_profiles: {},')],
  ['Fiscais OFF por padrão', settings.includes('taxes: false') && native.includes('taxes: false')],
  ['Uma nova categoria, não um scheduler independente', rules.includes("'taxes'") && native.includes("category: 'taxes'")],
  ['Sem dinheiro inventado em avisos fiscais', native.includes('amount: 0, // valor real desconhecido')],
  ['Categorias fiscais exigem consentimento', native.includes("if (enabled(preferences, 'taxes'))") && native.includes('preferences.push_notifications')],
  ['Baixa manual cancela lembretes de competência', pure.includes('!profile.manuallyConfirmedDas[month]')],
  ['Limite de 60 notificações mantido', native.includes('notifications.length >= 60') && native.includes('notifications: needed')],
  ['Central de avisos sem cabeçalho gigante sticky', !inbox.includes('sticky top-0 z-30') && inbox.includes('<NotificationPreferencesCard />')],
  ['Lembretes separados visualmente', prefs.includes("setReminderGroup('financial')") && prefs.includes("setReminderGroup('fiscal')")],
  ['MEI tem regras próprias de antecedência', prefs.includes("id === 'taxes'") && rules.includes('overdueEveryDays')],
  ['CNPJ legado e select premium preservados', commercial.includes('isValidCnpj') && commercial.includes('<SelectField')],
  ['Mais mantém acessos sem deletar funcionalidades', more.includes('href="/commercial/mei"') && more.includes('label="Central de Notificações" href="/notifications"') && more.includes('href="/updates"') && more.includes('Atalhos frequentes')],
  ['Novo atalho comercial', commercial.includes("href: '/commercial/mei'")],
  ['Identidade visual Lucide', app.includes("from 'lucide-react'") && prefs.includes("from 'lucide-react'") && !/<select[\s>]/i.test(commercial)],
  ['R465 aparece nas novidades', read('src/lib/financeReleaseNotes.ts').includes("version: 'R465'") && read('CHANGELOG.md').includes('## R465')],
  ['CI R464 preservada', read('.github/workflows/android-build.yml').includes('node scripts/check-r464-native-updater.mjs')],
  ['CI R465 e testes', read('.github/workflows/android-build.yml').includes('node scripts/check-r465-fiscal-ux.mjs') && read('.github/workflows/android-build.yml').includes('meiObligationsR465.test.ts')],
  ['Bot e livros financeiros fora do escopo', fs.existsSync('supabase/functions/whatsapp-webhook/index.ts') && fs.existsSync('src/app/(app)/commercial/ledger/page.tsx')],
]
for (const [name, ok] of tests) assert.ok(ok, `R465: ${name}`)
console.log(`R465_CLOSEOUT_OK: ${tests.length} contratos + ${paths.length} fontes TS/TSX parseadas, sem transação, migração ou token`)
