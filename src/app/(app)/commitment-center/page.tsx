'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CalendarDays, ShieldCheck,
  AlertTriangle, ArrowRight, Wallet,
  Clock3, CircleDollarSign
} from 'lucide-react'
import ContextToggle, {
  useContext_
} from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { buildFinanceAgenda } from '@/lib/financeAgenda'
import { buildFinancePressure } from '@/lib/financePressure'
import { buildCommitmentCenter } from '@/lib/financeCommitmentCenter'

const brl = (n: number | null) =>
  n === null
    ? 'Não calculável'
    : n.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      })

const todayCivil = () => {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-')
}

const panel =
  'rounded-[23px] border border-slate-200/70 ' +
  'bg-white p-4 dark:border-slate-800 dark:bg-slate-900'

function Metric({
  label, value, note
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-[17px] font-bold tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-slate-500">
        {note}
      </p>
    </div>
  )
}

export default function CommitmentCenterPage() {
  const router = useRouter()
  const { effectiveContext } = useContext_()
  const context = effectiveContext === 'dfl' ? 'dfl' : 'personal'

  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [today, setToday] = useState(todayCivil)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const refresh = () => setToday(todayCivil())
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  const tx = useLocalData({
    table: 'transactions',
    filters: { context }
  })
  const accounts = useLocalData({
    table: 'accounts',
    filters: { context }
  })
  const debts = useLocalData({
    table: 'debts',
    filters: { context }
  })
  const loans = useLocalData({
    table: 'loans',
    filters: { context }
  })
  const financings = useLocalData({
    table: 'financings',
    filters: { context }
  })
  const subscriptions = useLocalData({
    table: 'subscriptions',
    filters: { context }
  })
  const cards = useLocalData({
    table: 'credit_cards',
    filters: { context }
  })
  const invoices = useLocalData({
    table: 'credit_invoices',
    filters: { context }
  })

  const loading = [
    tx, accounts, debts, loans, financings,
    subscriptions, cards, invoices
  ].some(x => x.loading)

  const now = useMemo(() => new Date(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
    12
  ), [today])

  const agenda = useMemo(() => buildFinanceAgenda({
    context,
    transactions: tx.data || [],
    sources: {
      debts: debts.data || [],
      loans: loans.data || [],
      financings: financings.data || [],
      subscriptions: subscriptions.data || [],
      creditCards: cards.data || [],
      creditInvoices: invoices.data || []
    },
    horizonDays: days,
    now
  }), [
    context, tx.data, debts.data, loans.data,
    financings.data, subscriptions.data,
    cards.data, invoices.data, days, now
  ])

  const pressure = useMemo(() => buildFinancePressure({
    context,
    today,
    days,
    accounts: accounts.data || [],
    agenda: agenda.items
  }), [context, today, days, accounts.data, agenda.items])

  const report = useMemo(() => buildCommitmentCenter(
    agenda, pressure
  ), [agenda, pressure])

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-4 bg-slate-50 px-4 pb-32 pt-4 dark:bg-slate-950">
      <header className="flex items-center gap-3">
        <button type="button"
          onClick={() => router.push('/more')}
          aria-label="Voltar"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 dark:bg-slate-900 dark:text-white">
          <ArrowLeft size={19}/>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
            Inteligência financeira · V178
          </p>
          <h1 className="text-[19px] font-black text-slate-950 dark:text-white">
            Compromissos e Caixa
          </h1>
        </div>
        <ShieldCheck size={20} className="text-teal-600"/>
      </header>

      <ContextToggle/>

      <section className={panel}>
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-teal-600"/>
          <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
            Horizonte de análise
          </h2>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([7, 30, 90] as const).map(n => (
            <button key={n}
              type="button"
              aria-pressed={days === n}
              onClick={() => setDays(n)}
              className={`min-h-11 rounded-2xl text-[12px] font-bold ${
                days === n
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}>
              {n} dias
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Posição estimada entre {report.today} e {report.end}.
          Compromissos vencidos permanecem visíveis.
        </p>
      </section>

      {loading ? (
        <section role="status" className={panel}>
          <p className="text-[12px] text-slate-500">
            Conferindo obrigações e contas locais…
          </p>
        </section>
      ) : (
        <>
          <section className={panel}>
            <div className="mb-3 flex items-center gap-2">
              <Wallet size={19} className="text-teal-600"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Estabilidade do caixa
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric
                label="Saldos atuais conhecidos"
                value={brl(report.openingBalance)}
                note="Contas ativas válidas"
              />
              <Metric
                label="Fim conservador"
                value={brl(report.endConservative)}
                note="Sem antecipar recebíveis"
              />
              <Metric
                label="Menor posição"
                value={brl(report.worstConservative)}
                note="Pior ponto do horizonte"
              />
              <Metric
                label="Com recebíveis"
                value={brl(report.endWithReceipts)}
                note="Cenário hipotético, não garantido"
              />
            </div>
            {report.firstNegativeDate && (
              <p className="mt-3 rounded-xl bg-rose-50 p-3 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                Possível insuficiência de caixa a partir de {report.firstNegativeDate}.
              </p>
            )}
            <p className="mt-3 text-[10px] leading-5 text-slate-500">
              Cenário herdado do Radar V174. Não inclui automaticamente
              gastos flexíveis futuros, novas reservas ou assinaturas apenas planejadas.
              Nenhum saldo foi alterado.
            </p>
          </section>

          <section className={panel}>
            <div className="flex items-center gap-2">
              <CircleDollarSign size={19} className="text-teal-600"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Obrigações e recebíveis
              </h2>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric
                label="Despesas conhecidas"
                value={brl(report.knownExpense)}
                note="Inclui vencidas e futuras no horizonte"
              />
              <Metric
                label="Recebíveis potenciais"
                value={brl(report.possibleIncome)}
                note="Não são receitas recebidas"
              />
              <Metric
                label="Obrigações vencidas"
                value={brl(report.overdueExpense)}
                note="Permanecem na análise"
              />
              <Metric
                label="Assinaturas planejadas"
                value={brl(report.planningExpense)}
                note="Separadas para evitar dupla contagem"
              />
            </div>
          </section>

          <section className={panel}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={19} className="text-amber-500"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Prioridades identificadas
              </h2>
            </div>
            {report.priorities.length === 0 ? (
              <p className="mt-3 text-[12px] text-slate-500">
                Nenhuma prioridade identificada pelos critérios atuais.
                Isso não substitui a conferência dos extratos.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {report.priorities.map(item => (
                  <article key={item.id}
                    className="rounded-2xl border border-slate-100 p-3 dark:border-slate-700">
                    <p className={`text-[10px] font-bold ${
                      item.level === 'critical'
                        ? 'text-rose-600'
                        : item.level === 'warning'
                          ? 'text-amber-600'
                          : 'text-teal-600'
                    }`}>
                      {item.level === 'critical'
                        ? 'Prioridade alta'
                        : item.level === 'warning'
                          ? 'Acompanhar'
                          : 'Informativo'}
                    </p>
                    <p className="mt-1 text-[13px] font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                      {item.detail}
                    </p>
                    <button type="button"
                      onClick={() => router.push(item.href)}
                      className="mt-3 flex min-h-10 w-full items-center justify-between rounded-xl bg-slate-50 px-3 text-[11px] font-bold text-teal-700 dark:bg-slate-800 dark:text-teal-300">
                      Conferir origem
                      <ArrowRight size={15}/>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={panel}>
            <div className="flex items-center gap-2">
              <Clock3 size={19} className="text-teal-600"/>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                Calendário de compromissos
              </h2>
            </div>
            <div className="mt-3 space-y-3">
              {report.buckets.filter(
                b => b.count > 0
              ).map(bucket => (
                <div key={bucket.id}
                  className="rounded-2xl border border-slate-100 p-3 dark:border-slate-700">
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white">
                    {bucket.label}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    A pagar: {brl(bucket.expense)} · A receber: {brl(bucket.income)}
                  </p>
                  {(expanded
                    ? bucket.items
                    : bucket.items.slice(0, 5)
                  ).map(item => (
                    <button key={item.id} type="button"
                      onClick={() => router.push(item.href)}
                      className="mt-2 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 text-left dark:bg-slate-800">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                          {item.label}
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          {item.date}
                        </span>
                      </span>
                      <span className={`shrink-0 text-[11px] font-bold ${
                        item.direction === 'expense'
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}>
                        {brl(item.amount)}
                      </span>
                    </button>
                  ))}
                  {!expanded && bucket.items.length > 5 && (
                    <p className="mt-2 text-[10px] text-slate-500">
                      Mais {bucket.items.length - 5} evento(s) neste grupo.
                    </p>
                  )}
                </div>
              ))}
              {report.knownCount === 0 && (
                <p className="text-[12px] text-slate-500">
                  Nenhum compromisso conhecido encontrado neste horizonte.
                </p>
              )}
            </div>
            {report.knownCount > 5 && (
              <button type="button"
                onClick={() => setExpanded(v => !v)}
                className="mt-4 w-full rounded-xl border border-slate-200 py-3 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:text-white">
                {expanded ? 'Mostrar resumo' : 'Mostrar todos os eventos'}
              </button>
            )}
          </section>

          {report.warnings.length > 0 && (
            <section className={panel}>
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                Limites dos dados
              </h2>
              {report.warnings.map(warning => (
                <p key={warning} className="mt-2 text-[11px] leading-5 text-slate-500">
                  • {warning}
                </p>
              ))}
            </section>
          )}

          <section className={panel}>
            <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
              Aprofundar análise
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ['Agenda 360', '/agenda'],
                ['Radar de Fôlego', '/cash-pressure'],
                ['Saúde Financeira', '/financial-health'],
                ['Tendências', '/financial-trends'],
                ['Revisão Mensal', '/monthly-review'],
                ['Planejamento', '/planning']
              ].map(([label, href]) => (
                <button key={href} type="button"
                  onClick={() => router.push(href)}
                  className="flex min-h-12 items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-white">
                  {label}
                  <ArrowRight size={14}/>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
