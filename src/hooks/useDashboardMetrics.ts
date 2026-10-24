// src/hooks/useDashboardMetrics.ts
'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  differenceInCalendarDays,
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
} from 'date-fns'
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

  // A identidade do mes, e nao do objeto Date, controla a consulta.
  const monthKey =
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

  const referenceDate = useMemo(
    () => new Date(
      Number(monthKey.slice(0, 4)),
      Number(monthKey.slice(5, 7)) - 1,
      1
    ),
    [monthKey]
  )

  // Cada consulta tem uma versao. Somente a mais recente
  // pode publicar metricas, erros ou estado de loading.
  const requestVersionRef = useRef(0)

  const calculateMetrics = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current

    const isCurrentRequest = () =>
      requestVersion === requestVersionRef.current
    if (!user?.id) {
      if (isCurrentRequest()) {
        setMetrics(null)
        setLoading(false)
      }
      return
    }

    setLoading(true)

    try {
      /*
       * O dashboard trabalha com o mês de referência,
       * o mês anterior e seis meses históricos.
       *
       * Mantemos PF + PJ disponíveis simultaneamente:
       * contas e categorias continuam carregadas para os
       * dois contextos, preservando os contratos de
       * consolidated/comparisonChart/categoryPie.
       *
       * Apenas o histórico de transações recebe uma janela
       * temporal indexada.
       */
      const historyStart = format(
        startOfMonth(
          subMonths(referenceDate, 6)
        ),
        'yyyy-MM-dd'
      )

      const historyEnd = format(
        endOfMonth(referenceDate),
        'yyyy-MM-dd'
      )

      const [
        allTransactions,
        allAccounts,
        allCategories,
      ] = await Promise.all([
        db.transactions
          .where('[user_id+date]')
          .between(
            [
              user.id,
              historyStart,
            ],
            [
              user.id,
              historyEnd,
            ],
            true,
            true
          )
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

      if (!isCurrentRequest()) return

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
        referenceDate,
        context
      )

      const previousDate = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth() - 1,
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
          referenceDate,
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
          referenceDate,
          context
        )

      const isCurrentMonth =
        referenceDate.getFullYear() ===
          new Date().getFullYear() &&
        referenceDate.getMonth() ===
          new Date().getMonth()

      const daysElapsed = isCurrentMonth
        ? Math.max(1, new Date().getDate())
        : Math.max(
            1,
            differenceInCalendarDays(
              new Date(
                referenceDate.getFullYear(),
                referenceDate.getMonth() + 1,
                0
              ),
              new Date(
                referenceDate.getFullYear(),
                referenceDate.getMonth(),
                1
              )
            ) + 1
          )

      const averageDailyExpense =
        currentFlow.expense / daysElapsed

      const pfTransactions =
        filterTransactionsByMonth(
          allTransactions,
          referenceDate,
          'personal'
        )

      const pjTransactions =
        filterTransactionsByMonth(
          allTransactions,
          referenceDate,
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
          referenceDate,
          'personal'
        ),
        pj: buildCategoryDistribution(
          allTransactions,
          allCategories,
          referenceDate,
          'dfl'
        ),
      }

      const projections = buildMonthlyProjection({
        currentBalance: totalBalance,
        averageIncome: history.averageIncome,
        averageExpense: history.averageExpense,
        referenceDate: referenceDate,
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

      if (!isCurrentRequest()) return

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
      if (isCurrentRequest()) {
        setMetrics(null)
      }
    } finally {
      if (isCurrentRequest()) {
        setLoading(false)
      }
    }
  }, [context, referenceDate, user?.id])

  useEffect(() => {
    void calculateMetrics()

    return () => {
      requestVersionRef.current += 1
    }
  }, [calculateMetrics])

  return {
    metrics,
    loading,
    reload: calculateMetrics,
  }
}
