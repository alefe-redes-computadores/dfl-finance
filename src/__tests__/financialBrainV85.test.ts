/** @jest-environment node */
import 'fake-indexeddb/auto'
import { buildFinancialIntelligence } from '@/lib/financial-intelligence'
import { buildFinancialPlan, buildKnownCashTimeline, buildFinancialDiscoveries, simulateFinancialScenario } from '@/lib/financialPlanning'
import { resolveKnownCommitments } from '@/lib/financialCommitments'
import { buildForecastBasis, civilDate } from '@/lib/financialForecast'
import { buildUnifiedCashProjection } from '@/lib/financialProjection'
import { isRealizedFinancialTransaction } from '@/lib/financialMetrics'
import type { BuildFinancialIntelligenceInput } from '@/lib/financial-intelligence/types'
const now=new Date(2026,9,9,12)
const tx=(id:string,amount=20,date='2026-10-10',extra:any={})=>({id,amount,date,type:'expense',context:'dfl',status:'pending',...extra})
const input=(transactions:any[]=[],extra:any={}):BuildFinancialIntelligenceInput=>({context:'dfl',now,transactions,accounts:[{context:'dfl',balance:100}],categories:[],...extra})
const plan=(i:BuildFinancialIntelligenceInput)=>buildFinancialPlan(buildFinancialIntelligence(i),i.transactions,now,i)

test('unreceived income never inflates available cash',()=>{
 const p=plan(input([tx('pay',40),tx('income',200,'2026-10-10',{type:'income'})]))
 expect(p.availableAfterKnownCommitments).toBe(60);expect(p.probableReceivables).toBe(200)
})
test('overdue expenses enter today; overdue receipts do not fund the forecast',()=>{
 const i=input([tx('overdue',120,'2026-10-01'),tx('income',200,'2026-10-01',{type:'income'})])
 const timeline=buildKnownCashTimeline(buildFinancialIntelligence(i),i.transactions,30,now,i)
 expect(timeline.firstRiskDate).toBe('2026-10-09');expect(timeline.knownIncome).toBe(0)
 expect(plan(i).overduePayables).toBe(120)
})
test('purchase and invoice are one cash obligation, with partial payment subtracted',()=>{
 const i=input([tx('purchase',100,'2026-10-01',{credit_card_id:'card',invoice_id:'invoice',affects_balance:false})],{
  creditCards:[{id:'card',context:'dfl',closing_day:10,due_day:20}],
  creditInvoices:[{id:'invoice',context:'dfl',credit_card_id:'card',closing_date:'2026-10-10',due_date:'2026-10-20',total_amount:100,paid_amount:30,status:'open'}]})
 expect(resolveKnownCommitments('dfl',i.transactions,i,now).entries).toHaveLength(1)
 expect(plan(i).committedPayables).toBe(70)
 expect(plan(i).realizedExpense).toBe(100)
 expect(plan(i).projectedMonthNet).toBe(-100) // payment not a second expense
})
test('new purchase after paid invoice reopens only new cash exposure',()=>{
 const i=input([tx('old',100,'2026-10-01',{credit_card_id:'card',affects_balance:true,status:'done'}),tx('new',20,'2026-10-02',{credit_card_id:'card',affects_balance:false})],{
 creditCards:[{id:'card',context:'dfl',closing_day:10,due_day:20}],creditInvoices:[{id:'invoice',context:'dfl',credit_card_id:'card',closing_date:'2026-10-10',due_date:'2026-10-20',total_amount:100,paid_amount:100,status:'paid'}]})
 expect(plan(i).committedPayables).toBe(20)
})
test('card without stored invoice uses actual billing cycle',()=>{
 const i=input([tx('purchase',60,'2026-10-01',{credit_card_id:'card',affects_balance:false})],{creditCards:[{id:'card',context:'dfl',closing_day:10,due_day:20}]})
 expect(resolveKnownCommitments('dfl',i.transactions,i,now).entries[0].date).toBe('2026-10-20')
})
test('contexts, transfers, goals and settled cash do not create pending obligations',()=>{
 const i=input([tx('personal',999,'2026-10-10',{context:'personal'}),tx('transfer',999,'2026-10-10',{transfer_group_id:'group'}),tx('goal',999,'2026-10-10',{goal_id:'goal'}),tx('paid',999,'2026-10-10',{status:'done'})])
 expect(plan(i).committedPayables).toBe(0)
})
test('linked debt is not counted twice and lending principal is not expense',()=>{
 const i=input([tx('debt',50,'2026-10-10',{type:'income',debt_id:'debt'}),tx('loan',40,'2026-10-10',{type:'loan_payment',loan_id:'loan',cash_delta:-40})],{debts:[{id:'debt',context:'dfl',due_date:'2026-10-10',total_amount:50,paid_amount:0,status:'pending'}],loans:[{id:'loan',context:'dfl',direction:'borrowed',due_date:'2026-10-10',remaining_amount:40,status:'active'}]})
 expect(plan(i).probableReceivables).toBe(50);expect(plan(i).committedPayables).toBe(40)
 expect(plan(i).projectedMonthNet).toBe(50)
})
test('one extraordinary observation cannot be extrapolated; actual expense remains intact',()=>{
 const i=input([tx('outlier',100000,'2026-10-01',{status:'done'})])
 expect(buildForecastBasis(i.transactions,'dfl',now).dailyExpense).toBe(0)
 expect(buildFinancialIntelligence(i).snapshot.projectedMonthExpense).toBe(100000)
 expect(buildFinancialIntelligence(i).snapshot.confidence).toBe('low')
})
test('robust estimate caps only future trend and preserves realized totals',()=>{
 const transactions=Array.from({length:8},(_,n)=>tx(String(n),n===7?100000:10,`2026-10-0${n+1}`,{status:'done'}))
 const i=input(transactions),intel=buildFinancialIntelligence(i)
 expect(intel.snapshot.currentMonthExpense).toBe(100070)
 expect(intel.snapshot.projectedMonthExpense).toBeGreaterThanOrEqual(100070)
 expect(intel.snapshot.projectedMonthExpense).toBeLessThan(101000)
 expect(intel.snapshot.projectionCappedDays).toBe(1)
})
test('invoice settlement is cash only; legacy transfer legs never become revenue',()=>{
 expect(isRealizedFinancialTransaction(tx('settle',100,'2026-10-09',{status:'done',invoice_id:'invoice'}))).toBe(false)
 expect(isRealizedFinancialTransaction(tx('legacy',100,'2026-10-09',{status:'done',type:'income',transfer_group_id:'g'}))).toBe(false)
})
test('financial center and chart return same 30-day baseline; temporary dip is a risk',()=>{
 const i=input([tx('pay',150,'2026-10-10'),tx('receive',200,'2026-10-20',{type:'income'})])
 const chart=buildUnifiedCashProjection(i)
 expect(chart.projectedEndBalance).toBe(plan(i).baselineCash30)
 expect(chart.projectedEndBalance).toBeGreaterThan(0);expect(chart.isAtRisk).toBe(true)
})
test('scenario includes immediate allocation in impact and never mutates inputs',()=>{
 const p=plan(input([])),before=JSON.stringify(p)
 const scenario=simulateFinancialScenario(p,{extraIncomeMonthly:100,expenseReductionMonthly:999,debtAllocationNow:50})
 expect(scenario.improvement30).toBe(50);expect(scenario.improvement90).toBe(250)
 expect(JSON.stringify(p)).toBe(before)
})
test('no data does not produce a healthy discovery; invalid dates are excluded',()=>{
 const i=input([]),p=plan(i),timeline=buildKnownCashTimeline(buildFinancialIntelligence(i),[],30,now,i)
 expect(buildFinancialDiscoveries(p,timeline).some(x=>x.id==='stable-known-cash')).toBe(false)
 expect(civilDate('2026-02-30')).toBeNull()
 expect(resolveKnownCommitments('dfl',[tx('invalid',30,'2026-02-30')],{},now).warnings.length).toBe(1)
})
test('unlinked subscriptions remain planning and disclose missing linkage',()=>{
 const i=input([tx('known',20)],{subscriptions:[{context:'dfl',name:'Plano',amount:20,status:'active'}]})
 expect(plan(i).committedPayables).toBe(20);expect(plan(i).coverageWarnings.length).toBeGreaterThan(0)
})


test('materialized financing schedule replaces contract summary without hiding future installments',()=>{
 const i=input([tx('one',20,'2026-10-12',{financing_id:'f',type:'financing_installment'}),tx('two',20,'2026-11-12',{financing_id:'f',type:'financing_installment'})],{financings:[{id:'f',context:'dfl',status:'active',remaining_amount:40,installment_amount:20,next_due_date:'2026-10-12'}]})
 const entries=resolveKnownCommitments('dfl',i.transactions,i,now).entries
 expect(entries).toHaveLength(2);expect(entries.reduce((sum,e)=>sum+e.amount,0)).toBe(40)
 expect(plan(i).committedPayables).toBe(20)
})
test('scheduled partial loan payment and remaining principal total the obligation once',()=>{
 const i=input([tx('part',20,'2026-10-12',{loan_id:'l',type:'loan_payment',cash_delta:-20})],{loans:[{id:'l',context:'dfl',direction:'borrowed',status:'active',remaining_amount:80,due_date:'2026-10-20'}]})
 const entries=resolveKnownCommitments('dfl',i.transactions,i,now).entries
 expect(entries).toHaveLength(2);expect(entries.reduce((sum,e)=>sum+e.amount,0)).toBe(80)
})


test('future card installment affects economic month, while cash waits for invoice due date',()=>{
 const i=input([tx('future-purchase',50,'2026-10-15',{credit_card_id:'c',affects_balance:false})],{creditCards:[{id:'c',context:'dfl',closing_day:10,due_day:20}]})
 const p=plan(i)
 expect(p.projectedMonthNet).toBe(-50)
 expect(p.projectedMonthEndCash).toBe(100)
 expect(p.committedPayables).toBe(0)
})
