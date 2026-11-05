import fs from 'node:fs'

const read = (f) => fs.readFileSync(f, 'utf8')

const globalSearch = read('src/lib/globalSearch.ts')
const search = read('src/app/(app)/search/page.tsx')
const details = read('src/app/(app)/transactions/details/page.tsx')
const more = read('src/app/(app)/more/page.tsx')
const bank = read('src/lib/bankIdentityPresentation.ts')
const home = read('src/app/(app)/home/page.tsx')
const planning = read('src/lib/financialPlanning.ts')

const checks = [
  [
    globalSearch.includes('resolveFinancialCommands') &&
      globalSearch.includes('FINANCIAL_COMMAND_SUGGESTIONS'),
    'motor de comandos financeiros existe',
  ],
  [
    globalSearch.includes("'new-expense'") &&
      globalSearch.includes("'new-income'") &&
      globalSearch.includes("'transfer'") &&
      globalSearch.includes("'inbox'") &&
      globalSearch.includes("'planning'") &&
      globalSearch.includes("'receipts'"),
    'comandos principais estão cobertos',
  ],
  [
    globalSearch.includes('resolveMonthIntentToken') &&
      globalSearch.includes('fuzzyTokenMatch'),
    'busca fuzzy e meses foram preservados',
  ],
  [
    search.includes('Buscar e comandar') &&
      search.includes('Ações entendidas') &&
      search.includes('Command Center financeiro'),
    'Busca apresenta experiência de Command Center',
  ],
  [
    search.includes('resolveFinancialCommands(trimmedQuery)') &&
      search.includes('router.push(command.href)'),
    'comando pode virar ação direta',
  ],
  [
    details.includes("const isTransfer = txType === 'transfer'") &&
      details.includes('Movimento de transferência') &&
      details.includes("txType === 'transfer' ? 'Transferência'"),
    'transferência não é apresentada como despesa',
  ],
  [
    details.includes('permanece ligado ao outro lado do movimento'),
    'editor explica a integridade de duas pernas',
  ],
  [
    more.includes('Inbox financeira') &&
      more.includes('Buscar e comandar') &&
      !more.includes('Conciliação Inteligente'),
    'Mais usa arquitetura final',
  ],
  [
    bank.includes('scale: 0.8') &&
      bank.includes('pagbank:') &&
      bank.includes('stone:'),
    'Stone e PagBank usam perfil óptico central',
  ],
  [
    home.includes('Inbox financeira') &&
      planning.includes('buildKnownCashTimeline'),
    'V81 e V82 continuam presentes',
  ],
]

let failed = 0

for (const [condition, label] of checks) {
  if (condition) {
    console.log(`OK: ${label}`)
  } else {
    failed++
    console.error(`FALHOU: ${label}`)
  }
}

if (failed) {
  console.error(`\nV83: ${failed} contrato(s) falharam.`)
  process.exit(1)
}

console.log('\nV83 COMMAND CENTER: CONTRATOS OK')
