// src/hooks/useProjection.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { differenceInCalendarDays, format, subMonths } from 'date-fns'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  getContextBalance,
  isExpenseTransaction,
  isRealizedFinancialTransaction,
  type FinancialContext,
} from '@/lib/financialMetrics'

export interface ProjectionData {
  dailyProjection: Array<{
    day: string
    balance: number
  }>
  currentBalance: number
  projectedEndBalance: number
  dailyAverage: number
  pendingDebts: number
  isAtRisk: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  dayZero: number | null
  recommendation: string | null
  sampleSize: number
  sampleDays: number
  confidence: 'low' | 'medium' | 'high'
}

const safeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const roundMoney = (value: number) =>
  Math.round(value * 100) / 100

const parseCivilDate = (value: string) => {
  const match = String(value)
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return null

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  )

  return Number.isNaN(date.getTime())
    ? null
    : date
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

export function useProjection(
  context: FinancialContext
) {
  const { user } = useAuth()

  return useLiveQuery(async () => {
    if (!context || !user?.id) return null

    /*
     * Projeção canônica:
     * - sempre person/user scoped;
     * - saldo vem das contas reais;
     * - histórico usa somente movimentações financeiras realizadas;
     * - compras de cartão abertas, metas e liquidações contábeis
     *   não são contadas como gasto realizado;
     * - não inventa gasto mínimo;
     * - não inventa comportamento de fim de semana;
     * - "Quem me deve" permanece recebível e não vira despesa.
     */
    const userId = user.id

    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const historyStart = format(
      subMonths(now, 3),
      'yyyy-MM-dd'
    )

    const [
      accounts,
      transactions,
      receivables,
    ] = await Promise.all([
      db.accounts
        .where('[user_id+context]')
        .equals([userId, context])
        .toArray(),

      db.transactions
        .where('[user_id+context]')
        .equals([userId, context])
        .toArray(),

      db.debts
        .where('[user_id+context]')
        .equals([userId, context])
        .toArray(),
    ])

    const currentBalance =
      getContextBalance(accounts, context)

    const historicalExpenses = transactions
      .filter(
        (transaction) =>
          transaction.date >= historyStart &&
          transaction.date <= today &&
          isRealizedFinancialTransaction(
            transaction
          ) &&
          isExpenseTransaction(transaction)
      )
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      )

    const totalHistoricalExpense =
      historicalExpenses.reduce(
        (sum, transaction) =>
          sum + safeNumber(transaction.amount),
        0
      )

    let sampleDays = 0

    if (historicalExpenses.length > 0) {
      const firstDate = parseCivilDate(
        historicalExpenses[0].date
      )

      const lastDate = parseCivilDate(
        historicalExpenses[
          historicalExpenses.length - 1
        ].date
      )

      if (firstDate && lastDate) {
        sampleDays =
          differenceInCalendarDays(
            lastDate,
            firstDate
          ) + 1
      }
    }

    const dailyAverage =
      sampleDays > 0
        ? totalHistoricalExpense / sampleDays
        : 0

    const sampleSize =
      historicalExpenses.length

    const confidence:
      | 'low'
      | 'medium'
      | 'high' =
      sampleSize >= 30 && sampleDays >= 45
        ? 'high'
        : sampleSize >= 10 && sampleDays >= 21
          ? 'medium'
          : 'low'

    /*
     * "Quem me deve" é recebível.
     * Mantemos a métrica no contrato legado `pendingDebts` para não
     * quebrar consumidores atuais, porém o valor NÃO é subtraído da
     * projeção.
     */
    const pendingDebts =
      receivables
        .filter(
          (debt) =>
            debt.status !== 'paid' &&
            debt.status !== 'cancelled'
        )
        .reduce((sum, debt) => {
          const total =
            safeNumber(debt.total_amount)

          const paid =
            safeNumber(debt.paid_amount)

          return (
            sum +
            Math.max(0, total - paid)
          )
        }, 0)

    const dailyProjection: Array<{
      day: string
      balance: number
    }> = []

    let runningBalance = currentBalance

    for (let index = 0; index < 30; index++) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + index,
        12
      )

      /*
       * Sem hipótese artificial.
       * Se não houver amostra, o saldo permanece estável e a
       * confiança baixa deixa explícita a limitação.
       */
      runningBalance -= dailyAverage

      dailyProjection.push({
        day: format(date, 'yyyy-MM-dd'),
        balance: roundMoney(runningBalance),
      })
    }

    const projectedEndBalance =
      dailyProjection.length > 0
        ? dailyProjection[
            dailyProjection.length - 1
          ].balance
        : roundMoney(currentBalance)

    let dayZero: number | null = null

    for (
      let index = 0;
      index < dailyProjection.length;
      index++
    ) {
      if (
        dailyProjection[index].balance < 0
      ) {
        dayZero = index + 1
        break
      }
    }

    let riskLevel:
      | 'low'
      | 'medium'
      | 'high'
      | 'critical' = 'low'

    if (projectedEndBalance < -500) {
      riskLevel = 'critical'
    } else if (projectedEndBalance < 0) {
      riskLevel = 'high'
    } else if (projectedEndBalance < 500) {
      riskLevel = 'medium'
    }

    let recommendation: string | null

    if (confidence === 'low') {
      recommendation =
        sampleSize === 0
          ? 'Ainda não há histórico suficiente para projetar seus gastos com segurança.'
          : `A projeção ainda tem pouca amostra (${sampleSize} movimentações). Use o valor como referência inicial.`
    } else if (riskLevel === 'critical') {
      recommendation =
        `Mantido o ritmo recente de gastos, o saldo projetado em 30 dias é ${formatCurrency(projectedEndBalance)}.`
    } else if (riskLevel === 'high') {
      recommendation =
        `O ritmo recente projeta saldo negativo em 30 dias (${formatCurrency(projectedEndBalance)}).`
    } else if (riskLevel === 'medium') {
      recommendation =
        `A projeção deixa uma margem reduzida de ${formatCurrency(projectedEndBalance)} em 30 dias.`
    } else {
      recommendation =
        `Mantido o ritmo recente, o saldo projetado em 30 dias é ${formatCurrency(projectedEndBalance)}.`
    }

    return {
      dailyProjection,

      currentBalance:
        roundMoney(currentBalance),

      projectedEndBalance:
        roundMoney(projectedEndBalance),

      dailyAverage:
        roundMoney(dailyAverage),

      pendingDebts:
        roundMoney(pendingDebts),

      isAtRisk:
        projectedEndBalance < 0,

      riskLevel,
      dayZero,
      recommendation,

      sampleSize,
      sampleDays,
      confidence,
    }
  }, [context, user?.id])
}
