import fs from 'node:fs'

const page = fs.readFileSync('src/app/(app)/search/page.tsx', 'utf8')
const search = fs.readFileSync('src/lib/globalSearch.ts', 'utf8')

const checks = [
  ['busca premium compacta', page.includes('h-[52px]') && page.includes('focus-within:ring-4')],
  ['receita verde', page.includes("text-emerald-600") && page.includes("amountPrefix = '+'")],
  ['despesa vermelha', page.includes("text-rose-600") && page.includes("amountPrefix = '-'")],
  ['transferência azul', page.includes("text-blue-600") && page.includes("typeLabel = 'Transferência'")],
  ['ícone da categoria', page.includes('getDynamicIcon(item.categoryIcon)')],
  ['indicador de anexo', page.includes('item.hasAttachment') && page.includes('<Paperclip')],
  ['data no resultado', page.includes('formatDate(item.date)')],
  ['navegação contextual', page.includes('router.push(item.href)')],
  ['metadados enriquecidos', search.includes('categoryIcon?: string') && search.includes('hasAttachment?: boolean')],
  ['categoria resolvida localmente', search.includes('const categoryMap = new Map')],
  ['busca continua offline', search.includes("import { db } from '@/lib/db'")],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK ' : 'ERR'} ${name}`)
  if (!ok) failed += 1
}

if (failed) process.exit(1)
console.log('\nV62 busca global premium: OK')
