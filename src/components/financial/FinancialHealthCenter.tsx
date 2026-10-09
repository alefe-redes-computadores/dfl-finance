'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Gauge,
  Info,
  Landmark,
  SearchCheck,
  SlidersHorizontal,
  Sparkles,
  Wallet,
} from 'lucide-react'
import type { FinancialIntelligenceOutput, IntelligenceTransactionLike } from '@/lib/financial-intelligence'
import {
  buildFinancialDiscoveries,
  buildFinancialPlan,
  buildKnownCashTimeline,
  simulateFinancialScenario,
} from '@/lib/financialPlanning'

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
  const [openExplanation, setOpenExplanation] = useState(false)
  const [openTimeline, setOpenTimeline] = useState(false)
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

  const timeline = useMemo(
    () => buildKnownCashTimeline(intelligence, transactions, 30),
    [intelligence, transactions]
  )

  const discoveries = useMemo(
    () => buildFinancialDiscoveries(plan, timeline),
    [plan, timeline]
  )

  const timelinePreview = useMemo(
    () => timeline.days.slice(0, 7),
    [timeline.days]
  )

  const formatDate = (date: string) =>
    date.split('-').reverse().join('/')

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

        {discoveries.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-[16px] border border-gray-200/70 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3.5 py-3 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-violet-500" />
                <div>
                  <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                    Descobertas
                  </p>
                  <p className="text-[9px] text-gray-400">
                    Só aparece quando há algo útil para explicar
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                {discoveries.length}
              </span>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-700/60">
              {discoveries.map((discovery) => {
                const critical = discovery.tone === 'critical'
                const warning = discovery.tone === 'warning'
                const stable = discovery.tone === 'stable'

                return (
                  <div key={discovery.id} className="flex gap-3 px-3.5 py-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${
                      critical
                        ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                        : warning
                          ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'
                          : stable
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400'
                    }`}>
                      {critical || warning
                        ? <AlertTriangle size={14} />
                        : stable
                          ? <SearchCheck size={14} />
                          : <Sparkles size={14} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200">
                        {discovery.title}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-4 text-gray-500 dark:text-gray-400">
                        {discovery.message}
                      </p>
                      <p className="mt-1 text-[9px] leading-4 text-gray-400">
                        {discovery.evidence}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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

          <button
            type="button"
            onClick={() => setOpenExplanation((value) => !value)}
            className="mt-3 flex w-full items-center justify-between border-t border-gray-100 pt-3 text-left dark:border-slate-700/60"
          >
            <span className="flex items-center gap-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              <Info size={13} />
              Como chegamos nesses valores?
            </span>
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform ${openExplanation ? 'rotate-180' : ''}`}
            />
          </button>

          {openExplanation && (
            <div className="mt-3 space-y-2 rounded-[13px] bg-gray-50 p-3 text-[9.5px] leading-4 text-gray-500 dark:bg-slate-900/50 dark:text-gray-400">
              <p>
                <strong className="text-gray-700 dark:text-gray-300">Conhecido:</strong>{' '}
                {brl(plan.committedPayables)} a pagar e {brl(plan.probableReceivables)} a receber já cadastrados neste mês.
              </p>
              <p>
                <strong className="text-gray-700 dark:text-gray-300">Estimado:</strong>{' '}
                {brl(plan.estimatedRemainingExpense)} de despesas e {brl(plan.estimatedRemainingIncome)} de receitas ainda inferidas pelo ritmo atual.
              </p>
              <p>
                <strong className="text-gray-700 dark:text-gray-300">Confiança:</strong>{' '}
                {confidenceLabel[plan.confidence]}, usando {plan.sampleSize} lançamento(s). Conhecido e estimado nunca são apresentados como a mesma coisa.
              </p>
            </div>
          )}
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
          onClick={() => setOpenTimeline((value) => !value)}
          className={`mt-3 flex w-full items-center justify-between rounded-[15px] border px-3.5 py-3 text-left ${
            timeline.firstRiskDate
              ? 'border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-500/5'
              : 'border-gray-200 bg-gray-50/70 dark:border-slate-700 dark:bg-slate-900/30'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <CalendarDays
              size={16}
              className={timeline.firstRiskDate ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}
            />
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold ${
                timeline.firstRiskDate
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                Linha do tempo conhecida · 30 dias
              </p>
              <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">
                {timeline.firstRiskDate
                  ? `Risco conhecido em ${formatDate(timeline.firstRiskDate)}`
                  : `${timeline.days.length} dia(s) com movimentações cadastradas`}
              </p>
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`shrink-0 text-gray-400 transition-transform ${openTimeline ? 'rotate-180' : ''}`}
          />
        </button>

        {openTimeline && (
          <div className="mt-2 overflow-hidden rounded-[16px] border border-gray-200/70 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-2 border-b border-gray-100 p-3 dark:border-slate-700/60">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                  Entradas conhecidas
                </p>
                <p className="mt-1 text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                  {brl(timeline.knownIncome)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                  Saídas conhecidas
                </p>
                <p className="mt-1 text-[12px] font-bold text-red-500 dark:text-red-400">
                  {brl(timeline.knownExpense)}
                </p>
              </div>
            </div>

            {timelinePreview.length === 0 ? (
              <p className="px-3.5 py-4 text-[10px] leading-4 text-gray-400">
                Nenhum compromisso com data conhecida nos próximos 30 dias.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-700/60">
                {timelinePreview.map((day) => (
                  <div key={day.date} className="flex items-center gap-3 px-3.5 py-3">
                    <div className="w-[58px] shrink-0">
                      <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                        {formatDate(day.date).slice(0, 5)}
                      </p>
                      <p className="text-[8.5px] text-gray-400">
                        {day.events} evento{day.events === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] font-bold ${
                        day.net < 0
                          ? 'text-red-500 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {day.net >= 0 ? '+' : ''}{brl(day.net)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[8.5px] text-gray-400">saldo após</p>
                      <p className={`text-[10px] font-bold ${
                        day.projectedCash < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {brl(day.projectedCash)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {timeline.days.length > timelinePreview.length && (
              <p className="border-t border-gray-100 px-3.5 py-2.5 text-[9px] text-gray-400 dark:border-slate-700/60">
                + {timeline.days.length - timelinePreview.length} dia(s) com eventos conhecidos no horizonte.
              </p>
            )}
          </div>
        )}

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
