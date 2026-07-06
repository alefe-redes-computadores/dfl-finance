'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { db } from '@/lib/db'
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale' // 🔥 CORREÇÃO 1: Adicionado

// ============================================================
// 📊 INTERFACES TIPADAS
// ============================================================
export interface DashboardMetrics {
  kpis: {
    burnRate: number
    runway: number
    savingsRate: number
    averageDailyExpense: number
  }
  consolidated: {
    totalBalance: number
    netWorth: number
    monthlyEvolutionPercent: number
    pfBalance: number
    pjBalance: number
  }
  comparisonChart: {
    name: string
    receitasPF: number
    despesasPF: number
    receitasPJ: number
    despesasPJ: number
  }[]
  categoryPie: {
    pf: { name: string; value: number; color: string }[]
    pj: { name: string; value: number; color: string }[]
  }
  projections: {
    name: string
    otimista: number
    realista: number
    pessimista: number
  }[]
}

// ============================================================
// 🔥 HOOK PRINCIPAL
// ============================================================
export function useDashboardMetrics(currentDate: Date) {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const calculateMetrics = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    try {
      // 🔥 Busca toda a base de dados local de uma vez só para performance
      const allTransactions = await db.transactions.where('user_id').equals(user.id).toArray()
      const allAccounts = await db.accounts.where('user_id').equals(user.id).toArray()
      const allCategories = await db.categories.where('user_id').equals(user.id).toArray()

      // ============================================================
      // 📊 CONSTANTES DE TEMPO
      // ============================================================
      const today = new Date()
      const startOfCurrentMonth = format(startOfMonth(currentDate), 'yyyy-MM-dd')
      const endOfCurrentMonth = format(endOfMonth(currentDate), 'yyyy-MM-dd')

      // Meses para cálculo do Burn Rate (últimos 3 meses completos)
      const m1Start = format(startOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd')
      const m1End = format(endOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd')
      const m2Start = format(startOfMonth(subMonths(currentDate, 2)), 'yyyy-MM-dd')
      const m2End = format(endOfMonth(subMonths(currentDate, 2)), 'yyyy-MM-dd')
      const m3Start = format(startOfMonth(subMonths(currentDate, 3)), 'yyyy-MM-dd')
      const m3End = format(endOfMonth(subMonths(currentDate, 3)), 'yyyy-MM-dd')

      // Mês anterior para evolução
      const prevMonthStart = format(startOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd')
      const prevMonthEnd = format(endOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd')

      // ============================================================
      // 💰 SALDOS E CONSOLIDADO
      // ============================================================
      const activeAccounts = allAccounts.filter(acc => !acc.is_archived)
      const totalBalance = activeAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
      const pfBalance = activeAccounts.filter(acc => acc.context === 'personal').reduce((sum, acc) => sum + (acc.balance || 0), 0)
      const pjBalance = activeAccounts.filter(acc => acc.context === 'dfl').reduce((sum, acc) => sum + (acc.balance || 0), 0)

      // Mês atual
      const currentMonthTxs = allTransactions.filter(t => t.date >= startOfCurrentMonth && t.date <= endOfCurrentMonth && t.status === 'done')
      const currentIncome = currentMonthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0)
      const currentExpense = currentMonthTxs.filter(t => (t.type === 'expense' || t.type === 'sangria')).reduce((sum, t) => sum + (t.amount || 0), 0)
      const currentBalance = currentIncome - currentExpense

      // Mês anterior
      const prevMonthTxs = allTransactions.filter(t => t.date >= prevMonthStart && t.date <= prevMonthEnd && t.status === 'done')
      const prevIncome = prevMonthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0)
      const prevExpense = prevMonthTxs.filter(t => (t.type === 'expense' || t.type === 'sangria')).reduce((sum, t) => sum + (t.amount || 0), 0)
      const prevBalance = prevIncome - prevExpense

      const monthlyEvolutionPercent = prevBalance !== 0 ? ((currentBalance - prevBalance) / Math.abs(prevBalance)) * 100 : 0

      // ============================================================
      // 🧠 KPIs AVANÇADOS
      // ============================================================
      // Burn Rate: Média de despesas dos últimos 3 meses
      const expM1 = allTransactions.filter(t => t.date >= m1Start && t.date <= m1End && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((sum, t) => sum + (t.amount || 0), 0)
      const expM2 = allTransactions.filter(t => t.date >= m2Start && t.date <= m2End && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((sum, t) => sum + (t.amount || 0), 0)
      const expM3 = allTransactions.filter(t => t.date >= m3Start && t.date <= m3End && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((sum, t) => sum + (t.amount || 0), 0)
      const burnRate = (expM1 + expM2 + expM3) / 3

      // 🔥 CORREÇÃO 2: Runway com Infinity se burnRate for 0
      const runway = burnRate > 0 ? totalBalance / burnRate : Infinity

      // Taxa de Economia
      const savingsRate = currentIncome > 0 ? ((currentIncome - currentExpense) / currentIncome) * 100 : 0

      // Gasto Médio Diário
      const daysInMonth = today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear() 
        ? today.getDate() 
        : differenceInDays(new Date(endOfCurrentMonth), new Date(startOfCurrentMonth)) + 1
      const averageDailyExpense = daysInMonth > 0 ? currentExpense / daysInMonth : 0

      // ============================================================
      // 📊 GRÁFICO DE COMPARAÇÃO (PF vs PJ)
      // ============================================================
      const receitasPF = currentMonthTxs.filter(t => t.context === 'personal' && t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0)
      const despesasPF = currentMonthTxs.filter(t => t.context === 'personal' && (t.type === 'expense' || t.type === 'sangria')).reduce((sum, t) => sum + (t.amount || 0), 0)
      const receitasPJ = currentMonthTxs.filter(t => t.context === 'dfl' && t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0)
      const despesasPJ = currentMonthTxs.filter(t => t.context === 'dfl' && (t.type === 'expense' || t.type === 'sangria')).reduce((sum, t) => sum + (t.amount || 0), 0)

      const comparisonChart = [
        { name: 'Fluxo Consolidado', receitasPF, despesasPF, receitasPJ, despesasPJ }
      ]

      // ============================================================
      // 🍩 DISTRIBUIÇÃO DE GASTOS POR CATEGORIA (PF e PJ)
      // ============================================================
      const processCategories = (ctx: 'personal' | 'dfl') => {
        const map: Record<string, { name: string; value: number; color: string }> = {}
        currentMonthTxs
          .filter(t => t.context === ctx && (t.type === 'expense' || t.type === 'sangria'))
          .forEach(t => {
            const cat = allCategories.find(c => c.id === t.category_id)
            const name = cat?.name || 'Geral'
            const color = cat?.color || '#64748b'
            if (!map[name]) map[name] = { name, value: 0, color }
            map[name].value += t.amount || 0
          })
        return Object.values(map).sort((a, b) => b.value - a.value)
      }

      const categoryPie = {
        pf: processCategories('personal'),
        pj: processCategories('dfl')
      }

      // ============================================================
      // 📈 PROJEÇÕES DE LONGO PRAZO (12 MESES)
      // ============================================================
      const projections = Array.from({ length: 12 }).map((_, idx) => {
        const monthDate = subMonths(currentDate, -idx)
        const name = format(monthDate, 'MMM', { locale: ptBR }).toUpperCase()
        
        const baseBurn = burnRate || currentExpense || 1000
        const baseInc = currentIncome || 1000

        // 🔥 CORREÇÃO 3: Projeção com saldo inicial ajustado
        const saldoInicial = totalBalance
        
        const otimista = saldoInicial + ((baseInc * 1.1) - (baseBurn * 0.9)) * idx
        const realista = saldoInicial + (baseInc - baseBurn) * idx
        const pessimista = saldoInicial + ((baseInc * 0.9) - (baseBurn * 1.2)) * idx

        return { name, otimista, realista, pessimista }
      })

      setMetrics({
        kpis: { burnRate, runway, savingsRate, averageDailyExpense },
        consolidated: { totalBalance, netWorth: totalBalance, monthlyEvolutionPercent, pfBalance, pjBalance },
        comparisonChart,
        categoryPie,
        projections
      })

    } catch (err) {
      console.error('Erro ao processar useDashboardMetrics:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id, currentDate])

  useEffect(() => {
    calculateMetrics()
  }, [calculateMetrics])

  return { metrics, loading, reload: calculateMetrics }
}