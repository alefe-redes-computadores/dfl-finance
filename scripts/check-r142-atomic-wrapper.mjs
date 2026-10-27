import assert from 'node:assert/strict'
import fs from 'node:fs'
const s=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026_r142_bot_atomic_proposal_authorization.sql','utf8')
const tests=[
 ['wrapper exige sessao',s.includes("v_session.step <> 'TX_CONFIRM'")],
 ['bloqueio transacional',s.includes('for update')],
 ['versao obrigatoria',s.includes('v_current<>p_expected_revision')],
 ['identidade da proposta',s.includes('v_proposal is distinct from p_proposal_id')],
 ['rejeita consumo duplo',s.includes('DFL_BOT_ALREADY_CONSUMED')],
 ['valida valor',s.includes("::numeric is distinct from p_amount")],
 ['valida descricao',s.includes("is distinct from p_description")],
 ['idempotencia obrigatoria',s.includes('p_idempotency_key is null')],
 ['chama RPC existente',s.includes('public.bot_record_transaction(')],
 ['escopo limitado',s.includes("p_type not in ('income','expense')")],
 ['sem execucao de anon',s.includes('from public,anon,authenticated')],
 ['sem alteracao direta de contas',!s.includes('update public.accounts')],
 ['sem migracao automatica',!s.includes('drop table')],
]
for (const [label,ok] of tests){assert.ok(ok,label);console.log('OK:',label)}
console.log('R142: '+tests.length+' verificacoes estruturais. NAO provam concorrencia de producao.')
