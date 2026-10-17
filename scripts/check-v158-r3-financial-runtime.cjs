const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const path = require('node:path')
const root = process.cwd()
const ts = require(path.join(root, 'node_modules/typescript'))
const realRequire = createRequire(path.join(root, 'package.json'))
const transpile = (file) => {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  const output = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  })
  return output.outputText
}
function loadContract() {
  const exports = {}
  vm.runInNewContext(transpile('src/lib/financialSyncContract.ts'), {
    exports,
    require: realRequire,
    console,
  }, { filename: 'financialSyncContract.js' })
  return exports
}
function loadPages(mock) {
  const exports = {}
  vm.runInNewContext(transpile('src/lib/remoteSyncPages.ts'), {
    exports,
    require(id) {
      if (id === '@/lib/supabase') return { supabase: mock }
      throw new Error('Dependência inesperada: ' + id)
    },
    console
  }, { filename: 'remoteSyncPages.js' })
  return exports
}
const cases = []
function test(name, run) { cases.push([name, run]) }
const f = loadContract()
test('Operação idempotente tem identidade estável', () => {
  assert.equal(f.financialOperationId('fila/transferencia/teste'), f.financialOperationId('fila/transferencia/teste'))
  assert.notEqual(f.financialOperationId('fila/transferencia/teste'), f.financialOperationId('fila/transferencia/outro'))
})
test('Mesmo lote possui identidade estável; edição muda identidade', () => {
  const b = [{ table:'transactions', operation:'update', record_id:'t1', expected_updated_at:null, data:{ amount:12 } }]
  const id = f.batchIdentity(b)
  assert.equal(id, f.batchIdentity(structuredClone(b)))
  b[0].data.amount = 13
  assert.notEqual(id, f.batchIdentity(b))
})
test('Transferência entrada e saída preservam sinais', () => {
  assert.equal(f.transactionCashEffect({status:'done', account_id:'a', amount:100, type:'transfer', transfer_direction:'out'}), -100)
  assert.equal(f.transactionCashEffect({status:'done', account_id:'b', amount:100, type:'transfer', transfer_direction:'in'}), 100)
})
test('Transferência sem direção é indeterminada, não saldo zero fictício', () => {
  assert.equal(f.transactionCashEffect({status:'done', account_id:'a', amount:100, type:'transfer'}), null)
})
test('Transação pendente não entra no caixa', () => {
  assert.equal(f.transactionCashEffect({status:'pending', account_id:'a', amount:500, type:'income'}), 0)
  assert.equal(f.transactionCashEffect({status:'done', account_id:null, amount:500, type:'income'}), 0)
})
test('Receita, despesa e sangria afetam caixa somente quando aplicável', () => {
  assert.equal(f.transactionCashEffect({status:'done', account_id:'a', amount:30, type:'income'}), 30)
  assert.equal(f.transactionCashEffect({status:'done', account_id:'a', amount:30, type:'expense'}), -30)
  assert.equal(f.transactionCashEffect({status:'done', account_id:'a', amount:30, type:'sangria'}), -30)
  assert.equal(f.transactionCashEffect({status:'done', account_id:'a', amount:30, type:'income', affects_balance:false}), 0)
})
test('NaN não produz alteração monetária', () => {
  assert.equal(f.transactionCashEffect({status:'done', account_id:'a', amount:'inválido', type:'expense'}), null)
})
test('Histórico pendente sem base não inventa delta', () => {
  assert.equal(f.expectedSyncBase({sync_status:'pending', updated_at:'2026-01-01'}, 'update'), undefined)
  assert.equal(f.expectedSyncBase({sync_status:'pending'}, 'create').updated_at, null)
})
test('Base de conta guarda saldo e metadados canônicos', () => {
  const base = f.remoteSyncBase({updated_at:'2026-01-01', balance:'123.45', name:'Conta X', context:'pessoal'})
  assert.equal(base.balance, 123.45)
  assert.equal(base.metadata.name, 'Conta X')
})
test('Sincronizado ao tornar-se pendente captura base remota', () => {
  const base = f.rememberSyncBase({sync_status:'pending'}, {sync_status:'synced', updated_at:'2026-01-01', balance:45})
  assert.equal(base._sync_base.balance, 45)
})
function mockSupabase(rows, { error=null, badPage=false }={}) {
  const events = []
  const supabase = { from(table) {
    const state={table, userid:null, since:null, after:null, limit:null}
    const q = {
      select() {return q},
      eq(key,v) {if(key==='user_id')state.userid=v;return q},
      order() {return q},
      limit(v) {state.limit=v;return q},
      gte(k,v) {state.since=v;return q},
      gt(k,v) {state.after=v;return q},
      then(resolve,reject) {
        events.push({...state})
        let chosen=rows.filter(r=>r.user_id===state.userid && (!state.since || r.updated_at>=state.since) && (!state.after || r.id>state.after))
        if(badPage && state.after) chosen=[rows[0]]
        const result=error ? {data:null,error:{message:error}} : {data:chosen.slice(0,state.limit),error:null}
        return Promise.resolve(result).then(resolve,reject)
      }
    }
    return q
  }}
  return {supabase,events}
}
test('Paginação carrega todas as páginas sem truncamento', async () => {
  const rows=Array.from({length:513},(_,i)=>({id:String(i+1).padStart(5,'0'),user_id:'u1',updated_at:'2026-10-16'}))
  const mock=mockSupabase(rows)
  const {fetchRemoteSyncRows}=loadPages(mock.supabase)
  const actual=await fetchRemoteSyncRows('accounts','u1')
  assert.equal(actual.length,513)
  assert.equal(mock.events.length,4)
  assert.ok(mock.events.every(e=>e.limit===250 && e.userid==='u1'))
})
test('Filtro temporal preserva somente registros do recorte', async () => {
  const mock=mockSupabase([{id:'a',user_id:'u1',updated_at:'2026-01-01'},{id:'b',user_id:'u1',updated_at:'2026-10-16'}])
  const {fetchRemoteSyncRows}=loadPages(mock.supabase)
  const actual=await fetchRemoteSyncRows('accounts','u1','2026-10-01')
  assert.deepEqual(Array.from(actual,x=>x.id),['b'])
})
test('Resposta com página que não progride falha fechada', async () => {
  const rows=Array.from({length:251},(_,i)=>({id:String(i+1).padStart(5,'0'),user_id:'u1'}))
  const mock=mockSupabase(rows,{badPage:true})
  const {fetchRemoteSyncRows}=loadPages(mock.supabase)
  await assert.rejects(()=>fetchRemoteSyncRows('accounts','u1'),/Paginação remota incompleta/)
})
test('Erro remoto propaga falha em vez de limpar dados', async () => {
  const mock=mockSupabase([],{error:'rede indisponível'})
  const {fetchRemoteSyncRows}=loadPages(mock.supabase)
  await assert.rejects(()=>fetchRemoteSyncRows('accounts','u1'),/rede indisponível/)
})
;(async()=>{
 let passed=0
 for(const [name,run] of cases) {
   try { await run(); console.log('OK ',name); passed++ }
   catch(e){console.error('ERR',name,e.message);process.exitCode=1}
 }
 console.log(`R3: ${passed}/${cases.length} testes de execução passaram`)
 console.log('Escopo: contratos puros e paginação simulada. Não equivale a teste multi-dispositivo nem testa banco remoto real.')
})().catch(e=>{console.error(e);process.exitCode=1})
