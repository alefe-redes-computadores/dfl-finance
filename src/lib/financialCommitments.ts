import { resolveCardBillingCycle } from '@/lib/cardOperations'
import { civilDate, civilISO, centsMoney } from '@/lib/financialForecast'
import type { BuildFinancialIntelligenceInput, IntelligenceTransactionLike } from '@/lib/financial-intelligence/types'

export interface KnownCashCommitment {
  id: string
  source: 'transaction' | 'invoice' | 'debt' | 'loan' | 'financing'
  date: string
  amount: number
  direction: 'income' | 'expense'
  economic: boolean
  overdue: boolean
}
export type CommitmentSources = Pick<BuildFinancialIntelligenceInput,'creditCards'|'creditInvoices'|'debts'|'loans'|'financings'|'subscriptions'>
export interface KnownCommitmentSet { entries: KnownCashCommitment[]; warnings: string[] }
const value=(x:unknown)=>{const n=Number(x);return Number.isFinite(n)?Math.max(0,n):0}

/** Only explicit IDs/cycles deduplicate financial facts; never fuzzy merchant/amount matches. */
export function resolveKnownCommitments(context:string, transactions:IntelligenceTransactionLike[], sources:CommitmentSources={}, now=new Date()):KnownCommitmentSet {
  const today=civilISO(now), entries:KnownCashCommitment[]=[],warnings=new Set<string>(),seen=new Set<string>()
  const scoped=transactions.filter(tx=>tx.context===context)
  const owned=<T extends {context?:string|null}>(rows:T[]=[])=>rows.filter(row=>row.context===context)
  const loans=owned(sources.loans), financings=owned(sources.financings), debts=owned(sources.debts)
  const add=(id:string,source:KnownCashCommitment['source'],due:unknown,amount:number,direction:KnownCashCommitment['direction'],economic:boolean)=>{
    const date=civilDate(due)
    if(!date){if(amount>0)warnings.add('Há compromisso sem data válida; ele não entrou na linha do tempo.');return}
    if(amount<=0||seen.has(id))return
    seen.add(id);entries.push({id,source,date,amount:centsMoney(amount),direction,economic,overdue:date<today})
  }
  for(const [txIndex,tx] of Array.from(scoped.entries())){
    if(tx.status!=='pending'||tx.type==='transfer'||tx.transfer_group_id||tx.goal_id||tx.credit_card_id)continue
    // Entity-linked cash is represented once by the authoritative outstanding entity.
    if(tx.debt_id&&debts.some(d=>d.id===tx.debt_id))continue
    const loan=loans.find(d=>d.id===tx.loan_id)
    if(loan && !['active','overdue'].includes(String(loan.status)))continue
    const financing=financings.find(d=>d.id===tx.financing_id)
    if(financing && !['active','overdue'].includes(String(financing.status)))continue
    if(financing){
      if(tx.paid!==true)add(`tx:${tx.id || txIndex}`,'financing',tx.due_date||tx.date,value(tx.amount),'expense',false)
      continue
    }
    if(tx.invoice_id&&(sources.creditInvoices||[]).some(d=>d.id===tx.invoice_id&&d.context===context))continue
    const amount=value(tx.amount),date=tx.due_date||tx.date
    if(tx.type==='income')add(`tx:${tx.id || txIndex}`, 'transaction',date,amount,'income',true)
    if(tx.type==='expense'||tx.type==='sangria')add(`tx:${tx.id || txIndex}`, 'transaction',date,amount,'expense',!tx.invoice_id)
    if(tx.type==='financing_installment')add(`tx:${tx.id || txIndex}`, 'transaction',date,amount,'expense',false)
    if(tx.type==='loan_payment'){
      if(typeof tx.cash_delta==='number'&&tx.cash_delta!==0)add(`tx:${tx.id || txIndex}`,'transaction',date,Math.abs(tx.cash_delta),tx.cash_delta>0?'income':'expense',false)
      else warnings.add('Parcela de empréstimo sem direção verificável não entrou na projeção.')
    }
  }
  for(const debt of debts)if(!['paid','cancelled'].includes(String(debt.status)))add(`debt:${debt.id}`,'debt',debt.due_date,value(debt.total_amount)-value(debt.paid_amount),'income',true)
  for(const loan of loans)if(['active','overdue'].includes(String(loan.status))){
    if(!['lent','borrowed'].includes(String(loan.direction))){warnings.add('Contrato de crédito legado sem direção não entrou na projeção.');continue}
    const scheduled=scoped.filter(tx=>tx.loan_id===loan.id&&tx.status==='pending'&&civilDate(tx.due_date||tx.date)&&typeof tx.cash_delta==='number').reduce((sum,tx)=>sum+Math.abs(tx.cash_delta!),0)
    add(`loan:${loan.id}`,'loan',loan.due_date,Math.max(0,value(loan.remaining_amount)-scheduled),loan.direction==='lent'?'income':'expense',false)
  }
  for(const f of financings)if(['active','overdue'].includes(String(f.status))&&!scoped.some(tx=>tx.financing_id===f.id&&tx.status==='pending'&&tx.paid!==true&&civilDate(tx.due_date||tx.date)))add(`financing:${f.id}`,'financing',f.next_due_date,Math.min(value(f.remaining_amount??f.outstanding_balance),value(f.installment_amount??f.installment_value)),'expense',false)

  const cards=owned(sources.creditCards).filter(c=>!c.is_archived)
  const invoices=owned(sources.creditInvoices)
  const cycles=new Map<string,{date:string;gross:number;unpaid:number;invoiceIds:Set<string>}>()
  for(const tx of scoped){
    if(!tx.credit_card_id||tx.transfer_group_id||!['expense','income'].includes(String(tx.type))||!['done','pending'].includes(String(tx.status)))continue
    const card=cards.find(c=>c.id===tx.credit_card_id);if(!card||!civilDate(tx.date))continue
    const cycle=resolveCardBillingCycle(card,tx.date!)
    const key=`${card.id}/${cycle.closingDate}`
    const current=cycles.get(key)||{date:cycle.dueDate,gross:0,unpaid:0,invoiceIds:new Set<string>()}
    const amount=value(tx.amount)*(tx.type==='income'?-1:1)
    current.gross+=amount
    if(tx.affects_balance!==true)current.unpaid+=amount
    if(tx.invoice_id)current.invoiceIds.add(tx.invoice_id)
    cycles.set(key,current)
  }
  const consumed=new Set<string>()
  for(const invoice of invoices){
    const key=`${invoice.credit_card_id}/${civilDate(invoice.closing_date)}`
    const cycle=cycles.get(key)||Array.from(cycles.values()).find(c=>!!invoice.id&&c.invoiceIds.has(invoice.id))
    if(cycle){const exact=Array.from(cycles.entries()).find(([,c])=>c===cycle);if(exact)consumed.add(exact[0])}
    if(invoice.status==='cancelled')continue
    const outstanding=Math.max(0,Math.max(value(invoice.total_amount),cycle?.gross||0)-value(invoice.paid_amount))
    add(`invoice:${invoice.id}`,'invoice',invoice.due_date||cycle?.date,outstanding,'expense',false)
  }
  for(const [key,cycle] of Array.from(cycles))if(!consumed.has(key))add(`cycle:${key}`,'invoice',cycle.date,Math.max(0,cycle.unpaid),'expense',false)
  if(owned(sources.subscriptions).some(s=>s.status==='active'))warnings.add('Assinaturas sem vínculo explícito com lançamentos ficam como planejamento; não são somadas novamente ao caixa.')
  if(entries.some(e=>e.overdue&&e.direction==='income'))warnings.add('Recebimentos vencidos não têm nova data confirmada e não aumentam o caixa projetado.')
  if(financings.some(f=>['active','overdue'].includes(String(f.status))&&!scoped.some(tx=>tx.financing_id===f.id&&tx.status==='pending'&&civilDate(tx.due_date||tx.date))))warnings.add('Financiamentos: apenas parcelas cadastradas e o próximo vencimento verificável entram no horizonte.')
  return {entries:entries.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)),warnings:Array.from(warnings)}
}
