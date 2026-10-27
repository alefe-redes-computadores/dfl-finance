import fs from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
const source=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const a=source.indexOf('/* R120: periodos financeiros civis.')
const b=source.indexOf('\nconst pendingFilters=',a)
assert.ok(a>0&&b>a,'Parser R120 não encontrado')
const period=source.slice(a,b)
const aliases={jan:1,janeiro:1,fev:2,fevereiro:2,mar:3,marco:3,abr:4,abril:4,mai:5,maio:5,jun:6,junho:6,jul:7,julho:7,ago:8,agosto:8,set:9,setembro:9,out:10,outubro:10,nov:11,novembro:11,dez:12,dezembro:12}
const months=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
function parse(s,reference='2026-10-26'){
 const ctx={N:normalize,day:()=>reference,monthAliases:aliases,monthNames:months,Date};ctx.globalThis=ctx
 const js=ts.transpileModule(period+'\n;globalThis.r120Parse=pendingPeriod;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 vm.runInNewContext(js,ctx,{timeout:2000})
 return JSON.parse(JSON.stringify(ctx.r120Parse(s)))
}
const cases=[
 ['Pendências NOV/26','2026-11-01','2026-11-30'],
 ['pendências novembro de 2026','2026-11-01','2026-11-30'],
 ['pendencias 2026-11','2026-11-01','2026-11-30'],
 ['pendências este mês','2026-10-01','2026-10-31'],
 ['pendências mês passado','2026-09-01','2026-09-30'],
 ['pendências próximo mês','2026-11-01','2026-11-30'],
 ['pendências fevereiro 2028','2028-02-01','2028-02-29'],
 ['pendências 02/27','2027-02-01','2027-02-28'],
 ['pendências mês passado','2026-12-01','2026-12-31','2027-01-03'],
 ['pendências próximo mês','2027-01-01','2027-01-31','2026-12-29'],
]
for(const [q,start,end,reference] of cases){const x=parse(q,reference);assert.equal(x.start,start,q);assert.equal(x.end,end,q);assert.equal(x.explicit,true,q);console.log('✓',q,'=>',start)}
const defaultPeriod=parse('pendências');assert.equal(defaultPeriod.explicit,false);assert.equal(defaultPeriod.start,'2026-10-01')
assert.ok(!period.includes('db.rpc(')&&!period.includes('db.from('),'parser não realiza operações financeiras')
console.log('R120 — períodos conversacionais aprovados')
