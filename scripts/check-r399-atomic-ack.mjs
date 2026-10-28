import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const policy='src/lib/atomicAckPolicy.ts'
const atomic='src/lib/atomicFinancialSync.ts'
const read=p=>fs.readFileSync(p,'utf8')

const compiled=ts.transpileModule(
  read(policy),
  {
    fileName:policy,
    compilerOptions:{
      module:ts.ModuleKind.CommonJS,
      target:ts.ScriptTarget.ES2022
    }
  }
).outputText

const mod={exports:{}}
new Function('module','exports',compiled)(
  mod,mod.exports
)

const validate=mod.exports.validateAtomicAck

const envelope={
  id:'lote-r399',
  items:[
    {
      table:'accounts',
      record_id:'conta-1',
      operation:'update'
    },
    {
      table:'transactions',
      record_id:'tx-1',
      operation:'create'
    }
  ]
}

const good={
  batch_id:'lote-r399',
  status:'committed',
  versions:{
    'accounts/conta-1':'2026-10-28T10:00:00Z',
    'transactions/tx-1':'2026-10-28T10:00:00Z'
  },
  accounts:{
    'conta-1':{balance:125.50}
  }
}

assert.doesNotThrow(()=>validate(envelope,good))
console.log('OK: confirmação íntegra')

function rejects(label,response,env=envelope){
  assert.throws(
    ()=>validate(env,response),
    Error,
    label
  )
  console.log('OK:',label)
}

rejects('lote errado',{
  ...good,
  batch_id:'outro'
})

rejects('nao confirmado',{
  ...good,
  status:'pending'
})

rejects('versoes ausentes',{
  ...good,
  versions:null
})

rejects('versao faltando',{
  ...good,
  versions:{
    'accounts/conta-1':'2026-10-28T10:00:00Z'
  }
})

rejects('versao vazia',{
  ...good,
  versions:{
    ...good.versions,
    'transactions/tx-1':''
  }
})

rejects('conta sem snapshot',{
  ...good,
  accounts:{}
})

rejects('saldo nao numerico',{
  ...good,
  accounts:{
    'conta-1':{balance:'invalido'}
  }
})

rejects('saldo ausente',{
  ...good,
  accounts:{
    'conta-1':{}
  }
})

rejects('registro duplicado',
  good,
  {
    ...envelope,
    items:[...envelope.items,envelope.items[0]]
  }
)

assert.doesNotThrow(()=>validate(
  {
    id:'lote-delete',
    items:[{
      table:'accounts',
      record_id:'conta-excluida',
      operation:'delete'
    }]
  },
  {
    batch_id:'lote-delete',
    status:'committed',
    versions:{
      'accounts/conta-excluida':null
    }
  }
))

console.log('OK: exclusão confirmada')

const source=read(atomic)

assert(
  source.includes('validateAtomicAck(envelope, data)')
)

assert(
  source.includes('await acknowledgeOutbox(')
)

assert(
  source.indexOf('validateAtomicAck(envelope, data)') <
  source.indexOf('await acknowledgeOutbox(envelope, data.versions')
)

for(const contract of [
  'db.financialOutbox.delete(envelope.user_id)',
  'db.syncQueue.delete(current.id)',
  'sameRevision',
  'expectedSyncBase',
  'batchIdentity(items)',
  'pushAtomicFinancialBatch',
  "supabase.rpc('dfl_commit_financial_batch'",
  'markSyncFailedIfCurrent'
]){
  assert(source.includes(contract),contract)
}

for(const path of [policy,atomic]){
  const ast=ts.createSourceFile(
    path,read(path),
    ts.ScriptTarget.Latest,true,ts.ScriptKind.TS
  )
  assert.equal(ast.parseDiagnostics.length,0,path)
}

console.log('R399: contratos de ACK aprovados')
