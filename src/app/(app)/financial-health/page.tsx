'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Activity, ShieldCheck,
  AlertCircle, CheckCircle2, CircleHelp,
  ClipboardCheck, CalendarDays
} from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { buildFinanceHealth } from '@/lib/financeHealth'
import type {
  MonthlyRow,
  MonthlyCategory
} from '@/lib/financeMonthlyReview'

const todayCivil = () => {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-')
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  })

const panel =
  'rounded-[23px] border border-slate-200/70 bg-white p-4 ' +
  'dark:border-slate-800 dark:bg-slate-900'

const levelStyle = {
  attention: 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10',
  observe: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10',
  stable: 'text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-500/10',
  unknown: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800'
}

const levelLabel = {
  attention: 'Merece atenção',
  observe: 'Conferir',
  stable: 'Sem alerta neste indicador',
  unknown: 'Dados insuficientes'
}

export default function FinancialHealthPage() {
  const router = useRouter()
  const { effectiveContext } = useContext_()

  const transactions = useLocalData({
    table: 'transactions',
    filters: { context: effectiveContext }
  })
  const categories = useLocalData({
    table: 'categories',
    filters: { context: effectiveContext }
  })

  const date = todayCivil()
  const health = useMemo(() => buildFinanceHealth(
    (transactions.data || []) as MonthlyRow[],
    (categories.data || []) as MonthlyCategory[],
    effectiveContext,
    date
  ), [
    transactions.data,
    categories.data,
    effectiveContext,
    date
  ])

  const loading = transactions.loading || categories.loading
  const attention = health.signals.filter(
    s => s.level === 'attention'
  ).length

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
            Inteligência financeira · V176
          </p>
          <h1 className="text-[19px] font-black text-slate-950 dark:text-white">
            Saúde Financeira
          </h1>
        </div>
        <Activity className="text-teal-600" size={22}/>
      </header>

      <ContextToggle/>

      {loading ? (
        <section role="status" className={panel}>
          <p className="text-[12px] text-slate-500">
            Analisando movimentações do contexto selecionado…
          </p>
        </section>
      ) : (
        <>
          <section className={panel}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={19} className="text-teal-600"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Panorama do mês
              </h2>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-slate-600 dark:text-slate-300">
              {attention > 0
                ? `${attention} indicador(es) merecem atenção. Confira os dados antes de tomar decisões.`
                : health.evidenceCount === 0
                  ? 'Ainda não há movimentações realizadas suficientes para avaliar este mês.'
                  : 'Nenhum indicador foi classificado como atenção imediata pelos critérios atuais. Isso não garante ausência de riscos.'}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[11px] text-slate-500">Recebido</p>
                <p className="mt-1 break-words text-[17px] font-bold text-emerald-700 dark:text-emerald-400">
                  {brl(health.monthly.income)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[11px] text-slate-500">Gasto econômico</p>
                <p className="mt-1 break-words text-[17px] font-bold text-rose-600 dark:text-rose-400">
                  {brl(health.monthly.expense)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[11px] text-slate-500">Registros observados</p>
                <p className="mt-1 text-[18px] font-bold text-slate-900 dark:text-white">
                  {health.evidenceCount}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[11px] text-slate-500">Histórico anterior</p>
                <p className="mt-1 text-[18px] font-bold text-slate-900 dark:text-white">
                  {health.historyMonths} de 5 meses
                </p>
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-5 text-slate-500">
              Comparações econômicas, não um extrato bancário nem um score de crédito.
              Compras no cartão são reconhecidas na compra, sem repetir a fatura.
            </p>
          </section>

          <section className={panel}>
            <div className="flex items-center gap-2">
              <Activity size={19} className="text-teal-600"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Diagnósticos e prioridades
              </h2>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Ordenados pela prioridade do sinal detectado, com critérios visíveis.
            </p>
            <div className="mt-3 space-y-2">
              {health.signals.map(signal => (
                <article key={signal.id}
                  className="rounded-2xl border border-slate-100 p-3 dark:border-slate-700">
                  <div className="flex items-start gap-2">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${levelStyle[signal.level]}`}>
                      {signal.level === 'stable'
                        ? <CheckCircle2 size={17}/>
                        : signal.level === 'unknown'
                          ? <CircleHelp size={17}/>
                          : <AlertCircle size={17}/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500">
                        {levelLabel[signal.level]}
                      </p>
                      <h3 className="mt-0.5 text-[13px] font-bold text-slate-900 dark:text-white">
                        {signal.title}
                      </h3>
                      <p className="mt-1 break-words text-[21px] font-black tabular-nums text-slate-900 dark:text-white">
                        {signal.value}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                        {signal.evidence}
                      </p>
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => router.push(signal.href)}
                    className="mt-3 flex min-h-10 w-full items-center justify-between rounded-xl bg-slate-50 px-3 text-[11px] font-bold text-teal-700 dark:bg-slate-800 dark:text-teal-300">
                    Conferir informações
                    <ArrowRight size={15}/>
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className={panel}>
            <div className="flex items-center gap-2">
              <CircleHelp size={18} className="text-slate-500"/>
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                Limites da análise
              </h2>
            </div>
            <div className="mt-3 space-y-2">
              {health.limitations.map(item => (
                <p key={item} className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                  • {item}
                </p>
              ))}
            </div>
          </section>

          <section className={panel}>
            <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
              Ferramentas para aprofundar
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: 'Revisão mensal', href: '/monthly-review' },
                { label: 'Radar de Fôlego', href: '/cash-pressure' },
                { label: 'Planejamento', href: '/planning' },
                { label: 'Conciliação', href: '/conciliation' }
              ].map(link => (
                <button key={link.href}
                  type="button"
                  onClick={() => router.push(link.href)}
                  className="flex min-h-12 items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  {link.label}
                  {link.href === '/monthly-review'
                    ? <CalendarDays size={15}/>
                    : link.href === '/conciliation'
                      ? <ClipboardCheck size={15}/>
                      : <ArrowRight size={15}/>}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
