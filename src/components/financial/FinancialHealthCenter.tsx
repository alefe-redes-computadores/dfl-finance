'use client'

import { useMemo, useState } from 'react'
import { Activity, ChevronDown, CircleDollarSign, Gauge, Landmark, SlidersHorizontal, Sparkles, Wallet } from 'lucide-react'
import type { FinancialIntelligenceOutput, IntelligenceTransactionLike } from '@/lib/financial-intelligence'
import { buildFinancialPlan, simulateFinancialScenario } from '@/lib/financialPlanning'

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const confidenceLabel = { low: 'Baixa', medium: 'Média', high: 'Alta' } as const

export default function FinancialHealthCenter({
  intelligence,
  transactions,
}: {
  intelligence: FinancialIntelligenceOutput
  transactions: IntelligenceTransactionLike[]
}) {
  const [openScenario, setOpenScenario] = useState(false)
  const [extraIncome, setExtraIncome] = useState('')
  const [expenseReduction, setExpenseReduction] = useState('')
  const [debtAllocation, setDebtAllocation] = useState('')

  const plan = useMemo(
    () => buildFinancialPlan(intelligence, transactions),
    [intelligence, transactions]
  )
  const scenario = useMemo(
    () => simulateFinancialScenario(plan, {
      extraIncomeMonthly: Number(extraIncome.replace(',', '.')) || 0,
      expenseReductionMonthly: Number(expenseReduction.replace(',', '.')) || 0,
      debtAllocationNow: Number(debtAllocation.replace(',', '.')) || 0,
    }),
    [plan, extraIncome, expenseReduction, debtAllocation]
  )

  const healthTone =
    plan.availableAfterKnownCommitments < 0
      ? 'text-red-600 dark:text-red-400'
      : plan.projectedMonthNet < 0
        ? 'text-orange-600 dark:text-orange-400'
        : 'text-emerald-600 dark:text-emerald-400'

  const fields = [
    ['Receitas realizadas', plan.realizedIncome, 'text-emerald-600 dark:text-emerald-400'],
    ['Despesas realizadas', plan.realizedExpense, 'text-red-500 dark:text-red-400'],
    ['A pagar no mês', plan.committedPayables, 'text-orange-600 dark:text-orange-400'],
    ['A receber no mês', plan.probableReceivables, 'text-teal-700 dark:text-teal-400'],
  ] as const

  return (
    <section className="mb-4 overflow-hidden rounded-[20px] border border-gray-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="border-b border-gray-100 px-4 py-4 dark:border-slate-700/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Activity size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Centro financeiro</p>
              <h2 className="mt-0.5 text-[15px] font-semibold text-gray-900 dark:text-gray-100">Saúde e planejamento do mês</h2>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-400">Confiança</p>
            <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{confidenceLabel[plan.confidence]}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          {fields.map(([label, value, tone]) => (
            <div key={label} className="rounded-[15px] bg-gray-50 px-3 py-3 dark:bg-slate-900/40">
              <p className="text-[10px] font-medium text-gray-400">{label}</p>
              <p className={`mt-1 text-[13px] font-bold ${tone}`}>{brl(value)}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[16px] border border-gray-200/70 p-3.5 dark:border-slate-700">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet size={15} className="text-gray-400" />
              <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">Livre após compromissos conhecidos</span>
            </div>
            <span className={`text-[14px] font-bold ${healthTone}`}>{brl(plan.availableAfterKnownCommitments)}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-gray-500 dark:text-gray-400">
            <span>Estimativa restante: <strong>{brl(plan.estimatedRemainingExpense)}</strong></span>
            <span>Recorrências/mês: <strong>{brl(plan.recurringMonthly)}</strong></span>
            <span>Cartões abertos: <strong>{brl(plan.cardExposure)}</strong></span>
            <span>Crédito em aberto: <strong>{brl(plan.creditCommitments)}</strong></span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-[16px] bg-slate-900 px-3.5 py-3 text-white dark:bg-slate-950">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">Fim do mês no ritmo atual</p>
            <p className="mt-1 text-[15px] font-bold">{brl(plan.projectedMonthEndCash)}</p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
            <Gauge size={14} /> {plan.sampleSize} lançamentos na amostra
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpenScenario((value) => !value)}
          className="mt-3 flex w-full items-center justify-between rounded-[15px] border border-teal-200 bg-teal-50/70 px-3.5 py-3 text-left dark:border-teal-900/60 dark:bg-teal-500/5"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal size={16} className="text-teal-600 dark:text-teal-400" />
            <div>
              <p className="text-[11px] font-semibold text-teal-800 dark:text-teal-300">Simular cenário</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Teste renda extra, redução de gastos ou antecipação de dívida</p>
            </div>
          </div>
          <ChevronDown size={16} className={`text-teal-600 transition-transform ${openScenario ? 'rotate-180' : ''}`} />
        </button>

        {openScenario && (
          <div className="mt-2 rounded-[16px] border border-gray-200/70 p-3.5 dark:border-slate-700">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                ['Renda extra/mês', extraIncome, setExtraIncome],
                ['Reduzir gastos/mês', expenseReduction, setExpenseReduction],
                ['Antecipar dívida agora', debtAllocation, setDebtAllocation],
              ].map(([label, value, setter]) => (
                <label key={label as string} className="block">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-400">{label as string}</span>
                  <div className="mt-1 flex items-center rounded-[12px] bg-gray-50 px-3 dark:bg-slate-900/50">
                    <span className="text-[11px] text-gray-400">R$</span>
                    <input
                      inputMode="decimal"
                      value={value as string}
                      onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                      className="w-full bg-transparent px-2 py-2.5 text-[12px] font-semibold text-gray-800 outline-none dark:text-gray-100"
                      placeholder="0,00"
                    />
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[14px] bg-gray-50 p-3 dark:bg-slate-900/40">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-400">Em ~30 dias</p>
                <p className="mt-1 text-[13px] font-bold text-gray-900 dark:text-gray-100">{brl(scenario.scenario30)}</p>
                <p className="mt-1 text-[9px] text-emerald-600 dark:text-emerald-400">Impacto operacional {brl(scenario.improvement30)}</p>
              </div>
              <div className="rounded-[14px] bg-gray-50 p-3 dark:bg-slate-900/40">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-400">Em ~90 dias</p>
                <p className="mt-1 text-[13px] font-bold text-gray-900 dark:text-gray-100">{brl(scenario.scenario90)}</p>
                <p className="mt-1 text-[9px] text-emerald-600 dark:text-emerald-400">Impacto operacional {brl(scenario.improvement90)}</p>
              </div>
            </div>
            <p className="mt-2.5 text-[9px] leading-4 text-gray-400">{scenario.note}</p>
          </div>
        )}
      </div>
    </section>
  )
}
