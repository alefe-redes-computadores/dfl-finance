import fs from 'node:fs'
const queue=fs.readFileSync('src/components/admin/SyncQueueTable.tsx','utf8')
const home=fs.readFileSync('src/app/(app)/home/page.tsx','utf8')
const engine=fs.readFileSync('src/lib/syncEngine.ts','utf8')
const checks=[
 ['fila usa usuário autenticado',queue.includes('useAuth()')&&queue.includes('user?.id')],
 ['fila não lê todos os usuários',!queue.includes('db.syncQueue.toArray()')],
 ['fila filtra user_id',queue.includes(".where('user_id')")&&queue.includes('.equals(user.id)')],
 ['fila usa liveQuery',queue.includes("import { liveQuery } from 'dexie'")&&queue.includes('liveQuery(() =>')],
 ['subscription desmontada',queue.includes('subscription.unsubscribe()')],
 ['refresh manual preservado',queue.includes('handleRefresh')],
 ['Home mantém Atualizando saldo',home.includes('Atualizando saldo…')],
 ['Home confirma Saldo atualizado',home.includes('Saldo atualizado')&&home.includes('showBalanceUpdated')],
 ['feedback expira em 1500ms',home.includes('setTimeout(() => setShowBalanceUpdated(false), 1500)')],
 ['offline preservado',home.includes('Saldo salvo no dispositivo')],
 ['V67 preservada',engine.includes('healOrphanAccountSyncStates')],
 ['V68 preservada',engine.includes('reconcileAccountBalancesFast')],
]
let failed=0
for(const [label,ok] of checks){if(ok)console.log(`OK  ${label}`);else{failed++;console.error(`ERRO ${label}`)}}
if(failed)process.exit(1)
console.log('\nV69 FINAL POLISH — CONTRATO OK')
