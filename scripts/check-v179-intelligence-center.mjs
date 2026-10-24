import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const nav = 'src/lib/financeIntelligenceNavigation.ts'
const page = 'src/app/(app)/intelligence-center/page.tsx'
const more = 'src/app/(app)/more/page.tsx'
const navSource = fs.readFileSync(nav, 'utf8')
const pageSource = fs.readFileSync(page, 'utf8')
const moreSource = fs.readFileSync(more, 'utf8')

let count = 0
const check = (title, test) => {
  test()
  count++
  console.log('✓', title)
}

for (const file of [nav, page]) {
  check(`Sintaxe TS/TSX: ${file}`, () => {
    const parsed = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    assert.equal(parsed.parseDiagnostics.length, 0)
  })
}

const js = ts.transpileModule(navSource, {
  fileName: nav,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText

const api = {}
new Function('exports', js)(api)
const groups = api.intelligenceGroups
const routes = api.intelligenceRouteSet()

check('Quatro grupos distintos', () => {
  assert.deepEqual(groups.map(g => g.id), [
    'understand', 'review', 'anticipate', 'plan'
  ])
})

check('Cada grupo tem ferramentas', () => {
  assert.ok(groups.every(g => g.links.length >= 2))
})

check('IDs únicos em todas as ferramentas', () => {
  const ids = groups.flatMap(g => g.links.map(l => l.id))
  assert.equal(new Set(ids).size, ids.length)
})

check('Rotas únicas', () => {
  assert.equal(routes.length, new Set(routes).size)
})

check('Todas as rotas são internas', () => {
  assert.ok(routes.every(href =>
    /^\/[a-z][a-z0-9-/]*$/.test(href) &&
    !href.includes('//')
  ))
})

check('Central aponta para as quatro versões recentes', () => {
  for (const href of [
    '/monthly-review',
    '/financial-health',
    '/financial-trends',
    '/commitment-center'
  ]) {
    assert.ok(routes.includes(href), href)
  }
})

check('Central preserva Revisão e Conciliação', () => {
  assert.ok(routes.includes('/review'))
  assert.ok(routes.includes('/conciliation'))
})

check('Central preserva Agenda e Radar', () => {
  assert.ok(routes.includes('/agenda'))
  assert.ok(routes.includes('/cash-pressure'))
})

check('Central preserva Ritmo e Planejamento', () => {
  assert.ok(routes.includes('/spending-pulse'))
  assert.ok(routes.includes('/planning'))
})

check('Rotas possuem páginas existentes', () => {
  for (const href of routes) {
    const file = `src/app/(app)${href}/page.tsx`
    assert.ok(fs.existsSync(file), `Página ausente: ${file}`)
  }
})

check('Acesso único no menu Mais', () => {
  assert.equal(
    (moreSource.match(/href="\/intelligence-center"/g) || []).length,
    1
  )
})

check('Atalhos V175–V178 permanecem acessíveis', () => {
  for (const href of [
    '/monthly-review',
    '/financial-health',
    '/financial-trends',
    '/commitment-center'
  ]) {
    assert.ok(moreSource.includes('href="' + href + '"'))
  }
})


check('Busca funcional conectada ao estado', () => {
  assert.ok(pageSource.includes('setQuery('))
  assert.ok(pageSource.includes('useMemo('))
  assert.ok(pageSource.includes('haystack.includes(search)'))
})

check('Filtros conectados ao estado', () => {
  assert.ok(pageSource.includes('setFilter('))
  assert.ok(
    pageSource.includes("filter === 'all' || group.id === filter")
  )
})

check('Links usam navegação sem prefetch', () => {
  assert.ok(pageSource.includes('prefetch={false}'))
  assert.ok(pageSource.includes('href={link.href}'))
})

check('ContextToggle presente', () => {
  assert.ok(pageSource.includes('<ContextToggle/>'))
})

check('Central não importa motores financeiros', () => {
  assert.ok(!/from ['"]@\/lib\/finance(Agenda|Pressure|Health|MonthlyReview|Trends|Planning)/.test(pageSource))
})

check('Central não consulta tabelas', () => {
  assert.ok(!/useLocalData|useLiveQuery|useUserSettings|supabase\./.test(pageSource))
})

check('Central não faz operações financeiras', () => {
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|safeAdd|safeUpdate/.test(pageSource))
})

check('Catálogo é puramente estático', () => {
  assert.ok(!/supabase|fetch\(|localStorage|useLocalData/.test(navSource))
})

check('Motores anteriores preservados', () => {
  for (const file of [
    'src/lib/financeMonthlyReview.ts',
    'src/lib/financeHealth.ts',
    'src/lib/financeTrends.ts',
    'src/lib/financeCommitmentCenter.ts'
  ]) assert.ok(fs.existsSync(file))
})

console.log(`V179: ${count} contratos aprovados.`)
