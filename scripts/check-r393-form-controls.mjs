import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const path='src/app/(app)/transactions/new/page.tsx'
const source=fs.readFileSync(path,'utf8')

const sf=ts.createSourceFile(
  path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
)

assert.equal(sf.parseDiagnostics.length,0)

const required=[
  'Voltar para transações',
  'Ler QR Code',
  'Adicionar comprovante',
  'Remover comprovante'
]

const buttons=[]

function visit(node){
  if(ts.isJsxElement(node) &&
     node.openingElement.tagName.getText(sf)==='button'){
    buttons.push(node.openingElement)
  }
  ts.forEachChild(node,visit)
}

visit(sf)

for(const label of required){
  const matches=buttons.filter(node=>
    node.attributes.properties.some(attribute=>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(sf)==='aria-label' &&
      attribute.initializer &&
      ts.isStringLiteral(attribute.initializer) &&
      attribute.initializer.text===label
    )
  )

  assert.equal(matches.length,1,label)

  const tag=matches[0].getText(sf)

  assert(tag.includes('type="button"'))
  assert(tag.includes('touch-manipulation'))
  assert(tag.includes('focus-visible:ring-2'))

  console.log('OK:',label)
}

// Contratos financeiros fundamentais.
for(const term of [
  'applyAccountCashDelta',
  'handleTypeChange',
  'setShowReceiptModal',
  'handleRemoveReceipt',
  'setShowAccModal',
  'setShowCatModal'
]){
  assert(source.includes(term),term)
}

console.log('R393: controles JSX e fluxos preservados')
