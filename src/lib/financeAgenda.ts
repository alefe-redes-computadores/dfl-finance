// V170 — Agenda financeira unificada, SOMENTE LEITURA.
// Fonte financeira autoritativa: resolveKnownCommitments. Assinaturas são planejamento separado.
import { resolveKnownCommitments, type KnownCashCommitment, type CommitmentSources } from '@/lib/financialCommitments'
import { addCivilDays, civilISO } from '@/lib/financialForecast'
import type { IntelligenceTransactionLike } from '@/lib/financial-intelligence/types'

export type AgendaContext = 'dfl' | 'personal'
export type AgendaDirection = 'expense' | 'income'
export type AgendaKind = 'transaction' | 'invoice' | 'debt' | 'loan' | 'financing' | 'subscription'
export type AgendaScope = 'known' | 'planning'
export interface AgendaEntry {
  id: string
  kind: AgendaKind
  scope: AgendaScope
  date: string
  amount: number
  direction: AgendaDirection
  label: string
  detail: string
  href: string
  overdue: boolean
  today: boolean
}
export interface AgendaGroup { date: string; items: AgendaEntry[]; knownExpense: number; knownIncome: number }
export interface AgendaResult {
  today: string
  end: string
  horizonDays: number
  items: AgendaEntry[]
  groups: AgendaGroup[]
  dueNowExpense: number
  dueNowIncome: number
  horizonExpense: number
  horizonIncome: number
  planningExpense: number
  overdueCount: number
  knownCount: number
  planningCount: number
  warnings: string[]
}
export type AgendaInput = {
  context: AgendaContext
  transactions: IntelligenceTransactionLike[]
  sources: CommitmentSources
  horizonDays?: number
  now?: Date
}
type GenericRow = { [key: string]: any }
const number = (v: unknown) => { const n=Number(v);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:0 }
const text = (v: unknown) => String(v||'').trim()
const route = (page: string, id?: unknown) => id ? `${page}?id=${encodeURIComponent(String(id))}` : page
const active = (v:unknown) => !['paid','cancelled','archived','inactive','paused','done'].includes(text(v).toLowerCase())
const validCivil=(v:unknown):v is string=>{
  if(typeof v!=='string'||!/^20\d\d-\d\d-\d\d$/.test(v))return false
  const [y,m,d]=v.split('-').map(Number), max=new Date(Date.UTC(y,m,0)).getUTCDate()
  return m>=1&&m<=12&&d>=1&&d<=max
}
const named=(value:unknown,fallback:string)=>text(value)||fallback
const m=(n:number)=>Math.round(n*100)/100
const monthJump=(date:string,months:number,day:number)=>{
  const [y,mon]=date.split('-').map(Number), ym=y*12+(mon-1)+months
  const yy=Math.floor(ym/12),mm=ym%12+1
  const dd=Math.min(day,new Date(Date.UTC(yy,mm,0)).getUTCDate())
  return `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`
}
const cycleStep=(v:unknown):'weekly'|'monthly'|'quarterly'|'yearly'|null=>{
  const s=text(v).toLowerCase()
  if(s==='weekly')return 'weekly'
  if(s==='monthly'||!s)return 'monthly'
  if(s==='quarterly')return 'quarterly'
  if(s==='yearly'||s==='annual')return 'yearly'
  return null
}
const subscriptionDates=(row:GenericRow,today:string,end:string):string[]=>{
  const cycle=cycleStep(row.billing_cycle)
  if(!cycle)return []
  const scheduled=text(row.next_due_date)
  let start=validCivil(scheduled)?scheduled:''
  if(!start){
    const day=Number(row.due_day)
    if(!Number.isInteger(day)||day<1||day>31)return []
    start=monthJump(today,0,day)
    if(start<today)start=monthJump(today,1,day)
  }
  const results:string[]=[]
  const anchorDay=Number(row.due_day)||Number(start.slice(8,10))
  for(let n=0;n<18;n++){
    let date=start
    if(n>0){
      if(cycle==='weekly')date=addCivilDays(start,n*7)
      if(cycle==='monthly')date=monthJump(start,n,anchorDay)
      if(cycle==='quarterly')date=monthJump(start,n*3,anchorDay)
      if(cycle==='yearly')date=monthJump(start,n*12,anchorDay)
    }
    if(date>end)break
    if(validCivil(date))results.push(date)
  }
  return results
}

/**
 * Present existing ledger commitments with provenance and separate subscription planning.
 * No sum combines planning with recognized commitments or projected account balances.
 */
export function composeFinanceAgenda(
  known:KnownCashCommitment[],
  transactions:IntelligenceTransactionLike[],
  sources:CommitmentSources,
  context:AgendaContext,
  horizonDays=30,
  now=new Date(),
  inheritedWarnings:string[]=[]
):AgendaResult {
  const today=civilISO(now), days=[7,30,90].includes(horizonDays)?horizonDays:30, end=addCivilDays(today,days-1)
  const txById=new Map((transactions||[]).filter(t=>t.context===context&&t.id).map(t=>[String(t.id),t as GenericRow]))
  const owned=(arr?:any[]) => (arr||[]).filter(r=>r&&r.context===context) as GenericRow[]
  const debts=new Map(owned(sources.debts).map(r=>[String(r.id),r]))
  const loans=new Map(owned(sources.loans).map(r=>[String(r.id),r]))
  const financing=new Map(owned(sources.financings).map(r=>[String(r.id),r]))
  const invoices=new Map(owned(sources.creditInvoices).map(r=>[String(r.id),r]))
  const cards=new Map(owned(sources.creditCards).map(r=>[String(r.id),r]))
  const warnings=new Set(inheritedWarnings)
  const items:AgendaEntry[]=[]
  const seen=new Set<string>()
  for(const entry of known||[]){
    if(!validCivil(entry.date)||entry.date>end||number(entry.amount)<=0||seen.has(entry.id))continue
    if(!['income','expense'].includes(entry.direction))continue
    seen.add(entry.id)
    let kind:AgendaKind=entry.source, label='Compromisso', detail='Valor pendente', href='/transactions'
    const id=entry.id.split(':')[1]
    if(entry.source==='transaction'){
      const tx=txById.get(id)
      label=named(tx?.description,entry.direction==='income'?'Recebimento pendente':'Pagamento pendente')
      detail='Lançamento aguardando confirmação'
      href=route('/transactions/details',tx?.id||id)
    }else if(entry.source==='invoice'){
      const inv=invoices.get(id)
      const card=cards.get(String(inv?.credit_card_id||''))
      label=card?`Fatura · ${named(card.name,'Cartão')}`:'Fatura de cartão'
      detail='Obrigação da fatura; compras do cartão não são somadas de novo'
      href=inv?.credit_card_id?route('/cards/details',inv.credit_card_id):'/cards'
    }else if(entry.source==='debt'){
      const debt=debts.get(id)
      label=named(debt?.person_name,'Valor a receber')
      detail='Valor restante da cobrança; não é dinheiro recebido'
      href=route('/debts/details',id)
    }else if(entry.source==='loan'){
      const loan=loans.get(id)
      label=named(loan?.description,'Empréstimo')
      detail='Contrato de crédito; confira cronograma e parcelas'
      href=route('/loans/details',id)
    }else if(entry.source==='financing'){
      const fin=financing.get(id)
      label=named(fin?.name||fin?.description,'Financiamento')
      detail='Próxima parcela cadastrada; não é o saldo total devedor'
      href=route('/financings/details',id)
    }
    items.push({id:entry.id,kind,scope:'known',date:entry.date,amount:m(entry.amount),direction:entry.direction,label,detail,href,overdue:entry.date<today,today:entry.date===today})
  }
  // Assinaturas sem vínculo contábil explícito pertencem EXCLUSIVAMENTE ao planejamento.
  // Mesmo que coincidam com uma despesa, nunca entram nos totais da agenda principal.
  for(const sub of owned(sources.subscriptions).filter(r=>r.status==='active')){
    const amount=number(sub.amount)
    if(!amount||!sub.id)continue
    const dates=subscriptionDates(sub,today,end)
    if(!dates.length&&(!validCivil(sub.next_due_date)&&!Number.isInteger(Number(sub.due_day)))){
      warnings.add('Assinatura sem data/dia válido não entrou no calendário.')
    }
    for(const date of dates){
      items.push({id:`subscription:${sub.id}:${date}`,kind:'subscription',scope:'planning',date,amount,direction:'expense',label:named(sub.name,'Assinatura'),detail:'Previsão recorrente · não somada às obrigações confirmadas',href:route('/subscriptions/details',sub.id),overdue:date<today,today:date===today})
    }
  }
  const sourceOrder:Record<AgendaKind,number>={transaction:0,invoice:1,financing:2,loan:3,debt:4,subscription:5}
  items.sort((a,b)=>a.date.localeCompare(b.date)||a.scope.localeCompare(b.scope)||sourceOrder[a.kind]-sourceOrder[b.kind]||a.id.localeCompare(b.id))
  const groupMap=new Map<string,AgendaEntry[]>()
  for(const item of items){const arr=groupMap.get(item.date)||[];arr.push(item);groupMap.set(item.date,arr)}
  const groups=Array.from(groupMap.entries()).map(([date,records])=>({date,items:records,knownExpense:m(records.filter(r=>r.scope==='known'&&r.direction==='expense').reduce((s,r)=>s+r.amount,0)),knownIncome:m(records.filter(r=>r.scope==='known'&&r.direction==='income').reduce((s,r)=>s+r.amount,0))}))
  const total=(direction:AgendaDirection,from:string,to:string)=>m(items.filter(x=>x.scope==='known'&&x.direction===direction&&x.date>=from&&x.date<=to).reduce((s,x)=>s+x.amount,0))
  const planningExpense=m(items.filter(x=>x.scope==='planning').reduce((s,x)=>s+x.amount,0))
  return {today,end,horizonDays:days,items,groups,dueNowExpense:total('expense','2000-01-01',today),dueNowIncome:total('income','2000-01-01',today),horizonExpense:total('expense','2000-01-01',end),horizonIncome:total('income',today,end),planningExpense,overdueCount:items.filter(x=>x.scope==='known'&&x.overdue).length,knownCount:items.filter(x=>x.scope==='known').length,planningCount:items.filter(x=>x.scope==='planning').length,warnings:Array.from(warnings)}
}

export function buildFinanceAgenda(input:AgendaInput):AgendaResult {
  const now=input.now||new Date()
  const recognized=resolveKnownCommitments(input.context,input.transactions,input.sources,now)
  return composeFinanceAgenda(recognized.entries,input.transactions,input.sources,input.context,input.horizonDays??30,now,recognized.warnings)
}
