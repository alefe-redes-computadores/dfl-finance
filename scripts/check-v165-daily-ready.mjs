import fs from 'node:fs'
import assert from 'node:assert/strict'
const read=(p)=>fs.readFileSync(p,'utf8')
const forms={
  debts:read('src/app/(app)/debts/new/page.tsx'),
  loans:read('src/app/(app)/loans/new/page.tsx'),
  goals:read('src/app/(app)/goals/new/page.tsx'),
  budgets:read('src/app/(app)/budgets/new/page.tsx'),
  financings:read('src/app/(app)/financings/new/page.tsx'),
}
const home=read('src/app/(app)/home/page.tsx')
const css=read('src/app/globals.css')
const workflow=read('.github/workflows/android-build.yml')
let ok=0
const check=(label,test)=>{assert.ok(test,label);ok++;console.log('✓ '+label)}
for(const [name,s] of Object.entries(forms)){
  check(name+' tem lock sincrônico',s.includes('const saveLockRef = useRef(false)')&&s.includes('saveLockRef.current = true'))
  check(name+' possui liberação em finally',/finally\s*\{\s*saveLockRef\.current = false\s*setSaving\(false\)/.test(s))
  check(name+' preserva interface de gravação',s.includes('setSaving(true)')&&s.includes('safeAdd(')&&s.includes('safeUpdate('))
}
check('Quem me deve não confunde com crédito imediato',forms.debts.includes('Novo valor a receber')&&forms.debts.includes('não movimenta o saldo'))
check('Quem me deve mostra conta como destino previsto',forms.debts.includes('Conta de recebimento previsto'))
check('Quem me deve preserva identidade do banco',forms.debts.includes('<BankLogo'))
check('Quem me deve preserva categoria colorida',forms.debts.includes('<SelectedCategoryIcon'))
check('V164 substituiu calendários nativos',Object.values(forms).filter(s=>s.includes('<DatePickerSheet')).length>=4)
check('Safe-area usa deslocamento fixo',css.includes('margin-top: max(var(--safe-area-top), 24px)')&&css.includes('height: calc(100dvh - max(var(--safe-area-top), 24px))'))
check('Contrato do Android mantém owner de safe area',css.includes("html[data-native-shell='true'] .app-page"))
check('Home orienta primeiro uso só após sync',home.includes('syncAttempted && isOnline && !isSyncing && !hasSyncFailure && accounts.length === 0'))
check('Home possui ações reais',home.includes("router.push('/accounts/new')")&&home.includes("router.push('/transactions/new')"))
check('Inbox protegida no motor existente',read('src/lib/inboxPolicy.ts').includes('needsFinancialReview'))
check('Sync concorrente preservado',read('src/lib/syncEngine.ts').includes('protectedNow'))
check('Workflow exige V164',workflow.includes('node scripts/check-v164-finance-premium-forms.mjs'))
check('Workflow exige V165',workflow.includes('node scripts/check-v165-daily-ready.mjs'))
check('Assinatura Android preservada',workflow.includes('DFL_FINANCE_STABLE_SIGNING_V1'))
check('Segurança do webhook preservada',read('supabase/functions/whatsapp-webhook/index.ts').includes('trustedWebhook'))
console.log(`\nV165 DAILY-READY: ${ok} contratos aprovados. Teste real de APK continua obrigatório.`)
