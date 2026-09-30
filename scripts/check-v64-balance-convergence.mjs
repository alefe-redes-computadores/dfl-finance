import fs from 'node:fs'
const s=fs.readFileSync('src/lib/syncEngine.ts','utf8')
const checks=[
  ['V61 não mantém mais conflito eterno', !s.includes("'Saldo remoto preservado; conflito mantido na fila.'")],
  ['snapshot remoto aplicado no Dexie', s.includes('await db.accounts.put({') && s.includes('...remoteAccount')],
  ['registro convergido vira synced', s.includes("sync_status: 'synced'")],
  ['revisão da fila é validada antes de consumir', s.includes('await confirmSyncSuccessIfCurrent(') && s.includes('itemRevision')],
  ['edição concorrente mais nova continua protegida', s.includes('if (!converged)')],
  ['somente remoto mais novo vence', s.includes('remoteChangedAfterQueue') && s.includes('!remoteMatchesLocal')],
  ['ciclo continua sem reenviar snapshot vencido', s.includes('continue')],
  ['pull continua protegendo mutações locais normais', s.includes('const isLocallyProtected = (id: string) =>')],
]
let failed=0
for(const [name,ok] of checks){console.log(`${ok?'OK ':'ERR'} ${name}`);if(!ok)failed++}
if(failed) process.exit(1)
console.log('\nV64 BALANCE CONVERGENCE — CONTRATO OK')
