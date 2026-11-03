import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')
let checks = 0
const eq = (label, actual, expected) => { assert.deepEqual(actual, expected, label); checks++ }
const ok = (label, value) => { assert.ok(value, label); checks++ }
const helpPath = 'src/lib/financialCommandHelp.ts'
const source = read(helpPath)
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true })
eq('Ajuda transpila sem diagnosticos', (js.diagnostics || []).length, 0)
const exports = {}
new Function('exports', js.outputText)(exports)
const resolve = exports.resolveFinancialHelp

for (const phrase of ['ajuda','me ajuda','preciso de ajuda','Como usar?','como funciona','o que você faz?','o que o DFL faz','o que posso fazer aqui','quais comandos','comandos disponíveis','mostrar exemplos','oi','Olá','bom dia','boa tarde','boa noite']) {
  eq(`Ajuda geral: ${phrase}`, resolve(phrase)?.id, 'overview')
}
for (const [phrase, topic] of [
  ['como cadastrar uma despesa','launch'], ['me ajude com nova receita','launch'],
  ['como registrar lançamento','launch'], ['como transferir dinheiro','transfer'],
  ['me ajuda com transferência','transfer'], ['como conciliar','inbox'],
  ['o que é Inbox financeira','inbox'], ['como revisar pendências','inbox'],
  ['onde vejo comprovantes','receipts'], ['como anexar recibo','receipts'],
  ['como funciona cartão','cards'], ['onde vejo fatura','cards'],
  ['como usar planejamento','planning'], ['como criar meta','planning'],
  ['como organizar categorias','organize'], ['como funciona assinatura','organize'],
  ['como encontrar uma transação','search'], ['onde pesquisar valor','search'],
  ['quando usar o Gemini','assistant'], ['falar com o assistente','assistant'],
  ['perguntar ao Gemini','assistant'],
]) eq(`Topico: ${phrase}`, resolve(phrase)?.id, topic)

for (const phrase of ['nova despesa','transferir 50 para Nubank','pague 20 de gasolina','quanto gastei este mês','Nubank outubro','excluir cartão','x'.repeat(241)]) {
  eq(`Ajuda nao sequestra comando ou dado: ${phrase.slice(0, 40)}`, resolve(phrase), null)
}
for (const topic of ['overview','launch','transfer','inbox','receipts','cards','planning','organize','search','assistant']) {
  const found = resolve(topic === 'overview' ? 'ajuda' : ({ launch:'como lançar despesa', transfer:'como transferir', inbox:'como conciliar', receipts:'onde vejo comprovantes', cards:'onde vejo fatura', planning:'como usar planejamento', organize:'como organizar categorias', search:'como encontrar transação', assistant:'quando usar Gemini' })[topic])
  ok(`${topic}: exemplos`, found.examples.length >= 2)
  ok(`${topic}: rotas`, found.actions.length >= 1 && found.actions.every(item => /^\/(?!\/)/.test(item.href)))
}
ok('Motor de ajuda sem rede, banco ou escrita', !/\b(fetch|localStorage|sessionStorage|indexedDB|supabase|db\.|\.add\(|\.put\()/.test(source))

for (const path of [helpPath,'src/components/FinancialCommandHelp.tsx','src/app/(app)/search/page.tsx']) {
  const ast = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  eq(`Sintaxe ${path}`, ast.parseDiagnostics.length, 0)
}
const search = read('src/app/(app)/search/page.tsx')
const ui = read('src/components/FinancialCommandHelp.tsx')
const workflow = read('.github/workflows/android-build.yml')
for (const [label, value] of [
  ['Ajuda vem depois de comandos e resposta deterministica', search.indexOf('const helpIntent') > search.indexOf('const commandOnly') && search.indexOf('const helpIntent') > search.indexOf('const readOnlyIntent')],
  ['Ajuda evita varredura da Busca 360', search.includes('if (helpIntent) {') && search.indexOf('if (helpIntent) {') < search.indexOf('if (readOnlyIntent) {')],
  ['Ajuda usa componente dedicado', search.includes('<FinancialCommandHelp topic={helpIntent}')],
  ['Exemplo apenas preenche nova consulta', search.includes('setQuery(value); setHubVoiceEntry(false)')],
  ['Handoff Gemini continua expresso', search.includes('stageAssistantQuestionHandoff') && search.includes('onTalk={continueWithGemini}')],
  ['Handoff nao dispara envio', !search.match(/continueWithGemini[^}]*handleSend\(/)],
  ['Resposta local R430 preservada', search.includes('<FinancialReadOnlyAnswer question={readOnlyIntent}')],
  ['Comandos R429 preservados', search.includes('resolveExtendedFinancialCommands(trimmedQuery)')],
  ['Rascunho financeiro preservado', search.includes('smartDraftUrl(smartDraft)')],
  ['Ajuda declara somente leitura', ui.includes('Sem executar') && ui.includes('Nenhuma ação financeira é confirmada silenciosamente')],
  ['Ajuda acessivel', ui.includes('aria-label="Ajuda do DFL Comando"') && ui.includes('focus-visible:outline')],
  ['Workflow preserva R430', workflow.includes('node scripts/check-r430-hybrid-finance.mjs')],
  ['Workflow executa R431', workflow.includes('node scripts/check-r431-final-command-help.mjs')],
]) ok(label, value)
console.log(`R431: ${checks} contratos de ajuda, frases, seguranca, Gemini opt-in, UI e CI aprovados`)
