import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const wf=fs.readFileSync('.github/workflows/android-build.yml','utf8')
const begin=wf.indexOf('      - name: V163 financial and bot release gate')
const end=wf.indexOf('\n      - name:',begin+12)
assert.ok(begin>=0&&end>begin,'Gate V163 ausente')
const block=wf.slice(begin,end)
const cmds=[
'node node_modules/jest/bin/jest.js --config scripts/jest-financial.cjs --runInBand',
'node scripts/check-r114-financial-invariants.mjs',
'node scripts/check-r116-preapk-integration.mjs',
'node node_modules/jest/bin/jest.js --config scripts/jest-r115-financial.cjs --runInBand --runTestsByPath src/__tests__/financialSurgeryR115.test.ts'
]
for(const cmd of cmds) {
  assert.equal(block.split('\n').filter(x=>x.trim()===cmd).length,1,`Comando ausente/duplicado: ${cmd}`)
}
const indexes=cmds.map(cmd=>block.indexOf(cmd))
assert.ok(indexes.every((v,i)=>i===0||indexes[i-1]<v),'Ordem incorreta')
const config=require('./jest-r115-financial.cjs')
const matches=new Set(config.testMatch||[])
for(const f of [
'<rootDir>/src/__tests__/financialIntegrityV84.test.ts',
'<rootDir>/src/__tests__/financialSurgeryR115.test.ts'
]) assert.ok(matches.has(f),`Suite ausente: ${f}`)
for(const f of [
'scripts/check-r114-financial-invariants.mjs',
'src/__tests__/financialSurgeryR115.test.ts',
'scripts/jest-r115-financial.cjs'
]) assert.ok(fs.statSync(f).size>100,`Arquivo ausente/invalido: ${f}`)
console.log('✓ V84 original preservada')
console.log('✓ R114 e R115 integradas')
console.log('✓ R115 executada separadamente')
console.log('✓ Comandos unicos e ordenados')
console.log('R116 R2 — CONTRATO APROVADO')
