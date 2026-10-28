import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const file='src/app/(app)/transactions/new/page.tsx'
const source=fs.readFileSync(file,'utf8')

const ast=ts.createSourceFile(
  file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
)

assert.equal(ast.parseDiagnostics.length,0)

const start=source.indexOf(
  'const handleSave = useCallback(async () => {'
)

const end=source.indexOf(
  '}, [isSubmitting, user, amountNum,',
  start
)

assert(start>=0 && end>start)

const handler=source.slice(start,end)

const required=[
  'submitLockRef.current || isSubmitting',
  'submitLockRef.current = true',
  'submitLockRef.current = false',
  'setIsSubmitting(true)',
  'setIsSubmitting(false)',
  'await db.transaction(',
  'applyAccountCashDelta',
  'creditCardId',
  'receiptUrl',
  'totalParcels',
  'recurringGroupId'
]

for(const name of required){
  assert(handler.includes(name),name)
  console.log('OK:',name)
}

const locked=handler.indexOf('submitLockRef.current = true')
const transaction=handler.indexOf('await db.transaction(')
const released=handler.indexOf('submitLockRef.current = false')

assert(locked>=0)
assert(locked<transaction)
assert(released>transaction)

// A liberacao fica no finally e nao em um
// caminho exclusivo de sucesso.
assert(
  handler.slice(released-100,released)
    .includes('finally')
)

assert(source.includes('disabled={isSubmitting}'))

console.log('R394: contratos de salvamento aprovados')
