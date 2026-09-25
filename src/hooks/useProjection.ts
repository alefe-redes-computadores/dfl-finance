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
  outlierCap: number
  cappedDays: number
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

      /*
       * O Dexie já possui [user_id+context+date].
       * A projeção usa somente a janela histórica de 3 meses,
       * então não há motivo para materializar todo o ledger do
       * contexto e descartar o restante em JavaScript.
       */
      db.transactions
        .where('[user_id+context+date]')
        .between(
          [userId, context, historyStart],
          [userId, context, today],
          true,
          true
        )
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
          isRealizedFinancialTransaction(
            transaction
          ) &&
          isExpenseTransaction(transaction)
      )
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      )

    /*
     * V36 — média diária robusta.
     *
     * Uma compra extraordinária, financiamento quitado ou outro gasto
     * isolado não pode transformar sozinho a projeção de 30 dias em um
     * número astronômico.
     *
     * Primeiro agregamos o histórico realizado por dia civil. Depois
     * preenchemos os dias sem gasto com zero e limitamos SOMENTE para a
     * estimativa estatística os dias acima do P90 da própria amostra.
     *
     * O ledger continua intacto: nenhum lançamento é alterado e todos os
     * valores realizados continuam aparecendo normalmente nos relatórios.
     */
    const expenseByDay = new Map<string, number>()

    for (const transaction of historicalExpenses) {
      const key = String(transaction.date || '').slice(0, 10)
      if (!key) continue

      expenseByDay.set(
        key,
        (expenseByDay.get(key) || 0) +
          Math.abs(safeNumber(transaction.amount))
      )
    }

    let sampleDays = 0
    let firstSampleDate: Date | null = null
    const todayDate = parseCivilDate(today)

    if (historicalExpenses.length > 0) {
      firstSampleDate = parseCivilDate(
        historicalExpenses[0].date
      )

      if (firstSampleDate && todayDate) {
        sampleDays =
          differenceInCalendarDays(
            todayDate,
            firstSampleDate
          ) + 1
      }
    }

    const dailySamples: number[] = []

    if (
      sampleDays > 0 &&
      firstSampleDate
    ) {
      for (
        let index = 0;
        index < sampleDays;
        index++
      ) {
        const date = new Date(
          firstSampleDate.getFullYear(),
          firstSampleDate.getMonth(),
          firstSampleDate.getDate() + index,
          12
        )

        dailySamples.push(
          expenseByDay.get(
            format(date, 'yyyy-MM-dd')
          ) || 0
        )
      }
    }

    const positiveDailySamples =
      dailySamples
        .filter((value) => value > 0)
        .sort((a, b) => a - b)

    const p90Index =
      positiveDailySamples.length > 0
        ? Math.min(
            positiveDailySamples.length - 1,
            Math.floor(
              (positiveDailySamples.length - 1) *
                0.9
            )
          )
        : -1

    const dailyCap =
      p90Index >= 0
        ? positiveDailySamples[p90Index]
        : 0

    const robustHistoricalExpense =
      dailySamples.reduce(
        (sum, value) =>
          sum +
          (
            dailyCap > 0
              ? Math.min(value, dailyCap)
              : value
          ),
        0
      )

    const dailyAverage =
      sampleDays > 0
        ? robustHistoricalExpense / sampleDays
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

    const outlierNote =
      dailyCap > 0 &&
      dailySamples.some(
        (value) => value > dailyCap
      )
        ? ' Gastos excepcionalmente altos foram suavizados apenas no cálculo da tendência.'
        : ''

    if (confidence === 'low') {
      recommendation =
        sampleSize === 0
          ? 'Ainda não há histórico suficiente para projetar seus gastos com segurança.'
          : `A projeção ainda tem pouca amostra (${sampleSize} movimentações). Use o valor como referência inicial.${outlierNote}`
    } else if (riskLevel === 'critical') {
      recommendation =
        `Mantido o ritmo médio observado, o saldo projetado em 30 dias é ${formatCurrency(projectedEndBalance)}.${outlierNote}`
    } else if (riskLevel === 'high') {
      recommendation =
        `O ritmo médio observado projeta saldo negativo em 30 dias (${formatCurrency(projectedEndBalance)}).${outlierNote}`
    } else if (riskLevel === 'medium') {
      recommendation =
        `A projeção deixa uma margem reduzida de ${formatCurrency(projectedEndBalance)} em 30 dias.${outlierNote}`
    } else {
      recommendation =
        `Mantido o ritmo médio observado, o saldo projetado em 30 dias é ${formatCurrency(projectedEndBalance)}.`
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

      outlierCap:
        roundMoney(dailyCap),

      cappedDays:
        dailyCap > 0
          ? dailySamples.filter(
              (value) => value > dailyCap
            ).length
          : 0,
    }
  }, [context, user?.id])
}
