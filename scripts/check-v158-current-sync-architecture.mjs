import fs from 'node:fs'
const read = p => fs.readFileSync(p, 'utf8')
const s = read('src/lib/syncEngine.ts')
const hook = read('src/hooks/useLocalSync.ts')
const reports = []
const test = (label, ok, detail) => reports.push({label, ok: Boolean(ok), detail})
// Testes estruturais independentes de literais legados V61/V64/V65.
test('Fila local consultada no mesmo ciclo transacional do pull', /db\.transaction\(['"]rw['"],\s*db\.table\(tableName\),\s*db\.syncQueue/.test(s) && /const latestQueue = await db\.syncQueue/.test(s), 'Evita janela entre consulta da fila e gravação remota')
test('Remote protegido pela fila atual', /const protectedNow = new Set\(latestQueue\.map/.test(s) && /remoteData\.filter\(item => !protectedNow\.has\(item\.id\)\)/.test(s), 'Não substitui mutação pendente')
test('Prune respeita proteção local', /!remoteIds\.has\(item\.id\) && !protectedNow\.has\(item\.id\)/.test(s), 'Não deleta linha protegida')
test('Cursor preservado para linhas remotas ignoradas', /skippedProtectedRemoteRows = true/.test(s) && /if \(!skippedProtectedRemoteRows\)\s*\{\s*localStorage\.setItem\(lastPullKey, remoteHighWater\)/.test(s), 'Remoto ignorado deve reaparecer em pull posterior')
test('Falha de tabela não confirma cursor', /if \(failedTables\.length === 0\)/.test(s), 'Evita perda de dados por pull parcial')
test('Pull tem janela de sobreposição', /Date\.parse\(effectiveLastPull\) - 5 \* 60_000/.test(s), 'Minimiza perdas por pequena defasagem temporal')
test('Snapshot completo periódico', /const fullSnapshot = force \|\| fullDue/.test(s) && /30 \* 60_000/.test(s), 'Restaura dados perdidos por cursores antigos')
test('Snapshot de contas protege mutação concorrente', /const activeQueue = await db\.syncQueue/.test(s) && /if \(activeQueue\) continue/.test(s), 'Evita sobrepor saldo com mudança local')
test('Recuperação de conta órfã revalida fila', /Revalida dentro da transação/.test(s) && /if \(activeQueue\)\s*\{\s*continue/.test(s), 'Evita recuperar conta alterada entre leituras')
test('Ação manual usa modo de pull forçado', /forceSync[\s\S]*?processSyncQueue\(\s*true,\s*true\s*\)/.test(hook), 'Botão pode solicitar reconciliação completa')
let fail=0
for (const t of reports){console.log(`${t.ok?'OK ':'ERR'} ${t.label} — ${t.detail}`);if(!t.ok) fail++}
console.log(`\nV158: ${reports.length-fail}/${reports.length} contratos estáticos verificados`)
console.log('Limite: inspeção estática não substitui teste concorrente multi-dispositivo nem valida saldo real.')
if(fail)process.exitCode=1
