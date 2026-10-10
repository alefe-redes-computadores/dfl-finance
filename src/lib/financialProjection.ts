import { buildFinancialIntelligence } from '@/lib/financial-intelligence'
import { buildForecastBasis, civilISO } from '@/lib/financialForecast'
import { resolveKnownCommitments } from '@/lib/financialCommitments'
import { projectKnownAndEstimatedCash } from '@/lib/financialPlanning'
import type { BuildFinancialIntelligenceInput } from '@/lib/financial-intelligence/types'
import type { ProjectionData } from '@/hooks/useProjection'

/** The chart and financial center share cash facts and the same estimator. */
export function buildUnifiedCashProjection(input: BuildFinancialIntelligenceInput):ProjectionData {
  const now=input.now||new Date(),today=civilISO(now)
  const intelligence=buildFinancialIntelligence(input),basis=buildForecastBasis(input.transactions,input.context,now,true)
  const known=resolveKnownCommitments(input.context,input.transactions,input,now)
  const p=projectKnownAndEstimatedCash(intelligence.snapshot.accountBalance,known.entries,basis.dailyIncome,basis.dailyExpense,30,now)
  const lowest=Math.min(intelligence.snapshot.accountBalance,...p.points.map(x=>x.balance))
  const first=p.points.findIndex(x=>x.balance<0),isAtRisk=lowest<0
  const riskLevel=isAtRisk?(first<=6?'critical':'high'):intelligence.snapshot.accountBalance>0&&lowest<intelligence.snapshot.accountBalance*0.2?'medium':'low'
  const sampleNote=basis.confidence==='low'?'Amostra limitada; estimativa comportamental conservadora. ':''
  const recommendation=sampleNote+(isAtRisk?`O caixa projetado fica negativo em ${p.points[first]?.day||today}. Recebimentos futuros dependem de confirmação.`:'Projeção combina compromissos datados e tendência residual; não é garantia de saldo.')+(known.warnings.length?' Há dados fora da projeção.':'')
  const pendingDebts=(input.debts||[]).filter(d=>d.context===input.context&&!['paid','cancelled'].includes(String(d.status))).reduce((sum,d)=>sum+Math.max(0,Number(d.total_amount||0)-Number(d.paid_amount||0)),0)
  return {dailyProjection:p.points,currentBalance:intelligence.snapshot.accountBalance,projectedEndBalance:p.points[29].balance,
    dailyAverage:basis.dailyExpense,estimatedDailyExpense:p.estimatedExpense/30,
    knownPayables30:p.knownExpense,knownReceivables30:p.knownIncome,pendingDebts,isAtRisk,riskLevel,
    dayZero:first>=0?first+1:null,recommendation,sampleSize:basis.sampleSize,sampleDays:basis.sampleDays,
    confidence:basis.confidence,outlierCap:basis.cap,cappedDays:basis.cappedDays}
}
