import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (value, message) => {
  if (!value) throw new Error(`V44: ${message}`)
}

const db = read('src/lib/db.ts')
const safeDb = read('src/lib/safeDb.ts')
const categories = read('src/app/(app)/categories/page.tsx')
const categoryOps = read('src/lib/transactionCategoryOperations.ts')
const civil = read('src/lib/civilDate.ts')
const native = read('src/lib/nativeNotifications.ts')
const manager = read('src/components/NativeNotificationManager.tsx')
const accountDetails = read('src/app/(app)/accounts/details/page.tsx')
const budgetDetails = read('src/app/(app)/budgets/details/page.tsx')
const cardDetails = read('src/app/(app)/cards/details/page.tsx')
const goalDetails = read('src/app/(app)/goals/details/page.tsx')
const financingDetails = read('src/app/(app)/financings/details/page.tsx')
const financingNew = read('src/app/(app)/financings/new/page.tsx')
const loansNew = read('src/app/(app)/loans/new/page.tsx')
const loanModal = read('src/components/ModalEmprestimo.tsx')
const migration = read('supabase/migrations/20260925123518_v44_server_only_rls_contracts.sql')

ok(
  db.includes("'savings' | 'digital' | 'investment'"),
  'LocalAccount não reconhece Conta Digital'
)
ok(
  db.includes('is_default?: boolean') &&
  db.includes('order_index?: number | null') &&
  db.includes('parent_id?: string | null'),
  'contrato LocalCategory incompleto'
)

ok(
  categoryOps.includes('is_archived?: boolean | null') &&
  categoryOps.includes('category.is_archived === true'),
  'categoria arquivada ainda entra em novos seletores'
)
ok(
  categoryOps.includes('Categoria arquivada some dos NOVOS seletores'),
  'edição histórica não preserva categoria arquivada'
)
ok(
  categories.includes('archivedCategories') &&
  categories.includes('restoreCategory') &&
  categories.includes('is_archived: true') &&
  categories.includes('is_archived: false') &&
  categories.includes('Categorias ocultas') &&
  categories.includes('Ocultar categoria?'),
  'UI de ocultar/restaurar categoria incompleta'
)
ok(
  !categories.includes('safeDelete, safeUpdate'),
  'tela de Categorias ainda usa delete físico como ação principal'
)

ok(
  safeDb.includes('goal.category_id === id') &&
  safeDb.includes('category.parent_id === id'),
  'safeDelete de categoria ainda pode deixar referência órfã'
)
ok(
  safeDb.includes('tx.to_account_id === id') &&
  safeDb.includes('debt.account_id === id') &&
  safeDb.includes('card.payment_account_id === id'),
  'safeDelete de conta ainda pode deixar vínculo órfão'
)

ok(
  civil.includes('export function localISODate') &&
  civil.includes('export function parseCivilDate') &&
  civil.includes('export function toLocalCivilDate'),
  'utilitário de data civil ausente'
)
ok(accountDetails.includes('formatCivilDateBR(date)'), 'conta ainda exibe data civil como UTC')
ok(budgetDetails.includes('toLocalCivilDate(tx.date)'), 'orçamento ainda exibe data civil como UTC')
ok(cardDetails.includes('toLocalCivilDate(tx.date)'), 'cartão ainda exibe data civil como UTC')
ok(goalDetails.includes('toLocalCivilDate(tx.date)'), 'meta ainda exibe data civil como UTC')

for (const [name, source] of [
  ['financings/details', financingDetails],
  ['financings/new', financingNew],
  ['loans/new', loansNew],
  ['ModalEmprestimo', loanModal],
]) {
  ok(
    !source.includes("toISOString().split('T')[0]") &&
    !source.includes('toISOString().split("T")[0]'),
    `${name} ainda usa UTC como dia civil`
  )
}

ok(
  native.includes('(!explicitDue && dueDay <= 0)') &&
  native.includes('nextMonthlyDueDate(dueDay)'),
  'assinatura legada sem due_day ainda perde lembrete'
)
ok(
  native.includes("route.includes('://')") &&
  native.includes("!route.includes('://')"),
  'sanitização de deep link perdeu proteção/compatibilidade'
)

const component = manager.slice(
  manager.indexOf('export default function NativeNotificationManager')
)
ok(
  /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,1800}?consumeNotificationRoute\(\)/.test(component),
  'consumeNotificationRoute não é chamado dentro de useEffect real'
)

ok(
  migration.includes('revoke all on table public.bot_sessions') &&
  migration.includes('revoke all on table public.dfl_messaging_outbox') &&
  migration.includes('revoke all on table public.scenarios') &&
  migration.includes('server only deny clients v44'),
  'espelho local da migration V44 ausente'
)

console.log('DFL FINANCE V44 RELEASE HARDENING: OK')
