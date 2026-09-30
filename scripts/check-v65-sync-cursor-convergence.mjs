import fs from 'node:fs'

const engine=fs.readFileSync('src/lib/syncEngine.ts','utf8')
const hook=fs.readFileSync('src/hooks/useLocalSync.ts','utf8')

const checks=[
  ['botão Sync força pull completo', /forceSync[\s\S]*?processSyncQueue\(\s*true,\s*true\s*\)/.test(hook)],
  ['fila é autoridade da proteção local', engine.includes('const isLocallyProtected = (id: string) =>') && engine.includes('pendingIds.has(id)')],
  ['sync_status órfão não bloqueia remoto', !engine.includes("localItem.sync_status !== 'synced'")],
  ['detecta remoto pulado por proteção', engine.includes('skippedProtectedRemoteRows = true')],
  ['cursor não avança quando remoto foi pulado', engine.includes('if (!skippedProtectedRemoteRows)') && engine.includes('localStorage.setItem(lastPullKey, syncTime)')],
  ['pull forçado continua buscando desde origem', engine.includes("if (force || localCount === 0)") && engine.includes("effectiveLastPull = '2000-01-01T00:00:00.000Z'")],
  ['V64 permanece instalada', engine.includes('V64 — convergência multi-cliente de saldo')],
]

let failed=0
for(const [name,ok] of checks){
  console.log(`${ok?'OK ':'ERR'} ${name}`)
  if(!ok) failed++
}
if(failed) process.exit(1)
console.log('\nV65 SYNC CURSOR CONVERGENCE — CONTRATO OK')
