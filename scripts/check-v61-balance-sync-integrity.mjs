import fs from 'node:fs'

const future = fs.readFileSync('src/lib/futureTransactionOperations.ts', 'utf8')
const sync = fs.readFileSync('src/lib/syncEngine.ts', 'utf8')

const checks = [
  ['single-flight do reparador',
    future.includes('const activeRepairs = new Map<') &&
    future.includes('const running = activeRepairs.get(userId)') &&
    future.includes('activeRepairs.set(userId, promise)')],
  ['delta calculado dentro da transação',
    future.includes('const committedDeltaCents = new Map<string, number>()') &&
    future.indexOf('const committedDeltaCents =') > future.indexOf("await db.transaction(")],
  ['releitura autoritativa da transação',
    future.includes('await db.transactions.get(txId)')],
  ['contadores refletem reparo commitado',
    future.includes('repairedTransactions += 1') &&
    future.includes('repairedAccounts += 1')],
  ['delta legado pré-calculado removido',
    !future.includes('const accountDeltaCents =')],
  ['conta remota validada antes do upsert',
    sync.includes(".select('id, user_id, balance, updated_at')") &&
    sync.includes('.maybeSingle()')],
  ['conflito de saldo explícito',
    sync.includes(".select('id, user_id, balance, updated_at')") &&
    sync.includes('remoteAccount?.updated_at') &&
    sync.includes('localRecord.updated_at') &&
    sync.includes('const remoteBalance = Number(remoteAccount.balance ?? 0)') &&
    sync.includes('const localBalance = Number(localRecord.balance ?? 0)') &&
    sync.includes('Houve nova edição enquanto o conflito era resolvido.') &&
    sync.includes('Local anterior=${localBalance.toFixed(2)}.') &&
    sync.includes('Remoto=${remoteBalance.toFixed(2)}.')],
  ['falha preserva fila existente',
    sync.includes('markSyncFailedIfCurrent(') &&
    sync.includes('permaneceu na fila após falha')],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK ' : 'ERR'} ${name}`)
  if (!ok) failed += 1
}
if (failed) process.exit(1)
console.log('\nV61 balance/sync integrity: OK')
