// src/hooks/useProjection.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  addDays, 
  differenceInDays, 
  format 
} from 'date-fns'
import { safeNumber } from '@/lib/safe'

export interface ProjectionData {
  dailyProjection: Array<{ day: string; balance: number }>
  currentBalance: number
  projectedEndBalance: number
  dailyAverage: number
  pendingDebts: number
  isAtRisk: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  dayZero: number | null
  recommendation: string | null
}

export function useProjection(context: 'dfl' | 'personal') {
  return useLiveQuery(async () => {
    if (!context) return null

    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')

    // ============================================================
    // 1. BUSCAR DADOS DO CONTEXTO ATUAL
    // ============================================================

    // Saldo atual das contas
    const accounts = await db.accounts
      .where('context').equals(context)
      .and((a: any) => a.is_archived !== true)
      .toArray()

    const currentBalance = accounts.reduce((acc, a) => acc + safeNumber(a.balance), 0)

    // Buscar transações dos últimos 3 meses (para média)
    const threeMonthsAgo = subMonths(now, 3)
    const threeMonthsAgoStr = format(threeMonthsAgo, 'yyyy-MM-dd')

    const allTransactions = await db.transactions
      .where('context').equals(context)
      .and((t: any) => t.date >= threeMonthsAgoStr)
      .toArray()

    // Filtrar apenas despesas (expense, sangria) com status done
    const expenses = allTransactions
      .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')

    // Calcular média diária de gastos
    let dailyAverage = 0
    if (expenses.length > 0) {
      const totalExpense = expenses.reduce((acc, t) => acc + safeNumber(t.amount), 0)
      
      // Dias entre a primeira e a última transação + 1
      const dates = expenses.map((t: any) => new Date(t.date))
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
      const daysRange = differenceInDays(maxDate, minDate) + 1
      
      // Evita divisão por zero
      dailyAverage = daysRange > 0 ? totalExpense / daysRange : 0
    }

    // Se não houver gastos, usa um valor mínimo
    if (dailyAverage === 0) {
      dailyAverage = 10 // Valor mínimo para evitar projeção linear infinita
    }

    // Dívidas pendentes (não pagas)
    const debts = await db.debts
      .where('context').equals(context)
      .and((d: any) => d.status !== 'paid' && d.status !== 'cancelled')
      .toArray()

    const pendingDebts = debts.reduce((acc, d) => {
      const total = safeNumber(d.total_amount)
      const paid = safeNumber(d.paid_amount || 0)
      return acc + (total - paid)
    }, 0)

    // Assinaturas ativas (gastos fixos mensais)
    const subscriptions = await db.subscriptions
      .where('context').equals(context)
      .and((s: any) => s.status === 'active')
      .toArray()

    const subscriptionsTotal = subscriptions.reduce((acc, s) => {
      let monthlyAmount = safeNumber(s.amount)
      switch (s.billing_cycle) {
        case 'yearly': monthlyAmount = monthlyAmount / 12; break
        case 'weekly': monthlyAmount = monthlyAmount * 4.33; break
        case 'quarterly': monthlyAmount = monthlyAmount / 3; break
        case 'semiannually': monthlyAmount = monthlyAmount / 6; break
        default: monthlyAmount = monthlyAmount // monthly
      }
      return acc + monthlyAmount
    }, 0)

    // ============================================================
    // 2. GERAR PROJEÇÃO DIÁRIA (30 dias)
    // ============================================================

    const dailyProjection: Array<{ day: string; balance: number }> = []
    let runningBalance = currentBalance

    // Parcelamento das dívidas em 30 dias (se houver)
    const dailyDebtPayment = pendingDebts > 0 ? pendingDebts / 30 : 0
    const dailySubscriptions = subscriptionsTotal / 30

    for (let i = 0; i < 30; i++) {
      const date = addDays(now, i)
      const dayStr = format(date, 'yyyy-MM-dd')
      
      // Reduz gastos nos finais de semana (opcional - 20% menos)
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const dailySpend = isWeekend ? dailyAverage * 0.8 : dailyAverage

      // Deduz do saldo: gasto médio + dívida parcelada + assinaturas
      runningBalance = runningBalance - dailySpend - dailyDebtPayment - dailySubscriptions

      dailyProjection.push({
        day: dayStr,
        balance: Math.round(runningBalance * 100) / 100,
      })
    }

    // ============================================================
    // 3. MÉTRICAS E ANÁLISE DE RISCO
    // ============================================================

    const lastDayBalance = dailyProjection[dailyProjection.length - 1]?.balance || 0
    const projectedEndBalance = Math.round(lastDayBalance * 100) / 100

    // "Dia do Zero" - quando o saldo chegaria a R$ 0
    let dayZero: number | null = null
    for (let i = 0; i < dailyProjection.length; i++) {
      if (dailyProjection[i].balance < 0) {
        dayZero = i + 1 // dias até zerar
        break
      }
    }

    // Nível de risco
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    let recommendation: string | null = null

    if (projectedEndBalance < -500) {
      riskLevel = 'critical'
      recommendation = `⚠️ Projeção crítica! Saldo estimado em R$ ${projectedEndBalance.toFixed(2)}. Reduza gastos em R$ ${(dailyAverage * 0.3).toFixed(2)}/dia.`
    } else if (projectedEndBalance < 0) {
      riskLevel = 'high'
      recommendation = `🔴 Atenção! Saldo projetado negativo (R$ ${projectedEndBalance.toFixed(2)}). Tente reduzir R$ ${(dailyAverage * 0.2).toFixed(2)}/dia.`
    } else if (projectedEndBalance < 200) {
      riskLevel = 'medium'
      recommendation = `🟡 Saldo projetado de R$ ${projectedEndBalance.toFixed(2)}. Mantenha o controle para não apertar.`
    } else if (projectedEndBalance < 500) {
      riskLevel = 'medium'
      recommendation = `🟡 Saldo de R$ ${projectedEndBalance.toFixed(2)}. Bom, mas com margem para melhorar.`
    } else {
      riskLevel = 'low'
      recommendation = `🟢 Ótimo! Projeção de R$ ${projectedEndBalance.toFixed(2)}. Continue assim!`
    }

    // ============================================================
    // 4. RETORNO
    // ============================================================

    return {
      dailyProjection,
      currentBalance: Math.round(currentBalance * 100) / 100,
      projectedEndBalance,
      dailyAverage: Math.round(dailyAverage * 100) / 100,
      pendingDebts: Math.round(pendingDebts * 100) / 100,
      isAtRisk: projectedEndBalance < 0,
      riskLevel,
      dayZero,
      recommendation,
    }
  }, [context])
}