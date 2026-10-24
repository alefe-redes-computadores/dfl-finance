'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Activity, ArrowRight,
  BarChart3, ShieldCheck, CalendarDays
} from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { buildFinanceTrends } from '@/lib/financeTrends'
import type {
  MonthlyRow,
  MonthlyCategory
} from '@/lib/financeMonthlyReview'

const todayCivil = () => {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-')
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })

const labelMonth = (s: string) => {
  const [y, m] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1, 12))
    .toLocaleDateString('pt-BR', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    })
}

const panel =
  'rounded-[23px] border border-slate-200/70 bg-white p-4 ' +
  'dark:border-slate-800 dark:bg-slate-900'

const tones = {
  attention: 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10',
  observe: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10',
  stable: 'text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-500/10',
  unknown: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800'
}

const descriptions = {
  attention: 'Atenção',
  observe: 'Acompanhar',
  stable: 'Sem alerta neste critério',
  unknown: 'Evidência limitada'
}

export default function FinancialTrendsPage() {
  const router = useRouter()
  const { effectiveContext } = useContext_()

  const tx = useLocalData({
    table: 'transactions',
    filters: { context: effectiveContext }
  })

  const categories = useLocalData({
    table: 'categories',
    filters: { context: effectiveContext }
  })

  const today = todayCivil()

  const result = useMemo(() => buildFinanceTrends(
    (tx.data || []) as MonthlyRow[],
    (categories.data || []) as MonthlyCategory[],
    effectiveContext,
    today
  ), [tx.data, categories.data, effectiveContext, today])

  const loading = tx.loading || categories.loading

  const maximum = Math.max(
    1,
    ...result.completeHistory.map(x => Math.max(x.income, x.expense))
  )

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-4 bg-slate-50 px-4 pb-32 pt-4 dark:bg-slate-950">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => router.push('/more')}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <ArrowLeft size={19}/>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
            Inteligência financeira · V177
          </p>
          <h1 className="text-[19px] font-black text-slate-950 dark:text-white">
            Tendências Financeiras
          </h1>
        </div>
        <Activity size={22} className="text-teal-600"/>
      </header>

      <ContextToggle/>

      {loading ? (
        <section className={panel} role="status">
          <p className="text-[12px] text-slate-500">
            Analisando o histórico local…
          </p>
        </section>
      ) : (
        <>
          <section className={panel}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={19} className="text-teal-600"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Confiança do histórico
              </h2>
            </div>
            <p className="mt-3 text-[26px] font-black text-slate-900 dark:text-white">
              {result.monthsWithRecords}/6
            </p>
            <p className="text-[12px] leading-5 text-slate-500">
              Meses anteriores com movimentações observadas.
              Essa medida representa cobertura dos registros,
              não qualidade financeira.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[11px] text-slate-500">
                  Média de receitas observadas
                </p>
                <p className="mt-2 break-words text-[17px] font-bold text-emerald-700 dark:text-emerald-400">
                  {result.incomeAverage === null
                    ? 'Sem base'
                    : brl(result.incomeAverage)}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Apenas meses com recebimentos
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[11px] text-slate-500">
                  Média de despesas observadas
                </p>
                <p className="mt-2 break-words text-[17px] font-bold text-rose-600 dark:text-rose-400">
                  {result.expenseAverage === null
                    ? 'Sem base'
                    : brl(result.expenseAverage)}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Apenas meses com gastos
                </p>
              </div>
            </div>
          </section>

          <section className={panel}>
            <div className="flex items-center gap-2">
              <BarChart3 size={19} className="text-teal-600"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Seis meses completos
              </h2>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Verde: recebimentos. Vermelho: despesas econômicas.
              O mês em andamento não entra neste gráfico.
            </p>
            <div className="mt-4 space-y-4">
              {result.completeHistory.map(item => (
                <div key={item.month}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-bold text-slate-800 dark:text-white">
                      {labelMonth(item.month)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {item.count} registros
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${item.income / maximum * 100}%`
                        }}
                      />
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-rose-500"
                        style={{
                          width: `${item.expense / maximum * 100}%`
                        }}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {brl(item.income)} recebidos · {brl(item.expense)} gastos
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className={panel}>
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
              Leituras inteligentes
            </h2>
            <div className="mt-3 space-y-3">
              {result.signals.map(signal => (
                <article
                  key={signal.id}
                  className="rounded-2xl border border-slate-100 p-3 dark:border-slate-700"
                >
                  <span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-bold ${tones[signal.level]}`}>
                    {descriptions[signal.level]}
                  </span>
                  <h3 className="mt-2 text-[13px] font-bold text-slate-900 dark:text-white">
                    {signal.title}
                  </h3>
                  <p className="mt-1 break-words text-[20px] font-black text-slate-900 dark:text-white">
                    {signal.value}
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                    {signal.detail}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push(signal.href)}
                    className="mt-3 flex min-h-10 w-full items-center justify-between rounded-xl bg-slate-50 px-3 text-[11px] font-bold text-teal-700 dark:bg-slate-800 dark:text-teal-300"
                  >
                    Conferir origem
                    <ArrowRight size={15}/>
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className={panel}>
            <div className="flex items-center gap-2">
              <CalendarDays size={17} className="text-slate-500"/>
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                Como interpretar
              </h2>
            </div>
            <div className="mt-3 space-y-2">
              {result.limitations.map(line => (
                <p key={line} className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                  • {line}
                </p>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => router.push('/monthly-review')}
                className="rounded-xl bg-teal-700 px-3 py-3 text-[11px] font-bold text-white">
                Revisão mensal
              </button>
              <button type="button"
                onClick={() => router.push('/financial-health')}
                className="rounded-xl border border-slate-200 px-3 py-3 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:text-white">
                Saúde financeira
              </button>
              <button type="button"
                onClick={() => router.push('/planning')}
                className="rounded-xl border border-slate-200 px-3 py-3 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:text-white">
                Planejamento
              </button>
              <button type="button"
                onClick={() => router.push('/cash-pressure')}
                className="rounded-xl border border-slate-200 px-3 py-3 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:text-white">
                Radar de Fôlego
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
