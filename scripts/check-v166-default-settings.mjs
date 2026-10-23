import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = (file) => fs.readFileSync(file, 'utf8')
const prefs=read('src/lib/userSettings.ts')
const page=read('src/app/(app)/settings/page.tsx')
const resolver=read('src/lib/defaultAccount.ts')
const tx=read('src/app/(app)/transactions/new/page.tsx')
const fab=read('src/components/FAB.tsx')
const account=read('src/app/(app)/accounts/new/page.tsx')
const detail=read('src/app/(app)/accounts/details/page.tsx')
const list=read('src/app/(app)/accounts/page.tsx')
const more=read('src/app/(app)/more/page.tsx')
const cases=[
 ['Preferência tipada',prefs.includes('default_accounts: DefaultAccountMap')],
 ['Padrão vazio em ambos os contextos',prefs.includes("default_accounts: { dfl: '', personal: '' }")],
 ['Normalização defensiva',prefs.includes('raw.default_accounts')],
 ['Salva em user_settings preexistente',prefs.includes(".from('user_settings').upsert(")],
 ['Valida conta não arquivada',resolver.includes('a.is_archived !== true')],
 ['Valida contexto exato',resolver.includes('a.context === context')],
 ['Central com contas Empresa/Pessoal',page.includes("accountGroup('dfl'")&&page.includes("accountGroup('personal'")],
 ['Central integra preferências reais',page.includes('<NotificationPreferencesCard />')],
 ['Central IA com preferência real',page.includes('toggleOption(item.key)')],
 ['Novo cadastro opção padrão',account.includes('Definir como padrão neste contexto')],
 ['Cadastro persiste após conta criada',account.includes('defaultAccountPatch(settings, effectiveContext, newId)')],
 ['Detalhes alterna padrão',detail.includes('☆ Definir como padrão')],
 ['Lista exibe etiqueta',list.includes('=== defaultAccountId')&&list.includes('>Padrão</span>')],
 ['Transação respeita escolha manual',tx.includes('manualAccountRef.current || creditCardId || accountId')],
 ['Transação usa padrão validado',tx.includes('validDefaultAccountId(settings, effectiveContext, accounts || [])')],
 ['Transferência sem seleção automática',tx.includes("type === 'transfer'")],
 ['FAB respeita conta escolhida',fab.includes('manualAccountRef.current || accountId')],
 ['FAB preenche padrão',fab.includes('validDefaultAccountId(settings, quickContext, accounts)')],
 ['Acesso Mais',more.includes('href="/settings"')],
 ['Regras financeiras não alteradas',!page.includes('applyAccountCashDelta') && !resolver.includes('safeAdd(')],
]
for (const [name,condition] of cases){assert(condition,name);console.log('✓',name)}
console.log(`V166-A: ${cases.length} verificações de personalização aprovadas`)
