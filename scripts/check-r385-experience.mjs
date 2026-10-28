import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const pages=[
  'src/app/(app)/home/page.tsx',
  'src/app/(app)/conciliation/page.tsx',
  'src/app/(app)/transactions/page.tsx'
]

for(const path of pages){
  const source=fs.readFileSync(path,'utf8')
  const sf=ts.createSourceFile(
    path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
  )

  assert.equal(
    sf.parseDiagnostics.length,0,
    'JSX invalido: '+path
  )

  console.log('OK: sintaxe',path)
}

const conciliation=fs.readFileSync(pages[1],'utf8')
const transactions=fs.readFileSync(pages[2],'utf8')
const home=fs.readFileSync(pages[0],'utf8')

assert(conciliation.includes('aria-label="Voltar para Mais opções"'))
assert(conciliation.includes('aria-label="Fechar revisão"'))
assert(transactions.includes('aria-label="Fechar filtros avançados"'))

for(const term of [
  'homeInboxSummary',
  'homeOperationalInsight',
  'resolveKnownCommitments'
]){
  assert(home.includes(term))
}

console.log('R385: contratos estruturais aprovados')
