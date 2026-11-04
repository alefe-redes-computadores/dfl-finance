import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const engine = readFileSync('src/lib/commercialSettlement.ts', 'utf8')
const page = readFileSync('src/app/(app)/commercial/simulation/page.tsx', 'utf8')
const entry = readFileSync('src/app/(app)/commercial/page.tsx', 'utf8')
assert.match(engine, /Number\.isSafeInteger/)
assert.match(engine, /Math\.round/)
assert.match(engine, /shortfallCents/)
assert.match(page, /calculateSettlement/)
assert.match(page, /Comparar outro cenário/)
assert.match(page, /Nenhum dado é gravado/)
assert.doesNotMatch(page, /from ['"]@supabase|\.insert\(|\.update\(|\.delete\(/i)
assert.match(entry, /\/commercial\/simulation/)
console.log('R440: contratos estáticos de simulação aprovados')
