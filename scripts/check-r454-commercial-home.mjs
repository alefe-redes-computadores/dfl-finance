import fs from 'node:fs'
import assert from 'node:assert/strict'

const load = file => fs.readFileSync(file, 'utf8')
const C = load('src/app/(app)/commercial/page.tsx')
const O = load('src/app/(app)/commercial/overview/page.tsx')
const L = load('src/app/(app)/commercial/operation/page.tsx')
const H = load('src/app/(app)/home/page.tsx')
const P = load('src/components/home/HomeDecisionPulse.tsx')
const identity = load('src/lib/commercialIdentity.ts')

for (const [name, source] of [['cadastros', C], ['central', O], ['laboratorio', L]]) {
  assert(!/<select(?:\s|>)/i.test(source), `${name}: select HTML nativo detectado`)
  assert(source.includes('SelectField'), `${name}: selector premium ausente`)
}
assert(C.includes(".select('id,name,legal_name,tax_id')"))
assert(C.includes('tax_id: cleanCnpj(taxId) || null'))
assert(C.includes('CNPJ · {formatCnpj(organization.tax_id)}'))
assert(C.includes('isValidCnpj(taxId)'))
assert(C.includes("mode: 'off'"))
assert(C.includes('active: false'))
assert(C.includes('showOrganizationForm'))
for (const route of ['/commercial/overview', '/commercial/simulation', '/commercial/ledger', '/commercial/operation']) {
  assert(C.includes(route), `atalho comercial ausente: ${route}`)
}
assert(H.includes('HomeDecisionPulse'))
assert(H.includes('homePriorityAlerts.slice(\n        0,\n        2\n      )'))
assert(H.includes('homePriorityAlerts.length} prioridades identificadas'))
assert(H.includes('Ver todas as prioridades'))
assert(P.includes('grid grid-cols-2 gap-px'))
assert(identity.includes('cleanCnpj') && identity.includes('isValidCnpj'))
console.log('R454: 19 contratos de escopo, segurança OFF, CNPJ, selects premium e Home OK')
