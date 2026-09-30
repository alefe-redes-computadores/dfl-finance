import fs from 'node:fs'
const engine=fs.readFileSync('src/lib/syncEngine.ts','utf8')
const hook=fs.readFileSync('src/hooks/useLocalSync.ts','utf8')
const home=fs.readFileSync('src/app/(app)/home/page.tsx','utf8')
const checks=[
 ['fast path consulta somente accounts',/reconcileAccountBalancesFast[\s\S]*?from\('accounts'\)[\s\S]*?eq\('user_id', userId\)/.test(engine)],
 ['fast path não consulta transactions',!(/reconcileAccountBalancesFast[\s\S]*?from\('transactions'\)/.test(engine))],
 ['fila de accounts protege edição legítima',engine.includes("item.table === 'accounts'")&&engine.includes('if (activeQueue) continue')],
 ['saldo remoto normalizado em centavos',engine.includes('Math.round(Number(remoteAccount.balance ?? 0) * 100) / 100')],
 ['boot prioriza saldo antes do sync geral',/reconcileAccountBalancesFast\(userId\)[\s\S]*?processSyncQueue\(false\)/.test(engine)],
 ['hook expõe reconciliação prioritária',hook.includes('reconcileBalance')],
 ['Home remove atraso de 1500ms',!home.includes('}, 1500)')],
 ['Home dispara saldo antes do full sync',/reconcileBalance\(\)[\s\S]*?forceSync\(\)/.test(home)],
 ['Home sinaliza saldo em validação',home.includes('Atualizando saldo…')],
 ['offline identifica saldo local',home.includes('Saldo salvo no dispositivo')],
 ['V67 preservada',engine.includes('V67 — autocura explícita de contas órfãs')],
]
let failed=0
for(const [name,ok] of checks){console.log(`${ok?'OK ':'ERR'} ${name}`);if(!ok)failed++}
if(failed)process.exit(1)
console.log('\nV68 FAST BALANCE RECONCILIATION — CONTRATO OK')
