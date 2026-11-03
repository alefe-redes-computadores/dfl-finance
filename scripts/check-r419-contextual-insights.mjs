import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const sourcePath = 'src/lib/contextualInsightEngine.ts'
const src = fs.readFileSync(sourcePath,'utf8')
const file = ts.createSourceFile(sourcePath,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
assert.equal(file.parseDiagnostics.length,0,'R419 engine TS syntax')
const js = ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const exports = {}
new Function('exports',js)(exports)
const {buildContextualInsights: build, nextContextualInsight: choose} = exports
const at = new Date(2026,10,3,12)
const tx = (id,date,type,status,amount,extras={}) => ({id,date,type,status,amount,context:'dfl',...extras})
const dataset = [
  tx('e1','2026-11-01','expense','done',160,{category_id:'food',credit_card_id:'card-1'}),
  tx('e2','2026-11-02','expense','done',140,{category_id:'gas',credit_card_id:'card-1'}),
  tx('e3','2026-11-03','expense','done',100,{category_id:'food'}),
  tx('i1','2026-11-03','income','done',800),
  tx('i2','2026-11-02','income','done',300),
  tx('p1','2026-11-03','expense','pending',80),
  tx('o1','2026-10-01','expense','done',100,{category_id:'food'}),
  tx('o2','2026-10-02','expense','done',100,{category_id:'gas'}),
  tx('o3','2026-10-03','expense','done',100,{category_id:'food'}),
  tx('future','2026-11-15','expense','pending',99),
  tx('transfer','2026-11-03','transfer','done',2000000),
  tx('other','2026-11-03','expense','done',999999,{context:'personal'}),
  tx('invalid','2026-11-02','expense','done','NaN'),
  tx('zero','2026-11-03','expense','done',0),
]
let tested=0
function ok(condition,message){assert.ok(condition,message);tested++}
const home=build('home','dfl',dataset,at)
const trx=build('transactions','dfl',dataset,at)
const analysis=build('analysis','dfl',dataset,at)
const cards=build('cards','dfl',dataset,at)
ok(home[0]?.id==='pending-this-month','Home pending is prioritized')
ok(analysis[0]?.id==='expense-comparison','Analysis compares equivalent day window')
ok(cards[0]?.id==='card-activity','Cards prioritizes card-linked completed expenses')
ok(trx[0]?.basis==='pending','Transactions prioritizes pending')
ok(home.some(x=>x.id==='monthly-activity'&&x.detail.includes('3 despesas concluídas')),'No double count transfers or other context')
ok(home.some(x=>x.id==='expense-comparison'&&x.detail.includes('33% acima')),'Comparison uses previous month same days')
ok(home.some(x=>x.id==='pending-this-month'&&x.detail.includes('1 lançamento pendente')),'Future pending does not pollute')
ok(cards[0].detail.includes('2 despesas concluídas'), 'Card-linked expense count excludes other rows')
ok(analysis.every(x=>x.href.startsWith('/')&&!x.href.startsWith('//')&&!x.href.includes('javascript:')),'Safe local destinations')
ok(home.every(x=>!x.detail.includes('2000000')&&!x.detail.includes('999999')),'Exclude transfers and foreign context')
ok(choose(home,home[0]?.id)?.id!==home[0]?.id,'Rotate if alternatives exist')
ok(choose([home[0]],home[0]?.id)?.id===home[0]?.id,'Single safe fallback')
ok(choose([],null)===null,'No evidence = no insight')
ok(build('home','dfl',[],at).length===0,'Empty = quiet')
ok(build('home','personal',dataset,at).length===0,'Cross context does not fall through')
ok(build('home','dfl',[tx('t','2026-11-03','transfer','done',100000)],at).length===0,'Transfers alone no insight')
ok(build('home','dfl',[tx('t','2026-11-03','expense','pending',100)],at)[0]?.basis==='pending','Pending appropriately worded')
ok(!src.includes('fetch(')&&!src.includes('supabase')&&!src.includes('.add('),'Pure deterministic engine')
const component='src/components/ContextualInsightCard.tsx'
const ui=fs.readFileSync(component,'utf8')
const bar=fs.readFileSync('src/components/ContextualCommandBar.tsx','utf8')
const ci=fs.readFileSync('.github/workflows/android-build.yml','utf8')
for(const p of [component,'src/components/ContextualCommandBar.tsx']) {
  const contents=fs.readFileSync(p,'utf8')
  const ast=ts.createSourceFile(p,contents,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  ok(ast.parseDiagnostics.length===0,'TSX parse '+p)
}
ok(ui.includes("where('[user_id+context+date]')"),'Indexed DB filtered by user/context/date')
ok(ui.includes('sessionStorage') && !ui.includes('localStorage'),'Only short-lived local rotation')
ok(ui.includes('COOLDOWN_MS = 20 * 60 * 1000'),'Cooldown')
ok(ui.includes('SHOW_COOLDOWN_MS = 3 * 60 * 1000'),'No repeated reentry animation')
ok(ui.includes('Dispensar insight'),'Dismissable')
ok(ui.includes('Baseado nos lançamentos locais'),'No AI hallucination')
ok(ui.includes('prefers-reduced-motion')===false && ui.includes('motion-reduce:'),'Reduce motion supported via Tailwind')
ok(!ui.includes('fetch(')&&!ui.includes('supabase')&&!ui.includes('.put(')&&!ui.includes('.add('),'No remote or financial write in insight UI')
ok(bar.includes('<ContextualInsightCard scope={scope} />'),'Shared UI on all four contexts')
ok(ci.includes('node scripts/check-r419-contextual-insights.mjs'),'CI gates R419')
console.log(`R419: ${tested} contratos de dados reais, separação, privacidade, UX e CI aprovados`)
