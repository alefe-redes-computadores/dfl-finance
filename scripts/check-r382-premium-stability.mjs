import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read=path=>fs.readFileSync(path,'utf8')
const hook=read('src/hooks/useLocalSync.ts')
const badge=read('src/components/SyncStatusIndicator.tsx')

const paths=[
  'src/app/(app)/accounts/page.tsx',
  'src/app/(app)/cards/page.tsx',
]

const checks=[]

function check(name,condition){
  checks.push([name,Boolean(condition)])
}

check('Snapshot compartilhado',
  hook.includes('useSyncExternalStore'))

check('Fila de sincronizacao',
  hook.includes('getSyncQueueDiagnostics'))

check('Feedback de falha',
  hook.split('Erro inesperado na sincronização.').length-1===2)

check('Falhas remotas explicitas',
  hook.includes('pullFailedTables'))

check('Sucesso silencioso',
  hook.includes('silentSuccess'))

check('Indicador com modal',
  badge.includes('SyncStatusModal'))

check('Estado do modal acessivel',
  badge.includes('aria-expanded={open}'))

check('Contador de pendencias',
  badge.includes('status.pending > 0'))

for(const path of paths){
  const source=read(path)
  const name=path.includes('accounts')?'Contas':'Cartoes'
  const blocks=[...source.matchAll(
    /<button\b[\s\S]*?<\/button>/g
  )].map(match=>match[0])

  const back=blocks.filter(block=>
    block.includes(
      'aria-label="Voltar para Mais opções"'
    )
  )

  check(name+' voltar unico',back.length===1)

  if(back.length===1){
    check(name+' toque 44px',
      back[0].includes('h-11') &&
      back[0].includes('w-11'))

    check(name+' foco acessivel',
      back[0].includes('focus-visible:ring-2'))

    check(name+' feedback de toque',
      back[0].includes('touch-manipulation'))
  }
}

for(const path of [
  'src/hooks/useLocalSync.ts',
  'src/components/SyncStatusIndicator.tsx',
  ...paths
]){
  const parsed=ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  )

  check(path+' sintaxe valida',
    parsed.parseDiagnostics.length===0)
}

for(const [name,passed] of checks){
  console.log((passed?'OK: ':'ERRO: ')+name)
  assert.ok(passed,name)
}

console.log(`R382: ${checks.length} contratos aprovados`)
