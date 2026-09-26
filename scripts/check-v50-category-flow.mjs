import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (value, message) => {
  if (!value) throw new Error(`V50: ${message}`)
}

const fresh = read('src/app/(app)/transactions/new/page.tsx')
const details = read('src/app/(app)/transactions/details/page.tsx')
const ops = read('src/lib/transactionCategoryOperations.ts')
const icon = read('src/components/IconPicker.tsx')

ok(
  fresh.includes("filters: { context: effectiveContext, type: type === 'income' ? 'income' : 'expense' }"),
  'nova transação perdeu filtro context + type'
)

ok(
  fresh.includes('filterTransactionCategories(') &&
  fresh.includes('mainCategories') &&
  fresh.includes('validCategories'),
  'nova transação não usa contrato central de categorias'
)

ok(
  fresh.includes("const userCategories = await db.categories") &&
  fresh.includes("category.context === effectiveContext") &&
  fresh.includes("category.type === categoryType") &&
  fresh.includes("duplicate.is_archived === true"),
  'deduplicação completa não foi instalada'
)

ok(
  fresh.includes("is_archived: false") &&
  fresh.includes("is_default: false") &&
  fresh.includes("parent_id: null"),
  'payload de categoria incompleto'
)

ok(
  fresh.includes("Categoria criada e selecionada.") &&
  fresh.includes("Categoria restaurada e selecionada.") &&
  fresh.includes("Essa categoria já existe. Selecionei a existente."),
  'feedback de criação/deduplicação incompleto'
)

ok(
  fresh.includes('flex max-h-[82dvh]') &&
  fresh.includes('min-h-0 flex-1 overflow-y-auto') &&
  fresh.includes("type === 'income' ? 'Categorias de receita' : 'Categorias de despesa'"),
  'sheet de categoria da nova transação ainda mistura header e scroll'
)

ok(
  details.includes('const transactionContext = tx?.context || effectiveContext') &&
  details.includes('a.context === transactionContext') &&
  details.includes('filterTransactionCategories('),
  'edição ainda carrega auxiliares pelo contexto errado'
)

ok(
  details.includes('min-h-0 flex-1 overflow-y-auto') &&
  details.includes("txType === 'income' ? 'Categorias de receita' : 'Categorias de despesa'"),
  'sheet de edição ainda está com geometria antiga'
)

ok(
  ops.includes('category.type !== expected') &&
  ops.includes('category.is_archived === true'),
  'filtro semântico central regrediu'
)

ok(
  icon.includes('z-[160000]') &&
  icon.includes('onSelect(iconName)'),
  'IconPicker perdeu camada/seleção'
)

console.log('DFL FINANCE V50 CATEGORY FLOW: OK')
