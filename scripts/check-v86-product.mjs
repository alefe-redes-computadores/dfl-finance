import { spawnSync } from 'node:child_process'
const checks = [
 ['TypeScript', ['node_modules/typescript/bin/tsc','--noEmit']],
 ['V84 + V85 + V86 / IndexedDB / fórmulas / produto', ['node_modules/jest/bin/jest.js','--config','scripts/jest-release.cjs','--runInBand']],
 ['Postgres isolado / V84 + revisão e transferência V86', ['scripts/check-v86-financial-sql.mjs']],
 ['Handlers Edge simulados', ['scripts/check-v84-edge-runtime.mjs']],
 ['Contratos mobile', ['scripts/check-mobile-readiness.mjs']],
 ['ESLint', ['node_modules/eslint/bin/eslint.js','src','--ext','.js,.jsx,.ts,.tsx','--report-unused-disable-directives','--max-warnings=0']],
]
for (const [name,args] of checks) {
 console.log(`\nV86 — ${name}`)
 const result = spawnSync(process.execPath,args,{stdio:'inherit'})
 if (result.error) throw result.error
 if (result.status !== 0) process.exit(result.status ?? 1)
}
const diff=spawnSync('git',['diff','--check'],{stdio:'inherit'})
if(diff.status!==0)process.exit(diff.status??1)
console.log('\nV86 PRODUTO DIÁRIO: gates locais aprovados. Sem instalação, build ou alteração remota. Release depende de backend, PWA e APK reais.')
