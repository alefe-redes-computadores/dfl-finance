import fs from 'node:fs'
const s=fs.readFileSync('src/lib/syncEngine.ts','utf8')
const checks=[
 ['autocura explícita existe',s.includes('async function healOrphanAccountSyncStates(')],
 ['órfão exige pending/failed e ausência de fila',s.includes("account.sync_status === 'pending'")&&s.includes("account.sync_status === 'failed'")&&s.includes('!queuedAccountIds.has(account.id)')],
 ['remoto é filtrado pelo usuário',s.includes(".from('accounts')")&&s.includes(".eq('user_id', userId)")&&s.includes(".in('id', orphanIds)")],
 ['cura não recalcula por transações',!s.match(/healOrphanAccountSyncStates[\s\S]*?db\.transactions/)],
 ['fila é revalidada atomicamente',s.includes("db.transaction(")&&s.includes("db.accounts,")&&s.includes("db.syncQueue,")&&s.includes('if (activeQueue)')],
 ['snapshot remoto vence somente órfão',s.includes('...remoteAccount')&&s.includes("sync_status: 'synced'")],
 ['saldo remoto é normalizado em centavos',s.includes('Math.round(Number(remoteAccount.balance ?? 0) * 100) / 100')],
 ['há verificação pós-escrita',s.includes('expectedBalance')&&s.includes("current?.sync_status === 'synced'")],
 ['autocura roda depois do pull bem-sucedido',/const pullResult = await pullRemoteChanges[\s\S]*?if \(pullResult\.success\)[\s\S]*?healOrphanAccountSyncStates\(userId\)/.test(s)],
 ['V64 preservada',s.includes('V64 — convergência multi-cliente de saldo')],
 ['V65 preservada',s.includes('V65 — a fila é a autoridade para proteção local')],
]
let failed=0
for(const [name,ok] of checks){
  console.log(`${ok?'OK ':'ERR'} ${name}`)
  if(!ok) failed++
}
if(failed) process.exit(1)
console.log('\nV67 ACCOUNT ORPHAN SELF-HEAL — CONTRATO OK')
