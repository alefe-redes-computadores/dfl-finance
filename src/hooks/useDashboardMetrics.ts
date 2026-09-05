// src/hooks/useDashboardMetrics.ts
'use client'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { useAuth } from '@/lib/hooks/useAuth'
import { db } from '@/lib/db'
import {
  buildCategoryDistribution,
  buildDailyProjection,
  buildMonthlyProjection,
  filterTransactionsByMonth,
  getContextBalance,
  getHistoricalMonthlyAverages,
  getMonthlyFlow,
  sumExpense,
  sumIncome,
  type FinancialContext,
} from '@/lib/financialMetrics'

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
    pf: {
      name: string
      value: number
      color: string
    }[]
    pj: {
      name: string
      value: number
      color: string
    }[]
  }
  projections: {
    name: string
    otimista: number
    realista: number
    pessimista: number
  }[]
  dailyProjection: {
    projection_date: string
    projected_balance: number
  }[]
}

export function useDashboardMetrics(
  currentDate: Date,
  context?: FinancialContext
) {
  const { user } = useAuth()
  const [metrics, setMetrics] =
    useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const calculateMetrics = useCallback(async () => {
    if (!user?.id) {
      setMetrics(null)
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const [
        allTransactions,
        allAccounts,
        allCategories,
      ] = await Promise.all([
        db.transactions
          .where('user_id')
          .equals(user.id)
          .toArray(),
        db.accounts
          .where('user_id')
          .equals(user.id)
          .toArray(),
        db.categories
          .where('user_id')
          .equals(user.id)
          .toArray(),
      ])

      const pfBalance = getContextBalance(
        allAccounts,
        'personal'
      )

      const pjBalance = getContextBalance(
        allAccounts,
        'dfl'
      )

      const totalBalance = context
        ? getContextBalance(allAccounts, context)
        : pfBalance + pjBalance

      const currentFlow = getMonthlyFlow(
        allTransactions,
        currentDate,
        context
      )

      const previousDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      )

      const previousFlow = getMonthlyFlow(
        allTransactions,
        previousDate,
        context
      )

      const monthlyEvolutionPercent =
        previousFlow.balance !== 0
          ? (
              (
                currentFlow.balance -
                previousFlow.balance
              ) /
              Math.abs(previousFlow.balance)
            ) * 100
          : 0

      const history =
        getHistoricalMonthlyAverages(
          allTransactions,
          currentDate,
          6,
          context
        )

      const burnRate =
        history.averageExpense

      const runway =
        burnRate > 0
          ? totalBalance / burnRate
          : Infinity

      const savingsRate =
        currentFlow.income > 0
          ? (
              (
                currentFlow.income -
                currentFlow.expense
              ) /
              currentFlow.income
            ) * 100
          : 0

      const currentMonthTransactions =
        filterTransactionsByMonth(
          allTransactions,
          currentDate,
          context
        )

      const isCurrentMonth =
        currentDate.getFullYear() ===
          new Date().getFullYear() &&
        currentDate.getMonth() ===
          new Date().getMonth()

      const daysElapsed = isCurrentMonth
        ? Math.max(1, new Date().getDate())
        : Math.max(
            1,
            differenceInCalendarDays(
              new Date(
                currentDate.getFullYear(),
                currentDate.getMonth() + 1,
                0
              ),
              new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                1
              )
            ) + 1
          )

      const averageDailyExpense =
        currentFlow.expense / daysElapsed

      const pfTransactions =
        filterTransactionsByMonth(
          allTransactions,
          currentDate,
          'personal'
        )

      const pjTransactions =
        filterTransactionsByMonth(
          allTransactions,
          currentDate,
          'dfl'
        )

      const comparisonChart = [
        {
          name: 'Fluxo Consolidado',
          receitasPF: sumIncome(pfTransactions),
          despesasPF: sumExpense(pfTransactions),
          receitasPJ: sumIncome(pjTransactions),
          despesasPJ: sumExpense(pjTransactions),
        },
      ]

      const categoryPie = {
        pf: buildCategoryDistribution(
          allTransactions,
          allCategories,
          currentDate,
          'personal'
        ),
        pj: buildCategoryDistribution(
          allTransactions,
          allCategories,
          currentDate,
          'dfl'
        ),
      }

      const projections = buildMonthlyProjection({
        currentBalance: totalBalance,
        averageIncome: history.averageIncome,
        averageExpense: history.averageExpense,
        referenceDate: currentDate,
        months: 12,
      })

      const dailyProjection =
        buildDailyProjection({
          currentBalance: totalBalance,
          averageIncome: history.averageIncome,
          averageExpense: history.averageExpense,
          referenceDate: new Date(),
          days: 30,
        })

      setMetrics({
        kpis: {
          burnRate,
          runway,
          savingsRate,
          averageDailyExpense,
        },
        consolidated: {
          totalBalance,
          netWorth: totalBalance,
          monthlyEvolutionPercent,
          pfBalance,
          pjBalance,
        },
        comparisonChart,
        categoryPie,
        projections,
        dailyProjection,
      })
    } catch (error) {
      console.error(
        'Erro ao processar métricas financeiras:',
        error
      )
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [context, currentDate, user?.id])

  useEffect(() => {
    calculateMetrics()
  }, [calculateMetrics])

  return {
    metrics,
    loading,
    reload: calculateMetrics,
  }
}
