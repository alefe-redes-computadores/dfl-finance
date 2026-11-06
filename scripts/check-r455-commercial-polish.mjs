import fs from 'node:fs'
import assert from 'node:assert/strict'

const commercial = fs.readFileSync('src/app/(app)/commercial/page.tsx', 'utf8')
const overview = fs.readFileSync('src/app/(app)/commercial/overview/page.tsx', 'utf8')
const policy = fs.readFileSync('src/lib/commercialEditPolicy.ts', 'utf8')

for (const table of ['dfl_commercial_organizations', 'dfl_commercial_stores', 'dfl_commercial_platforms']) {
  assert(commercial.includes(`.from('${table}')`), `R455: tabela comercial desapareceu: ${table}`)
}
for (const op of ['updateOrganization', 'updateStore', 'updatePlatformReference',
                  'beginOrganizationEdit', 'beginStoreEdit', 'beginPlatformEdit']) {
  assert(commercial.includes(`function ${op}(`), `R455: ação ausente: ${op}`)
}
assert.equal((commercial.match(/\.select\('id'\)\.single\(\)/g) || []).length, 3,
  'R455: atualizações devem confirmar a linha do usuário no servidor')
assert((commercial.match(/\.eq\('owner_id', user\.id\)/g) || []).length >= 6,
  'R455: escopo owner_id deve proteger leituras e atualizações')
assert(commercial.includes("mode: 'off'"))
assert(commercial.includes('active: false'))
assert(commercial.includes('Não altera provider_key, store_id, organization_id, mode nem active'))
assert(commercial.includes(".select('id,store_id,display_name,provider_key,mode,external_merchant_ref')"))
assert(commercial.includes('showStoreForm') && commercial.includes('showPlatformForm'))
assert(commercial.includes('prepareOrganizationEdit') && commercial.includes('prepareStoreEdit') && commercial.includes('preparePlatformReference'))
assert(overview.includes('Identidade das organizações'))
assert(overview.includes('formatCnpj(item.tax_id)'))
assert(overview.includes(".select('id,name,legal_name,tax_id')"))
assert(policy.includes('isValidCnpj') && policy.includes("url.protocol !== 'https:'"))
assert(!/<select(?:\s|>)/i.test(commercial), 'R455: seletor HTML nativo voltou ao cadastro')
assert(!/<select(?:\s|>)/i.test(overview), 'R455: seletor HTML nativo voltou à central')
console.log('R455: edição com confirmação no Supabase, owner RLS, vínculos e modo OFF preservados; seletor premium e organização 360 OK')
