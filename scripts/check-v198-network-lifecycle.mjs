import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const path='src/components/NetworkStatus.tsx'
const s=fs.readFileSync(path,'utf8')
const old=fs.readFileSync(
  'scripts/check-v197-offline-query.mjs','utf8'
)
const flow=fs.readFileSync(
  '.github/workflows/android-build.yml','utf8'
)

let total=0
function check(name,condition){
  assert.ok(condition,name)
  total++
  console.log('✓',name)
}

const ast=ts.createSourceFile(
  path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
)

check('TSX valido',ast.parseDiagnostics.length===0)
check('Aviso com identidade propria',
  s.includes('<NetworkNoticeBanner key={notice.key} notice={notice} />'))
check('Estado de dispensa local',
  s.includes('const [dismissed, setDismissed] = useState(false)'))
check('Dispensa por acao explicita',
  s.includes('setDismissed(true)'))
check('Sem refs mutadas durante render',
  !s.includes('cycleRef.current += 1'))
check('Sem estado global de dispensa',
  !s.includes('setDismissedKey'))
check('Politica da V183 preservada',
  s.includes('shouldShowNetworkNotice('))
check('Offline continua acessivel',
  s.includes("notice.kind === 'offline' ? 'alert'"))
check('Feedback tatil preservado',
  s.includes('light()'))
check('Safe area preservada',
  s.includes('env(safe-area-inset-top)'))
check('Movimento reduzido preservado',
  s.includes('motion-reduce:animate-none'))
check('Sem leituras de rede adicionadas',
  !/fetch\(|supabase|useLocalSync/.test(s))
check('Contrato V197 ainda executado',
  old.includes('transactionMatchesFilters('))
check('Workflow exige V198',
  flow.includes('node scripts/check-v198-network-lifecycle.mjs'))

console.log(`V198: ${total} contratos aprovados.`)
