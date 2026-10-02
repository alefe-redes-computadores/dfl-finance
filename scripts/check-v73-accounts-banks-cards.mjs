import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (value, message) => {
  if (!value) throw new Error('V73: ' + message)
  console.log('OK ', message)
}

const accounts = read('src/app/(app)/accounts/page.tsx')
const accountDetails = read('src/app/(app)/accounts/details/page.tsx')
const accountNew = read('src/app/(app)/accounts/new/page.tsx')
const cards = read('src/app/(app)/cards/page.tsx')
const cardDetails = read('src/app/(app)/cards/details/page.tsx')
const cardNew = read('src/app/(app)/cards/new/page.tsx')
const presentation = read('src/lib/accountPresentation.ts')
const cardOps = read('src/lib/cardOperations.ts')
const sync = read('src/lib/syncEngine.ts')

ok(
  accounts.includes("'manual' | 'balance' | 'institution' | 'name'"),
  'contas preservam manual / saldo / instituição / nome'
)

ok(
  accounts.includes('showViewOptions') &&
  accounts.includes('Filtros e ordem'),
  'filtros de contas permanecem compactos'
)

ok(
  accounts.includes('const visibleIds = filteredAccounts.map(') &&
  accounts.includes('const reorderedVisible = [...visibleIds]') &&
  accounts.includes('const allActiveIds = activeAccounts.map(') &&
  accounts.includes('const visibleSet = new Set(visibleIds)'),
  'ordem manual não perde contas escondidas por filtro ou busca'
)

ok(
  accounts.includes('BankLogo') &&
  accountDetails.includes('BankLogo') &&
  accountNew.includes('BankLogo'),
  'identidade bancária permanece consistente no domínio de contas'
)

ok(
  presentation.includes('canonicalizeBankName') &&
  presentation.includes('getAccountInstitutionLabel') &&
  presentation.includes('groupAccountsByInstitution'),
  'normalização e apresentação bancária permanecem centralizadas'
)

ok(
  cards.includes("const STORAGE_KEY_PREFIX = 'dfl_cards_order'") &&
  cards.includes('${STORAGE_KEY_PREFIX}_${effectiveContext}'),
  'ordem de cartões é isolada entre PF e PJ'
)

ok(
  cards.includes('}, [effectiveContext])') &&
  cards.includes('const saveOrder = useCallback'),
  'preferência de cartões acompanha troca de contexto'
)

ok(
  cards.includes('DragDropContext') &&
  cards.includes('Droppable') &&
  cards.includes('Draggable') &&
  cards.includes('handleDragEnd'),
  'drag and drop dos cartões permanece funcional'
)

ok(
  cards.includes('getCardCycleFinancialSnapshot') &&
  cardDetails.includes('getCardCycleFinancialSnapshot'),
  'lista e detalhe usam snapshot financeiro canônico da fatura'
)

ok(
  cards.includes('getCardOutstandingExposure'),
  'exposição financeira dos cartões permanece no helper oficial'
)

ok(
  cardDetails.includes('Pagar fatura') &&
  cardDetails.includes('payCardInvoice'),
  'pagamento de fatura permanece no fluxo oficial'
)

ok(
  cardOps.includes('db.transaction(') &&
  cardOps.includes('credit_invoices') &&
  cardOps.includes('idempotency_key:'),
  'ledger de fatura continua transacional e idempotente'
)

ok(
  cardOps.includes('affects_balance: false'),
  'compras de cartão não debitam saldo bancário diretamente'
)

ok(
  cardOps.includes("invoice?.status === 'paid'") &&
  cardOps.includes('fatura paga é histórico financeiro fechado'),
  'fatura paga permanece protegida contra reabertura'
)

ok(
  sync.includes('reconcileAccountBalancesFast') &&
  sync.includes("item.table === 'accounts'") &&
  sync.includes('protectedAccountIds'),
  'reconciliação rápida V68/V69 permanece protegida'
)

ok(
  ![
    accounts,
    accountDetails,
    accountNew,
    cards,
    cardDetails,
    cardNew,
  ].join('\n').includes('/android/'),
  'V73 não cria dependência da camada Android'
)

console.log('V73 CONTAS + BANCOS + CARTÕES — CONTRATO OK')
