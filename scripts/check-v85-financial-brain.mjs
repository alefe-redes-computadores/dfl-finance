import { spawnSync } from 'node:child_process'
for(const args of [
 ['scripts/check-v84-financial.mjs'],
 ['node_modules/jest/bin/jest.js','--config','scripts/jest-brain.cjs','--runInBand'],
]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit'})
 if(result.error)throw result.error
 if(result.status!==0)process.exit(result.status??1)
}
console.log('\nV85 CÉREBRO FINANCEIRO: gates locais aprovados. Nenhuma dependência instalada; nenhum dado remoto alterado.')
