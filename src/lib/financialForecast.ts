import { isRealizedFinancialTransaction, isExpenseTransaction } from '@/lib/financialMetrics'
import type { IntelligenceTransactionLike } from '@/lib/financial-intelligence/types'

export const civilDate = (value: unknown): string | null => {
  const text = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const date = new Date(`${text}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null
}
export const civilISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
export const addCivilDays = (date: string, count: number) => new Date(Date.parse(`${date}T12:00:00Z`) + count*86400000).toISOString().slice(0,10)
export const centsMoney = (value: number) => Math.round(value*100)/100

export interface ForecastBasis {
  dailyIncome: number
  dailyExpense: number
  sampleDays: number
  sampleSize: number
  activeExpenseDays: number
  activeIncomeDays: number
  cappedDays: number
  cap: number
  confidence: 'low' | 'medium' | 'high'
}

/** One estimator for every consumer. Actual values are never capped. */
export function buildForecastBasis(transactions: IntelligenceTransactionLike[], context: string, now: Date, cash = false): ForecastBasis {
  const today = civilISO(now), earliest = addCivilDays(today, -89)
  const scoped = transactions.filter(tx=>tx.context===context && civilDate(tx.date) && tx.date!.slice(0,10)>=earliest && tx.date!.slice(0,10)<=today)
  const observations = scoped.filter(tx=> {
    if (tx.transfer_group_id || tx.type==='transfer' || tx.goal_id) return false
    if (!cash) return isRealizedFinancialTransaction(tx)
    return tx.status==='done' && !tx.credit_card_id &&
      (isRealizedFinancialTransaction(tx) || (tx.type==='expense' && !!tx.invoice_id))
  })
  const first = observations.map(tx=>tx.date!.slice(0,10)).sort()[0] || today
  const sampleDays = observations.length ? Math.round((Date.parse(`${today}T12:00:00Z`)-Date.parse(`${first}T12:00:00Z`))/86400000)+1 : 0
  const expense = new Map<string,number>(), income = new Map<string,number>()
  for (const tx of observations) {
    const value=Number(tx.amount);if(!Number.isFinite(value)||value<=0)continue
    const target=isExpenseTransaction(tx)?expense:tx.type==='income'?income:null
    if(target){const date=tx.date!.slice(0,10);target.set(date,(target.get(date)||0)+value)}
  }
  const positives=Array.from(expense.values()).sort((a,b)=>a-b)
  const cap=positives.length>=3?positives[Math.floor((positives.length-1)*0.9)]:0
  const enoughExpense=positives.length>=3 && sampleDays>=7
  const enoughIncome=income.size>=3 && sampleDays>=7
  const sampleSize=observations.length
  const independentDays=new Set(Array.from(expense.keys()).concat(Array.from(income.keys()))).size
  const confidence=sampleSize>=40&&sampleDays>=45&&independentDays>=15?'high':sampleSize>=15&&sampleDays>=21&&independentDays>=7?'medium':'low'
  return {dailyIncome:enoughIncome?Array.from(income.values()).reduce((a,b)=>a+b,0)/sampleDays:0,
    dailyExpense:enoughExpense?positives.reduce((a,b)=>a+Math.min(b,cap),0)/sampleDays:0,
    sampleDays,sampleSize,activeExpenseDays:expense.size,activeIncomeDays:income.size,
    cappedDays:enoughExpense?positives.filter(x=>x>cap).length:0,cap:enoughExpense?cap:0,confidence}
}
