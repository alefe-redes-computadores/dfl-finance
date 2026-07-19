'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { startOfMonth, endOfMonth, subMonths, addMonths, differenceInDays, isAfter, isBefore } from 'date-fns'
import { safeNumber } from '@/lib/safe'

export interface ProjectionData {
  context: 'dfl' | 'personal'
  currentBalance: number
  projectedEndMonth: number
  projectedEndNextMonth: number
  dailyAverage: number
  projectedBalanceByDay: Array<{ date: string; balance: number }>
  pendingDebts: number
  upcomingInvoices: number
  subscriptions: number
  dayZero: number | null // Quantos dias até o saldo zerar (null se não zerar)
  isAtRisk: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  monthEndDate: string
  nextMonthEndDate: string
  recommendation: string | null
}

export function useProjection(context: 'dfl' | 'personal') {
  return useLiveQuery(async () => {
    if (!context) return null

    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const nextMonthEnd = endOfMonth(addMonths(now, 1))

    // ============================================================
    // 1. BUSCA DADOS FILTRADOS PELO CONTEXTO ATIVO
    // ============================================================

    // Transações do mês atual
    const monthTransactions = await db.transactions
      .where('context').equals(context)
      .and((t: any) => t.date >= monthStart.toISOString().split('T')[0] && t.date <= monthEnd.toISOString().split('T')[0])
      .toArray()

    // Transações do mês passado (para calcular média)
    const prevMonthStart = startOfMonth(subMonths(now, 1))
    const prevMonthEnd = endOfMonth(subMonths(now, 1))
    const prevMonthTransactions = await db.transactions
      .where('context').equals(context)
      .and((t: any) => t.date >= prevMonthStart.toISOString().split('T')[0] && t.date <= prevMonthEnd.toISOString().split('T')[0])
      .toArray()

    // Dívidas ativas (não pagas)
    const debts = await db.debts
      .where('context').equals(context)
      .and((d: any) => d.status !== 'paid' && d.status !== 'cancelled')
      .toArray()

    // Faturas de cartão (com valor > 0)
    const cards = await db.credit_cards
      .where('context').equals(context)
      .and((c: any) => c.is_archived !== true)
      .toArray()

    // Assinaturas ativas
    const subscriptions = await db.subscriptions
      .where('context').equals(context)
      .and((s: any) => s.status === 'active')
      .toArray()

    // ============================================================
    // 2. CÁLCULOS
    // ============================================================

    // Saldo atual (soma das contas)
    const accounts = await db.accounts
      .where('context').equals(context)
      .and((a: any) => a.is_archived !== true)
      .toArray()

    const currentBalance = accounts.reduce((acc, a) => acc + safeNumber(a.balance), 0)

    // Total de despesas do mês atual (transações já pagas)
    const currentMonthExpenses = monthTransactions
      .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
      .reduce((acc, t) => acc + safeNumber(t.amount), 0)

    // Total de receitas do mês atual
    const currentMonthIncome = monthTransactions
      .filter((t: any) => t.type === 'income' && t.status === 'done')
      .reduce((acc, t) => acc + safeNumber(t.amount), 0)

    // Média diária de gastos (baseado no mês passado)
    const prevMonthExpenses = prevMonthTransactions
      .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
      .reduce((acc, t) => acc + safeNumber(t.amount), 0)

    const daysInPrevMonth = differenceInDays(prevMonthEnd, prevMonthStart) + 1
    const dailyAverage = daysInPrevMonth > 0 ? prevMonthExpenses / daysInPrevMonth : 0

    // Total de dívidas pendentes
    const pendingDebts = debts.reduce((acc, d) => acc + (safeNumber(d.total_amount) - safeNumber(d.paid_amount || 0)), 0)

    // Total de faturas de cartão (estimativa do mês)
    let totalInvoices = 0
    for (const card of cards) {
      const cardTransactions = await db.transactions
        .where('credit_card_id').equals(card.id)
        .and((t: any) => t.date >= monthStart.toISOString().split('T')[0] && t.date <= monthEnd.toISOString().split('T')[0])
        .toArray()
      totalInvoices += cardTransactions.reduce((acc, t) => acc + safeNumber(t.amount), 0)
    }

    // Total de assinaturas (valor mensal)
    const subscriptionsTotal = subscriptions.reduce((acc, s) => {
      let monthlyAmount = safeNumber(s.amount)
      switch (s.billing_cycle) {
        case 'yearly': monthlyAmount = monthlyAmount / 12; break
        case 'weekly': monthlyAmount = monthlyAmount * 4.33; break
        case 'quarterly': monthlyAmount = monthlyAmount / 3; break
        case 'semiannually': monthlyAmount = monthlyAmount / 6; break
      }
      return acc + monthlyAmount
    }, 0)

    // Total de despesas projetadas para o resto do mês
    const daysLeftInMonth = differenceInDays(monthEnd, now) + 1
    const projectedRemainingExpenses = dailyAverage * daysLeftInMonth

    // Projeção do saldo no final do mês
    const projectedEndMonth = currentBalance - projectedRemainingExpenses - pendingDebts - totalInvoices - subscriptionsTotal

    // Projeção para o próximo mês (assumindo mesmo padrão)
    const projectedNextMonthExpenses = dailyAverage * 30
    const projectedEndNextMonth = projectedEndMonth - projectedNextMonthExpenses - pendingDebts

    // Cálculo do "Dia do Zero" (quando o saldo chegaria a R$ 0)
    let dayZero: number | null = null
    if (projectedEndMonth < 0 && dailyAverage > 0) {
      const daysUntilZero = Math.floor(currentBalance / dailyAverage)
      dayZero = daysUntilZero > 0 && daysUntilZero <= 30 ? daysUntilZero : null
    }

    // Nível de risco
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    let recommendation: string | null = null

    if (projectedEndMonth < 0) {
      riskLevel = 'critical'
      recommendation = `⚠️ Seu saldo projetado para o fim do mês é negativo (R$ ${projectedEndMonth.toFixed(2)}). Recomendamos reduzir gastos em ${((projectedRemainingExpenses * 0.15) / 30).toFixed(2)} por dia.`
    } else if (projectedEndMonth < 100) {
      riskLevel = 'high'
      recommendation = `🔴 Seu saldo projetado está baixo (R$ ${projectedEndMonth.toFixed(2)}). Tente economizar ${((projectedRemainingExpenses * 0.1) / 30).toFixed(2)} por dia.`
    } else if (projectedEndMonth < 500) {
      riskLevel = 'medium'
      recommendation = `🟡 Saldo projetado de R$ ${projectedEndMonth.toFixed(2)}. Mantenha o ritmo para fechar o mês com folga.`
    } else {
      riskLevel = 'low'
      recommendation = `🟢 Ótimo! Projeção de R$ ${projectedEndMonth.toFixed(2)} para o fim do mês. Continue assim!`
    }

    // Projeção diária (para o gráfico)
    const projectedBalanceByDay: Array<{ date: string; balance: number }> = []
    let runningBalance = currentBalance

    for (let i = 0; i < 30; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      // Gasto médio do dia (reduz aos finais de semana)
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const dailySpend = isWeekend ? dailyAverage * 0.8 : dailyAverage

      runningBalance = runningBalance - dailySpend

      // Aplica parcelas de dívidas (se houver)
      if (i % 30 === 0 && pendingDebts > 0) {
        runningBalance -= pendingDebts / (30 / 30) // parcelado em 30 dias
      }

      projectedBalanceByDay.push({
        date: dateStr,
        balance: Math.round(runningBalance * 100) / 100,
      })
    }

    // ============================================================
    // 3. RETORNO
    // ============================================================

    return {
      context,
      currentBalance: Math.round(currentBalance * 100) / 100,
      projectedEndMonth: Math.round(projectedEndMonth * 100) / 100,
      projectedEndNextMonth: Math.round(projectedEndNextMonth * 100) / 100,
      dailyAverage: Math.round(dailyAverage * 100) / 100,
      projectedBalanceByDay,
      pendingDebts: Math.round(pendingDebts * 100) / 100,
      upcomingInvoices: Math.round(totalInvoices * 100) / 100,
      subscriptions: Math.round(subscriptionsTotal * 100) / 100,
      dayZero,
      isAtRisk: projectedEndMonth < 0,
      riskLevel,
      monthEndDate: monthEnd.toISOString().split('T')[0],
      nextMonthEndDate: nextMonthEnd.toISOString().split('T')[0],
      recommendation,
    }
  }, [context])
}