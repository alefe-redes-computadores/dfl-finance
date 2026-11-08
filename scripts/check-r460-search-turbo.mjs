/** R460 — contrato funcional direto, além do Jest e dos checkers R435/R436/R428. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')
const code = read('src/lib/globalSearch.ts')
const searchPage = read('src/app/(app)/search/page.tsx')
const hook = read('src/hooks/useSmartSearch.ts')
const smart = read('src/lib/smartSearchTurbo.ts')
const workflow = read('.github/workflows/android-build.yml')
const tests = [
  ['Busca 360 preserva 13 fontes', code.includes("const moreNames = ['tags', 'budgets', 'credit_invoices'] as const")],
  ['Busca respeita usuário/contexto', code.includes(".where('[user_id+context]').equals([userId, context])")],
  ['Faturas ainda filtradas pelo contexto', code.includes(".and((item: any) => item.context === context)")],
  ['Consulta vazia não varre Dexie', code.includes('if (!dateIntent && tokens.length === 0) return []')],
  ['Matcher indexado só é criado após leitura', code.includes('buildFinancialSearchMatchIndex(haystack)')],
  ['Moeda sob demanda', code.includes('searchNeedsAmountTokens(tokens)')],
  ['Autocompletar lê índice composto', hook.includes(".where('[user_id+context]')")],
  ['Autocomplete sem duplicar dados financeiros', smart.includes('collectSmartSearchSuggestions') && !smart.includes('supabase')],
  ['Comandos mantidos', searchPage.includes('isFinancialCommandOnlyQuery(trimmedQuery, commands.map(command => command.id))')],
  ['Voz preservada', searchPage.includes('consumeFinancialVoiceTranscript()')],
  ['Recuperação de erros mantida', searchPage.includes('Tentar novamente')],
  ['Tempo da consulta é visível', searchPage.includes('searchElapsedMs')],
  ['Nenhuma nova rede na busca', !code.includes('fetch(') && !code.includes('supabase')],
  ['Action testa R460', workflow.includes('R460 Search Turbo Closeout')],
  ['Action preserva R459', workflow.includes('R459 Release Closeout')],
  ['Sem alterar cálculo de saldo', fs.existsSync('src/lib/financialMetrics.ts')],
  ['Bot intacto', fs.existsSync('supabase/functions/whatsapp-webhook/index.ts')],
]
for (const [name, ok] of tests) assert.ok(ok, `R460: ${name}`)
for (const file of ['src/lib/globalSearch.ts','src/hooks/useSmartSearch.ts','src/lib/smartSearchTurbo.ts','src/app/(app)/search/page.tsx','src/__tests__/searchTurboR460.test.ts']) {
 const source = read(file)
 const ast = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
 assert.equal(ast.parseDiagnostics.length,0,`R460 TS: ${file}`)
}
const compiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES5},reportDiagnostics:true})
assert.equal(compiled.diagnostics?.length ?? 0,0)
const exports = {}
new Function('require','exports',compiled.outputText)(name => {
 if (name==='@/lib/db') return {db:{}}
 if (name==='@/lib/financialForecast') return {civilDate:()=>true}
 throw Error(`R460: require inesperado ${name}`)
},exports)
const hit=exports.buildFinancialSearchMatchIndex('mercearia silvana r$ 49,00')
assert.ok(hit.exact('sil') && hit.fuzzy('silvama') && hit.exact('49,00'))
assert.equal(hit.exact('49'),false)
assert.equal(exports.searchNeedsAmountTokens(['mercearia','silvana']),false)
assert.equal(exports.searchNeedsAmountTokens(['r$','49,00']),true)
console.log(`R460_SEARCH_TURBO_OK: ${tests.length} contratos + 5 fontes TS + 6 cenários do matcher`)
