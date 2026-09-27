import fs from 'node:fs'

const read = (path) =>
  fs.readFileSync(path, 'utf8')

const accountOps =
  read('src/lib/accountOperations.ts')

const cardOps =
  read('src/lib/cardOperations.ts')

const analysis =
  read('src/app/(app)/analysis/page.tsx')

const db =
  read('src/lib/db.ts')

const syncEngine =
  fs.existsSync('src/lib/syncEngine.ts')
    ? read('src/lib/syncEngine.ts')
    : ''

const failures = []

function ok(condition, message) {
  if (!condition) {
    failures.push(message)
    console.error(`ERRO: ${message}`)
  } else {
    console.log(`OK: ${message}`)
  }
}

console.log('=== V55 FINANCIAL CORE RECOVERY ===')

/* ------------------------------------------------------------
 * Contrato persistido
 * ------------------------------------------------------------ */

ok(
  db.includes('idempotency_key?: string | null'),
  'campo idempotency_key pertence ao contrato local'
)

ok(
  db.includes('to_account_id?: string | null'),
  'to_account_id pertence ao contrato local de transação'
)

ok(
  accountOps.includes('to_account_id: toAccount.id') &&
  accountOps.includes('to_account_id: fromAccount.id') &&
  accountOps.includes('transfer_group_id: transferGroupId'),
  'transferência preserva account/to_account/group reais'
)

ok(
  accountOps.includes(
    '`transfer:${transferGroupId}:out`'
  ),
  'transferência de saída possui direção canônica'
)

ok(
  accountOps.includes(
    '`transfer:${transferGroupId}:in`'
  ),
  'transferência de entrada possui direção canônica'
)

ok(
  accountOps.includes('affects_balance: false'),
  'trilha de transferência continua protegida contra dupla contagem'
)

/* ------------------------------------------------------------
 * Análise
 * ------------------------------------------------------------ */

ok(
  analysis.includes(
    "if (t.type === 'transfer')"
  ) &&
  analysis.includes(
    "transferIdentity.endsWith(':out')"
  ) &&
  analysis.includes(
    "transferIdentity.endsWith(':in')"
  ),
  'análise reconstrói transferência por direção canônica'
)

/*
 * Não fazemos comparação de string escapada do regex.
 * O checker valida a semântica presente no source.
 */
ok(
  /Transferência para\\\\b/.test(
    JSON.stringify(analysis)
  ) &&
  /Transferência de\\\\b/.test(
    JSON.stringify(analysis)
  ),
  'análise mantém compatibilidade com transferências legadas'
)

ok(
  !analysis.includes('t.transfer_to') &&
  !analysis.includes('t.transfer_from'),
  'campos fantasmas transfer_to/transfer_from removidos da análise'
)

const balanceEffectStart =
  analysis.indexOf(
    'const balanceEffect = (t: any) =>'
  )

const transferIndex =
  analysis.indexOf(
    "if (t.type === 'transfer')",
    balanceEffectStart
  )

const affectsIndex =
  analysis.indexOf(
    'if (t.affects_balance === false) return 0',
    balanceEffectStart
  )

ok(
  balanceEffectStart >= 0 &&
  transferIndex > balanceEffectStart &&
  affectsIndex > transferIndex,
  'transferência é tratada antes do filtro affects_balance=false'
)

ok(
  analysis.includes(
    "if (!filterAccount || t.account_id !== filterAccount) return 0"
  ),
  'transferência só afeta reconstrução da conta correspondente'
)

/* ------------------------------------------------------------
 * Compatibilidade de sync
 * ------------------------------------------------------------ */

ok(
  syncEngine.includes("transferto: 'to_account_id'") &&
  syncEngine.includes("transferfrom: 'to_account_id'"),
  'aliases históricos de transferência convergem para to_account_id'
)

/* ------------------------------------------------------------
 * Faturas
 * ------------------------------------------------------------ */

ok(
  cardOps.includes(
    "if (invoice?.status === 'paid')"
  ) &&
  cardOps.includes('return invoice'),
  'fatura paga é imutável durante reconciliação'
)

ok(
  cardOps.includes(
    '`card_invoice_payment:${invoice.id}`'
  ),
  'pagamento de fatura possui identidade idempotente'
)

ok(
  /invoice_id:\s*invoice\?\.id\s*\?\?\s*null/.test(
    cardOps
  ),
  'liquidação aponta para a credit_invoice de origem'
)

const paymentStart =
  cardOps.indexOf(
    'const paymentTransaction: LocalTransaction'
  )

const paymentEnd =
  cardOps.indexOf(
    'await db.transactions.add',
    paymentStart
  )

const paymentBlock =
  paymentStart >= 0 && paymentEnd > paymentStart
    ? cardOps.slice(paymentStart, paymentEnd)
    : ''

ok(
  paymentBlock.includes("type: 'expense'") &&
  paymentBlock.includes('affects_balance: false'),
  'liquidação continua sem duplicar despesa econômica'
)

/* ------------------------------------------------------------
 * Atomicidade
 * ------------------------------------------------------------ */

const transferFunctionStart =
  accountOps.indexOf(
    'export async function transferBetweenAccounts'
  )

const adjustFunctionStart =
  accountOps.indexOf(
    'export async function adjustAccountBalance'
  )

const transferBlock =
  transferFunctionStart >= 0
    ? accountOps.slice(
        transferFunctionStart,
        adjustFunctionStart > transferFunctionStart
          ? adjustFunctionStart
          : undefined
      )
    : ''

ok(
  transferBlock.includes('db.transaction(') &&
  transferBlock.includes('db.accounts') &&
  transferBlock.includes('db.transactions') &&
  transferBlock.includes('db.syncQueue'),
  'transferência continua atômica no Dexie'
)

/* ------------------------------------------------------------
 * Resultado
 * ------------------------------------------------------------ */

if (failures.length) {
  console.error('')
  console.error(
    `V55 FALHOU: ${failures.length} contrato(s).`
  )

  process.exit(1)
}

console.log('')
console.log('V55 FINANCIAL CORE: OK')
