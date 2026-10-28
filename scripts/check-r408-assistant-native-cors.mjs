import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const policyPath = 'src/lib/server/assistantNativeCors.ts'
const policy = fs.readFileSync(policyPath, 'utf8')
const route = fs.readFileSync(
  'src/app/api/assistant/chat/route.ts',
  'utf8'
)
const client = fs.readFileSync(
  'src/lib/services/chatService.ts',
  'utf8'
)
const workflow = fs.readFileSync(
  '.github/workflows/android-build.yml',
  'utf8'
)

const parsed = ts.createSourceFile(
  policyPath,
  policy,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
)

assert.equal(parsed.parseDiagnostics.length, 0)

const js = ts.transpileModule(policy, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText

const exports = {}
new Function('exports', js)(exports)

const { assistantNativePreflight, withAssistantNativeCors } = exports

const makeRequest = (origin, method = 'POST', headers = 'authorization,content-type') =>
  new Request(
    'https://dfl-finance.vercel.app/api/assistant/chat',
    {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': method,
        'Access-Control-Request-Headers': headers,
      },
    }
  )

let count = 0
function check(name, fn) {
  fn()
  count++
  console.log('OK:', name)
}

check('Android HTTPS permitido', () => {
  const result = assistantNativePreflight(makeRequest('https://localhost'))
  assert.equal(result.status, 204)
  assert.equal(
    result.headers.get('Access-Control-Allow-Origin'),
    'https://localhost'
  )
})

check('POST e OPTIONS anunciados', () => {
  const result = assistantNativePreflight(makeRequest('https://localhost'))
  assert.match(result.headers.get('Access-Control-Allow-Methods'), /POST/)
  assert.match(result.headers.get('Access-Control-Allow-Methods'), /OPTIONS/)
})

check('Authorization e JSON permitidos', () => {
  const result = assistantNativePreflight(makeRequest('https://localhost'))
  assert.match(result.headers.get('Access-Control-Allow-Headers'), /Authorization/)
  assert.match(result.headers.get('Access-Control-Allow-Headers'), /Content-Type/)
})

check('Origem desconhecida negada', () => {
  const result = assistantNativePreflight(makeRequest('https://attacker.example'))
  assert.equal(result.status, 403)
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), null)
})

check('Origem HTTP antiga negada', () => {
  const result = assistantNativePreflight(makeRequest('http://localhost'))
  assert.equal(result.status, 403)
})

check('Metodo diferente de POST negado', () => {
  const result = assistantNativePreflight(makeRequest('https://localhost', 'DELETE'))
  assert.equal(result.status, 405)
})

check('Header arbitrario negado', () => {
  const result = assistantNativePreflight(
    makeRequest('https://localhost', 'POST', 'authorization,x-custom-admin')
  )
  assert.equal(result.status, 400)
})

check('Resposta 401 recebe CORS', () => {
  const request = makeRequest('https://localhost')
  const response = withAssistantNativeCors(
    request,
    Response.json({ error: 'auth' }, { status: 401 })
  )
  assert.equal(response.status, 401)
  assert.equal(
    response.headers.get('Access-Control-Allow-Origin'),
    'https://localhost'
  )
})

check('Streaming mantém body e CORS', async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('Resposta teste'))
      controller.close()
    },
  })
  const response = withAssistantNativeCors(
    makeRequest('https://localhost'),
    new Response(body)
  )
  assert.equal(await response.text(), 'Resposta teste')
  assert.equal(
    response.headers.get('Access-Control-Allow-Origin'),
    'https://localhost'
  )
})

check('PWA não recebe origem artificial', () => {
  const response = withAssistantNativeCors(
    new Request('https://dfl-finance.vercel.app/api/assistant/chat'),
    new Response('ok')
  )
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
})

check('Autenticacao por token preservada', () => {
  assert.ok(route.includes("supabase.auth"))
  assert.ok(route.includes(".getUser("))
  assert.ok(route.includes("status: 401"))
  assert.ok(route.includes('withAssistantNativeCors(request, response)'))
  assert.ok(route.includes('assistantNativePreflight(request)'))
})

check('Erro de conexão traduzido no app', () => {
  assert.ok(client.includes("'network'"))
  assert.ok(client.includes('error instanceof TypeError'))
  assert.ok(client.includes('resolveApiUrl'))
})

check('CI exige regressão R408', () => {
  assert.ok(
    workflow.includes(
      'node scripts/check-r408-assistant-native-cors.mjs'
    )
  )
})

console.log(`R408: ${count} contratos aprovados`)
