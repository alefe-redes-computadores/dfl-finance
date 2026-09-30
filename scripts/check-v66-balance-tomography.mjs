import fs from 'node:fs'
const s=fs.readFileSync('src/components/admin/AdminSyncDiagnostics.tsx','utf8')
const checks=[
 ['tomografia compara Dexie e Supabase',s.includes("from('accounts')")&&s.includes("select('id, name, balance, updated_at')")],
 ['lê fila local de accounts',s.includes("item.table === 'accounts'")&&s.includes('item.record_id === local.id')],
 ['mostra local e remoto',s.includes('localBalance')&&s.includes('remoteBalance')],
 ['mostra timestamps',s.includes('localUpdatedAt')&&s.includes('remoteUpdatedAt')],
 ['mostra sync_status',s.includes('localSyncStatus')],
 ['mostra revisão/tentativas/erro da fila',s.includes('revision:')&&s.includes('attempts:')&&s.includes('lastError:')],
 ['painel explicitamente somente leitura',s.includes('Somente leitura.')],
 ['nenhuma escrita de account adicionada',!s.includes('db.accounts.put(')&&!s.includes('db.accounts.update(')&&!s.includes("from('accounts').update")],
]
let failed=0
for(const [name,ok] of checks){console.log(`${ok?'OK ':'ERR'} ${name}`);if(!ok)failed++}
if(failed)process.exit(1)
console.log('\nV66 BALANCE TOMOGRAPHY — CONTRATO OK')
