import type { FinancialIntelligenceOutput, IntelligenceTransactionLike } from '@/lib/financial-intelligence'
import { resolveKnownCommitments, type CommitmentSources, type KnownCashCommitment } from '@/lib/financialCommitments'
import { addCivilDays, civilISO, buildForecastBasis } from '@/lib/financialForecast'

const n = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const money = (value: number) => Math.round(value * 100) / 100
const iso = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const monthEnd = (date: Date) => iso(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12))

export interface FinancialPlanSnapshot {
  estimatedCashExpense30: number
  estimatedCashExpense90: number
  commitments: KnownCashCommitment[]
  coverageWarnings: string[]
  baselineCash30: number
  baselineCash90: number
  monthlyCashTrend: number
  remainingMonthDays: number
  overduePayables: number
  realizedIncome: number
  realizedExpense: number
  realizedNet: number
  committedPayables: number
  probableReceivables: number
  estimatedRemainingExpense: number
  estimatedRemainingIncome: number
  knownCommitmentNet: number
  recurringMonthly: number
  cardExposure: number
  creditCommitments: number
  availableAfterKnownCommitments: number
  projectedMonthNet: number
  projectedMonthEndCash: number
  confidence: 'low' | 'medium' | 'high'
  sampleSize: number
}

export interface FinancialScenarioInput {
  extraIncomeMonthly: number
  expenseReductionMonthly: number
  debtAllocationNow: number
}

export interface FinancialScenarioResult {
  baseline30: number
  scenario30: number
  baseline90: number
  scenario90: number
  improvement30: number
  improvement90: number
  debtAllocationNow: number
  note: string
}

export interface FinancialTimelineDay {
  date: string
  income: number
  expense: number
  net: number
  projectedCash: number
  events: number
}

export interface FinancialCashTimeline {
  days: FinancialTimelineDay[]
  firstRiskDate: string | null
  lowestCash: number
  knownIncome: number
  knownExpense: number
}

export type FinancialDiscoveryTone =
  | 'critical'
  | 'warning'
  | 'opportunity'
  | 'stable'

export interface FinancialDiscovery {
  id: string
  tone: FinancialDiscoveryTone
  title: string
  message: string
  evidence: string
}

const sumEntries = (entries: KnownCashCommitment[], direction: 'income' | 'expense') => money(entries.filter(e=>e.direction===direction).reduce((sum,e)=>sum+e.amount,0))

export function projectKnownAndEstimatedCash(balance:number, entries:KnownCashCommitment[], dailyIncome:number, dailyExpense:number, days:number, now:Date) {
  const today=civilISO(now), end=addCivilDays(today,days-1)
  const included=entries.filter(e=>e.date<=end && !(e.direction==='income'&&e.overdue))
  const knownIncome=sumEntries(included,'income'),knownExpense=sumEntries(included,'expense')
  // Behavioral residual is a model, not a second ledger commitment.
  const estimatedIncome=Math.max(0,dailyIncome*days-knownIncome)
  const estimatedExpense=Math.max(0,dailyExpense*days-knownExpense)
  const points:{day:string;balance:number}[]=[]
  let running=balance
  for(let i=0;i<days;i++){
    const day=addCivilDays(today,i),events=included.filter(e=>(e.date<today?today:e.date)===day)
    running+=sumEntries(events,'income')-sumEntries(events,'expense')+(estimatedIncome-estimatedExpense)/days
    points.push({day,balance:money(running)})
  }
  return {points,knownIncome,knownExpense,estimatedIncome,estimatedExpense}
}

export function buildFinancialPlan(intelligence:FinancialIntelligenceOutput, transactions:IntelligenceTransactionLike[], now=new Date(), sources:CommitmentSources={}):FinancialPlanSnapshot {
  const snapshot=intelligence.snapshot,today=iso(now),end=monthEnd(now)
  const known=resolveKnownCommitments(intelligence.context,transactions,sources,now)
  const monthly=known.entries.filter(e=>e.date<=end)
  const committedPayables=sumEntries(monthly,'expense'),probableReceivables=sumEntries(monthly,'income')
  const economic=monthly.filter(e=>e.economic)
  const economicBasis=snapshot.forecastBasis||buildForecastBasis(transactions,intelligence.context,now)
  const cashBasis=snapshot.cashForecastBasis||buildForecastBasis(transactions,intelligence.context,now,true)
  const remainingMonthDays=Math.max(0,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate())
  const futureEconomic= economic.filter(e=>e.date>=today || e.direction==='expense')
  const futureCardExpense=transactions.filter(tx=>tx.context===intelligence.context&&tx.credit_card_id&&tx.type==='expense'&&tx.status==='pending'&&!tx.goal_id&&!tx.transfer_group_id&&String(tx.date).slice(0,10)>today&&String(tx.date).slice(0,10)<=end).reduce((sum,tx)=>sum+Math.max(0,n(tx.amount)),0)
  const economicExpense=sumEntries(futureEconomic,'expense')+futureCardExpense,economicIncome=sumEntries(futureEconomic,'income')
  const estimatedRemainingExpense=Math.max(0,economicBasis.dailyExpense*remainingMonthDays-economicExpense)
  const estimatedRemainingIncome=Math.max(0,economicBasis.dailyIncome*remainingMonthDays-economicIncome)
  const monthCash=projectKnownAndEstimatedCash(n(snapshot.accountBalance),known.entries,cashBasis.dailyIncome*remainingMonthDays/(remainingMonthDays+1),cashBasis.dailyExpense*remainingMonthDays/(remainingMonthDays+1),remainingMonthDays+1,now)
  const p30=projectKnownAndEstimatedCash(n(snapshot.accountBalance),known.entries,cashBasis.dailyIncome,cashBasis.dailyExpense,30,now)
  const p90=projectKnownAndEstimatedCash(n(snapshot.accountBalance),known.entries,cashBasis.dailyIncome,cashBasis.dailyExpense,90,now)
  return { estimatedCashExpense30:p30.estimatedExpense,estimatedCashExpense90:p90.estimatedExpense,commitments:known.entries,coverageWarnings:known.warnings,
    baselineCash30:p30.points[29].balance,baselineCash90:p90.points[89].balance,
    monthlyCashTrend:money((cashBasis.dailyIncome-cashBasis.dailyExpense)*30),remainingMonthDays,
    overduePayables:sumEntries(monthly.filter(e=>e.overdue),'expense'),
    realizedIncome:money(snapshot.currentMonthIncome),realizedExpense:money(snapshot.currentMonthExpense),realizedNet:money(snapshot.currentMonthNet),
    committedPayables,probableReceivables,estimatedRemainingExpense:money(estimatedRemainingExpense),estimatedRemainingIncome:money(estimatedRemainingIncome),
    knownCommitmentNet:money(probableReceivables-committedPayables),recurringMonthly:money(snapshot.recurringMonthlyEquivalent),
    cardExposure:sumEntries(known.entries.filter(e=>e.source==='invoice'),'expense'),
    creditCommitments:money(n(snapshot.activeLoanRemaining)+n(snapshot.activeFinancingRemaining)),
    availableAfterKnownCommitments:money(n(snapshot.accountBalance)-committedPayables),
    projectedMonthNet:money(n(snapshot.currentMonthNet)+economicIncome-economicExpense+estimatedRemainingIncome-estimatedRemainingExpense),
    projectedMonthEndCash:monthCash.points[monthCash.points.length-1].balance,
    confidence:cashBasis.confidence,sampleSize:cashBasis.sampleSize }
}

export function buildKnownCashTimeline(intelligence:FinancialIntelligenceOutput, transactions:IntelligenceTransactionLike[],days=30,now=new Date(),sources:CommitmentSources={}):FinancialCashTimeline {
  const horizon=Math.max(1,Math.min(90,Math.trunc(days)||30)),today=iso(now),end=addCivilDays(today,horizon-1)
  const entries=resolveKnownCommitments(intelligence.context,transactions,sources,now).entries.filter(e=>e.date<=end&&!(e.direction==='income'&&e.overdue))
  let cash=n(intelligence.snapshot.accountBalance),lowestCash=cash,firstRiskDate:string|null=cash<0?today:null
  const timeline:FinancialTimelineDay[]=[]
  for(let i=0;i<horizon;i++){
    const date=addCivilDays(today,i),events=entries.filter(e=>(e.date<today?today:e.date)===date)
    const income=sumEntries(events,'income'),expense=sumEntries(events,'expense'),net=money(income-expense)
    cash=money(cash+net);lowestCash=Math.min(lowestCash,cash)
    if(cash<0&&!firstRiskDate)firstRiskDate=date
    if(events.length||date===firstRiskDate)timeline.push({date,income,expense,net,projectedCash:cash,events:events.length})
  }
  return {days:timeline,firstRiskDate,lowestCash:money(lowestCash),knownIncome:sumEntries(entries,'income'),knownExpense:sumEntries(entries,'expense')}
}

export function buildFinancialDiscoveries(
  plan: FinancialPlanSnapshot,
  timeline: FinancialCashTimeline
): FinancialDiscovery[] {
  const discoveries: FinancialDiscovery[] = []

  if (timeline.firstRiskDate) {
    discoveries.push({
      id: 'known-cash-risk',
      tone: 'critical',
      title: 'Risco de caixa identificado',
      message: `Com os compromissos já cadastrados, o saldo cruza abaixo de zero em ${timeline.firstRiskDate.split('-').reverse().join('/')}.`,
      evidence: `Menor saldo conhecido no horizonte: ${money(timeline.lowestCash).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    })
  } else if (plan.availableAfterKnownCommitments < 0) {
    discoveries.push({
      id: 'commitment-pressure',
      tone: 'warning',
      title: 'Compromissos pressionam o caixa',
      message: 'O saldo atual não cobre todos os compromissos conhecidos considerados no mês.',
      evidence: `Livre após compromissos: ${money(plan.availableAfterKnownCommitments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    })
  }

  if (plan.projectedMonthNet < 0) {
    discoveries.push({
      id: 'negative-month-trend',
      tone: 'warning',
      title: 'Ritmo do mês está negativo',
      message: 'A projeção atual indica que o mês pode terminar consumindo caixa.',
      evidence: `Resultado projetado do mês: ${money(plan.projectedMonthNet).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    })
  }

  if (
    plan.cardExposure > 0 &&
    plan.cardExposure > Math.max(1, plan.realizedIncome) * 0.5
  ) {
    discoveries.push({
      id: 'card-exposure',
      tone: 'warning',
      title: 'Cartões concentram compromisso relevante',
      message: 'As faturas abertas representam uma parcela importante da receita realizada no período.',
      evidence: `Exposição aberta: ${money(plan.cardExposure).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    })
  }

  if (
    timeline.days.some(day => day.events > 0) &&
    plan.coverageWarnings.length === 0 &&
    plan.confidence !== 'low' &&
    !timeline.firstRiskDate &&
    plan.projectedMonthNet >= 0 &&
    plan.availableAfterKnownCommitments >= 0
  ) {
    discoveries.push({
      id: 'stable-known-cash',
      tone: 'stable',
      title: 'Caixa conhecido está saudável',
      message: 'Os compromissos cadastrados não indicam ruptura de caixa no horizonte conhecido.',
      evidence: `${timeline.days.length} dia(s) com eventos financeiros conhecidos foram analisados.`,
    })
  }

  if (plan.confidence === 'low') {
    discoveries.push({
      id: 'low-confidence',
      tone: 'opportunity',
      title: 'Projeção ainda tem pouca amostra',
      message: 'Use a projeção como orientação, não como promessa. Mais histórico melhora a leitura do comportamento.',
      evidence: `${plan.sampleSize} lançamento(s) compõem a amostra atual.`,
    })
  }

  if (plan.coverageWarnings.length) discoveries.push({id:'commitment-coverage',tone:'warning',title:'Há dados fora da projeção',message:plan.coverageWarnings[0],evidence:`${plan.coverageWarnings.length} aviso(s) de cobertura. Não representam saldo confirmado.`})
  const tonePriority = { critical:4, warning:3, opportunity:2, stable:1 }
  return discoveries.sort((a,b)=>tonePriority[b.tone]-tonePriority[a.tone]).slice(0, 4)
}

export function simulateFinancialScenario(
  plan: FinancialPlanSnapshot,
  input: FinancialScenarioInput
): FinancialScenarioResult {
  const extraIncome = Math.max(0, n(input.extraIncomeMonthly))
  const reduction = Math.max(0, n(input.expenseReductionMonthly))
  const debtNow = Math.max(0, n(input.debtAllocationNow))
  const monthlyImprovement = extraIncome + Math.min(reduction,plan.estimatedCashExpense30)
  const baseline30 = plan.baselineCash30
  const scenario30 = baseline30 + monthlyImprovement - debtNow
  const baseline90 = plan.baselineCash90
  const scenario90 = baseline90 + extraIncome * 3 + Math.min(reduction * 3,plan.estimatedCashExpense90) - debtNow

  return {
    baseline30: money(baseline30),
    scenario30: money(scenario30),
    baseline90: money(baseline90),
    scenario90: money(scenario90),
    improvement30: money(scenario30 - baseline30),
    improvement90: money(scenario90 - baseline90),
    debtAllocationNow: money(debtNow),
    note: debtNow > 0
      ? 'A antecipação reduz o caixa imediatamente. Como os contratos não informam economia futura de juros de forma uniforme, o simulador não inventa esse ganho.'
      : 'A redução fica limitada ao gasto estimado; não cancela faturas ou parcelas conhecidas. Nenhuma alteração é gravada.',
  }
}
