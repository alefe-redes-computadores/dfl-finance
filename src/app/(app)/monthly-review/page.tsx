'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, CalendarDays, ClipboardCheck,
  CreditCard, TrendingDown, TrendingUp, ShieldCheck,
  Wallet, AlertTriangle, ChartNoAxesColumnIncreasing
} from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import {
  buildMonthlyReview,
  type MonthlyRow,
  type MonthlyCategory
} from '@/lib/financeMonthlyReview'

const brl = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  })

const civilToday = () => {
  const date = new Date()
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

const monthLabel = (value: string) => {
  const [y, m] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1, 12))
    .toLocaleDateString('pt-BR', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    })
}

const panel =
  'rounded-[24px] border border-black/5 bg-white p-4 shadow-sm ' +
  'dark:border-white/10 dark:bg-slate-900'

function Metric({
  title, value, subtitle, color = ''
}: {
  title: string
  value: string
  subtitle: string
  color?: string
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p className={`mt-2 break-words text-[18px] font-bold tabular-nums ${color || 'text-slate-900 dark:text-white'}`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-slate-500">{subtitle}</p>
    </div>
  )
}

export default function MonthlyReviewPage() {
  const router = useRouter()
  const { effectiveContext } = useContext_()
  const today = civilToday()
  const currentMonth = today.slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  const month = selectedMonth > currentMonth
    ? currentMonth : selectedMonth

  const tx = useLocalData({
    table: 'transactions',
    filters: { context: effectiveContext }
  })
  const categories = useLocalData({
    table: 'categories',
    filters: { context: effectiveContext }
  })

  const data = useMemo(() => buildMonthlyReview(
    (tx.data || []) as MonthlyRow[],
    (categories.data || []) as MonthlyCategory[],
    effectiveContext,
    month,
    today
  ), [tx.data, categories.data, effectiveContext, month, today])

  const maximum = Math.max(
    1,
    ...data.history.map(item => Math.max(item.income, item.expense))
  )

  const comparison = (value: number | null) =>
    value === null ? 'Sem base comparável' :
      `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`

  const loading = tx.loading || categories.loading

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-4 bg-gray-50 px-4 pb-32 pt-4 dark:bg-slate-950">
      <header className="flex items-center gap-3">
        <button type="button"
          onClick={() => router.push('/more')}
          aria-label="Voltar"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 dark:bg-slate-900 dark:text-white">
          <ArrowLeft size={19}/>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
            Inteligência financeira · V175
          </p>
          <h1 className="text-[19px] font-bold text-slate-950 dark:text-white">
            Revisão Mensal
          </h1>
        </div>
        <ShieldCheck className="text-teal-600" size={21}/>
      </header>

      <ContextToggle />

      <section className={panel}>
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-teal-600"/>
          <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
            Período de análise
          </h2>
        </div>
        <input
          aria-label="Mês da revisão"
          type="month"
          value={month}
          max={currentMonth}
          onChange={e => {
            if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value) &&
                e.target.value <= currentMonth) {
              setSelectedMonth(e.target.value)
            }
          }}
          className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[14px] font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          {data.closed
            ? 'Mês civil encerrado. Fechamento consultivo, sem lançamento contábil.'
            : `Mês em andamento · realizado até ${data.cutoff.split('-').reverse().join('/')}.`}
        </p>
      </section>

      {loading && (
        <p role="status" className="text-[12px] text-slate-500">
          Conferindo os dados financeiros locais…
        </p>
      )}

      {!loading && (
        <>
          <section className={panel}>
            <div className="mb-3 flex items-center gap-2">
              <Wallet size={19} className="text-teal-600"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Resultado econômico do mês
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric title="Recebido" value={brl(data.income)}
                subtitle="Receitas efetivamente realizadas"
                color="text-emerald-700 dark:text-emerald-400"/>
              <Metric title="Gasto econômico" value={brl(data.expense)}
                subtitle="Compra reconhecida uma única vez"
                color="text-rose-600 dark:text-rose-400"/>
              <Metric title="Compras no cartão" value={brl(data.cardExpense)}
                subtitle="Já incluídas no gasto econômico"/>
              <Metric title="Demais gastos" value={brl(data.cashExpense)}
                subtitle="Sem pagamentos duplicados de fatura"/>
            </div>
            <div className="mt-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
              <p className="text-[11px] text-slate-500">
                Resultado econômico simplificado
              </p>
              <p className={`mt-1 text-[24px] font-black tabular-nums ${
                data.result < 0
                  ? 'text-rose-600'
                  : 'text-teal-700 dark:text-teal-300'
              }`}>
                {brl(data.result)}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                {data.economicCount} registros considerados.
                Não representa o saldo disponível nas contas.
              </p>
            </div>
          </section>

          <section className={panel}>
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
              Comparação justa
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              {data.closed
                ? `Comparação de meses completos: ${monthLabel(month)} e ${monthLabel(data.comparisonMonth)}.`
                : `Comparação até o mesmo dia civil de ${monthLabel(data.comparisonMonth)}, limitado à duração daquele mês.`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric title="Receitas anteriores"
                value={brl(data.comparableIncome)}
                subtitle={`Variação: ${comparison(data.incomeVariation)}`}/>
              <Metric title="Despesas anteriores"
                value={brl(data.comparableExpense)}
                subtitle={`Variação: ${comparison(data.expenseVariation)}`}/>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Variação indisponível quando a base anterior é zero.
            </p>
          </section>

          <section className={panel}>
            <div className="flex items-center gap-2">
              <ChartNoAxesColumnIncreasing size={19} className="text-teal-600"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Evolução dos últimos seis meses
              </h2>
            </div>
            <div className="mt-4 space-y-4">
              {data.history.map(item => (
                <div key={item.month}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      {monthLabel(item.month)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {brl(item.result)} líquido
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, item.income / maximum * 100)}%` }}/>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-rose-500"
                        style={{ width: `${Math.min(100, item.expense / maximum * 100)}%` }}/>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Recebido {brl(item.income)} · Gasto {brl(item.expense)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-500">
              Verde: receitas realizadas. Vermelho: despesas econômicas.
              Meses sem registros aparecem zerados, não como movimentações confirmadas.
            </p>
          </section>

          <section className={panel}>
            <div className="flex items-center gap-2">
              <TrendingDown size={19} className="text-rose-500"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Categorias com maior impacto
              </h2>
            </div>
            {data.categories.length === 0 ? (
              <p className="mt-4 text-[12px] text-slate-500">
                Nenhum gasto econômico classificado neste período.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {data.categories.map(cat => (
                  <div key={cat.id}>
                    <div className="flex justify-between gap-2 text-[12px]">
                      <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-white">
                        {cat.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                        {brl(cat.amount)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-teal-500"
                        style={{ width: `${cat.percent}%` }}/>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {cat.percent.toFixed(1).replace('.', ',')}% dos gastos · {cat.count} lançamento(s)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={panel}>
            <div className="flex items-center gap-2">
              <ClipboardCheck size={19} className="text-amber-500"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Qualidade do fechamento
              </h2>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric title="Pendências" value={String(data.pendingCount)}
                subtitle={brl(data.pendingAmount) + ' ainda não realizado'}/>
              <Metric title="Sem categoria" value={String(data.missingCategories)}
                subtitle="Registros econômicos do mês"/>
              <Metric title="Sem conta/cartão" value={String(data.missingAccounts)}
                subtitle="Exigem conferência"/>
              <Metric title="Importações" value={String(data.importsToReview)}
                subtitle="Pendentes de revisão"/>
            </div>
            {data.alerts.length > 0 && (
              <div className="mt-3 space-y-2">
                {data.alerts.map(alert => (
                  <p key={alert}
                    className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0"/>
                    {alert}
                  </p>
                ))}
              </div>
            )}
          </section>

          <section className={panel}>
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
              Próximas ações
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => router.push('/review')}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 p-3 text-[11px] font-bold text-white">
                <ClipboardCheck size={17}/> Revisar dados
              </button>
              <button type="button"
                onClick={() => router.push('/conciliation')}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:text-white">
                <CreditCard size={17}/> Conciliação
              </button>
              <button type="button"
                onClick={() => router.push('/planning')}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:text-white">
                <TrendingUp size={17}/> Planejamento
              </button>
              <button type="button"
                onClick={() => router.push('/cash-pressure')}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:text-white">
                <ArrowRight size={17}/> Radar de Fôlego
              </button>
            </div>
          </section>

          <p className="px-2 text-center text-[10px] leading-5 text-slate-500">
            Revisão consultiva e reversível pela seleção de período.
            Nenhum saldo, lançamento, fatura ou conta é alterado.
            A ausência de alertas não equivale à conciliação bancária.
          </p>
        </>
      )}
    </main>
  )
}
