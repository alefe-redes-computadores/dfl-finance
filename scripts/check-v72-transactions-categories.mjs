import fs from 'node:fs'

const read = path =>
  fs.readFileSync(path, 'utf8')

const ok = (condition, message) => {
  if (!condition) {
    throw new Error(`V72: ${message}`)
  }

  console.log(`OK  ${message}`)
}

const categories =
  read('src/app/(app)/categories/page.tsx')

const list =
  read('src/app/(app)/transactions/page.tsx')

const fresh =
  read('src/app/(app)/transactions/new/page.tsx')

const details =
  read('src/app/(app)/transactions/details/page.tsx')

const card =
  read(
    'src/app/(app)/transactions/card-expense/page.tsx'
  )

const ops =
  read('src/lib/transactionCategoryOperations.ts')

/* Categorias */

ok(
  categories.includes('setShowForm(false)') &&
    categories.includes('setShowIconModal(true)'),
  'IconPicker abre sem formulário concorrente'
)

ok(
  categories.includes('setShowIconModal(false)') &&
    categories.includes('setShowForm(true)'),
  'IconPicker devolve controle ao formulário'
)

ok(
  categories.includes('is_archived: true'),
  'exclusão continua sendo arquivamento seguro'
)

ok(
  categories.includes('is_archived: false'),
  'categoria arquivada continua restaurável'
)

/* Contrato canônico */

ok(
  ops.includes('filterTransactionCategories'),
  'helper canônico de filtragem existe'
)

ok(
  ops.includes('findCompatibleCategory'),
  'helper canônico de compatibilidade existe'
)

ok(
  ops.includes('category.is_archived === true'),
  'helper rejeita categoria arquivada'
)

/* Nova */

ok(
  fresh.includes('findCompatibleCategory'),
  'Nova Transação usa compatibilidade canônica'
)

ok(
  fresh.includes(
    'Categoria incompatível com o tipo da transação.'
  ),
  'Nova Transação bloqueia categoria incompatível'
)

/* Editar */

ok(
  details.includes('findCompatibleCategory'),
  'Editar Transação usa compatibilidade canônica'
)

ok(
  details.includes(
    'A categoria selecionada não é compatível com este tipo de transação.'
  ),
  'Editar Transação bloqueia categoria incompatível'
)

/* Cartão */

ok(
  card.includes('filterTransactionCategories('),
  'Despesa no Cartão usa filtro canônico'
)

ok(
  card.includes(`'expense'`) &&
    card.includes('effectiveContext'),
  'Despesa no Cartão respeita tipo e contexto'
)

/* Lista */

ok(
  list.includes('category.is_archived !== true'),
  'filtro de Transações não oferece categoria arquivada'
)

/* Invariantes financeiros */

ok(
  fresh.includes('isFutureOccurrence'),
  'futuro continua identificado explicitamente'
)

ok(
  fresh.includes('occurrenceIsSettled'),
  'liquidação continua calculada explicitamente'
)

ok(
  fresh.includes('await db.transaction('),
  'Nova Transação continua atômica'
)

ok(
  card.includes('affects_balance: false'),
  'compra no cartão continua sem debitar conta'
)

ok(
  details.includes('await db.transaction('),
  'Editar Transação continua atômica'
)

ok(
  details.includes(
    'Erro ao reverter saldo antigo'
  ),
  'reversão do saldo anterior permanece protegida'
)

ok(
  details.includes(
    'Erro ao aplicar novo saldo'
  ),
  'aplicação do novo saldo permanece protegida'
)

ok(
  details.includes(
    'tx?.affects_balance === false'
  ),
  'liquidação gerenciada permanece protegida'
)

ok(
  details.includes('fatura já paga'),
  'compra de fatura paga permanece protegida'
)

console.log(
  'V72 TRANSACTIONS + CATEGORIES — CONTRATO OK'
)
