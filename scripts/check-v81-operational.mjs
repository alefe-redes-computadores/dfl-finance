import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

const tx = read('src/app/(app)/transactions/page.tsx')
const home = read('src/app/(app)/home/page.tsx')
const inbox = read('src/app/(app)/conciliation/page.tsx')
const nav = read('src/components/BottomNav.tsx')
const rich = read('src/app/(app)/transactions/new/page.tsx')

const checks = [
  [
    tx.includes("aria-label=\"Nova transação completa\"") &&
      tx.includes("router.push('/transactions/new')"),
    'Transações possui CTA próprio para Nova Transação completa',
  ],
  [
    nav.includes("const isTransactionsRoot = pathname === '/transactions'") &&
      nav.includes("setQuickActionOpen(false)") &&
      nav.includes("navigateSafely('/transactions/new')"),
    'BottomNav não abre Ação rápida na raiz de Transações',
  ],
  [
    rich.includes('selectedTags') &&
      rich.includes('receipt') &&
      rich.includes('notes'),
    'formulário rico continua contendo tags, comprovante e observações',
  ],
  [
    home.includes('Disponível operacional') &&
      home.includes('operationalAvailable') &&
      home.includes('operationalCommitted'),
    'Home possui disponível operacional explicável',
  ],
  [
    home.includes('Saldo menos compromissos imediatos'),
    'Home explica a natureza do disponível operacional',
  ],
  [
    home.includes('Inbox financeira') &&
      home.includes("router.push('/conciliation')"),
    'Home possui entrada direta para Inbox',
  ],
  [
    home.includes("['whatsapp', 'ai_ocr', 'ofx_import', 'ofx_merged']"),
    'Home reconhece origens automatizadas para revisão',
  ],
  [
    inbox.includes('Inbox financeira') &&
      inbox.includes('O que precisa de você'),
    'Conciliação foi promovida a Inbox financeira',
  ],
  [
    inbox.includes('WhatsApp · revisar') &&
      inbox.includes('Comprovante/OCR') &&
      inbox.includes('Importação · revisar'),
    'Inbox identifica fontes automatizadas',
  ],
  [
    inbox.includes("date <= today") ||
      inbox.includes("date <= today"),
    'Inbox continua excluindo lançamentos futuros',
  ],
  [
    !home.includes('Atenção agora'),
    'Home não mantém nomenclatura antiga Atenção agora',
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
  console.error(`\nV81: ${failed} contrato(s) falharam.`)
  process.exit(1)
}

console.log('\nV81 EXPERIÊNCIA OPERACIONAL: CONTRATOS OK')
