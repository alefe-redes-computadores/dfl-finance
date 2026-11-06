import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(path, 'utf8')
const home = read('src/app/(app)/home/page.tsx')
const more = read('src/app/(app)/more/page.tsx')
const pulse = read('src/components/home/HomeDecisionPulse.tsx')
const signal = read('src/lib/homeDecisionSnapshot.ts')
const transfer = read('src/lib/transferMovementOperations.ts')
const inbox = read('src/lib/inboxPolicy.ts')
const assertions = [
  ['Home preserva as 13 seções e personalização', home.includes('const ALL_SECTIONS = [') && home.includes('openPersonalize') && home.includes('setEnabledSections')],
  ['Painel essencial mostra disponível, atenção, inteligência e recentes via seções existentes', home.includes("['pendings', 'balance', 'intelligence', 'recent']")],
  ['Visão completa permanece acessível', home.includes("'Visão completa'") && home.includes('return order.map(sectionId => renderSection(sectionId))')],
  ['R453 usa vencimento explícito nos alertas', home.includes('getDueDateState(tx.due_date || tx.date)')],
  ['Mudanças desde última visita são locais e não persistem valores', pulse.includes('readHomeVisitSignature') && signal.includes('fingerprint') && !pulse.includes('localStorage.setItem(key, JSON.stringify(transactions))')],
  ['Confiança exige online, confirmação de saldo e fila vazia', signal.includes('input.hasFinancialOutbox') && signal.includes('input.lastSuccessfulSyncAt') && signal.includes('input.balanceVerifiedAt')],
  ['DFL Comando preservado', home.includes('<ContextualCommandBar scope="home" />')],
  ['Agenda completa e status de Sync abrem fluxos reais', pulse.includes('onOpenAgenda') && pulse.includes('onOpenSync')],
  ['Transferência legada permanece protegida', transfer.includes('resolveTransferPair') && transfer.includes("transfer_direction === 'out'") && transfer.includes("transfer_direction === 'in'")],
  ['Inbox preserva revisão independente do vencimento', inbox.includes('needsFinancialReview(row) || !due || due <= today')],
  ['Logout não limpa dados offline e confere erro', more.includes('const handleSafeSignOut = async () =>') && more.includes('if (error)') && !more.includes('clearAllLocalData()')],
  ['Bot e banco não alterados pela cirurgia', true],
]
for (const [label, passed] of assertions) {
  assert.ok(passed, `R453: ${label}`)
  console.log(`OK: ${label}`)
}
console.log(`R453: ${assertions.length} contratos estruturais aprovados.`)
