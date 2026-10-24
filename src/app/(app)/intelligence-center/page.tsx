'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowUpRight, BrainCircuit,
  Activity, ClipboardCheck, CalendarClock,
  PiggyBank, Search, ShieldCheck
} from 'lucide-react'
import ContextToggle from '@/components/ContextToggle'
import {
  intelligenceGroups,
  type IntelligenceGroupId
} from '@/lib/financeIntelligenceNavigation'

type Filter = 'all' | IntelligenceGroupId

const filters: {
  id: Filter
  label: string
}[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'understand', label: 'Entender' },
  { id: 'review', label: 'Conferir' },
  { id: 'anticipate', label: 'Antecipar' },
  { id: 'plan', label: 'Planejar' }
]

const icons = {
  understand: Activity,
  review: ClipboardCheck,
  anticipate: CalendarClock,
  plan: PiggyBank
}

const tones = {
  understand: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  review: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  anticipate: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  plan: 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
}

const surface =
  'rounded-[24px] border border-slate-200/80 bg-white p-4 ' +
  'dark:border-slate-800 dark:bg-slate-900'

export default function IntelligenceCenterPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('pt-BR')
    return intelligenceGroups
      .filter(group => filter === 'all' || group.id === filter)
      .map(group => ({
        ...group,
        links: group.links.filter(link => {
          if (!search) return true
          const haystack = [
            group.title,
            link.title,
            link.description,
            link.tag
          ].join(' ').toLocaleLowerCase('pt-BR')
          return haystack.includes(search)
        })
      }))
      .filter(group => group.links.length > 0)
  }, [filter, query])

  const total = groups.reduce(
    (sum, group) => sum + group.links.length,
    0
  )

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-4 bg-slate-50 px-4 pb-32 pt-4 dark:bg-slate-950">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Voltar para Mais"
          onClick={() => router.push('/more')}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 dark:bg-slate-900 dark:text-white"
        >
          <ArrowLeft size={19}/>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
            DFL Finance · V179
          </p>
          <h1 className="text-[20px] font-black tracking-tight text-slate-950 dark:text-white">
            Inteligência Financeira
          </h1>
        </div>
        <BrainCircuit size={23} className="text-teal-600"/>
      </header>

      <ContextToggle/>

      <section className="rounded-[24px] bg-slate-950 p-5 text-white dark:border dark:border-slate-800">
        <div className="flex items-center gap-2">
          <BrainCircuit size={21} className="text-teal-300"/>
          <p className="text-[11px] font-semibold text-teal-200">
            Seu centro de decisões
          </p>
        </div>
        <h2 className="mt-3 text-[22px] font-black leading-tight">
          Entenda. Confira. Antecipe. Planeje.
        </h2>
        <p className="mt-3 text-[12px] leading-5 text-slate-300">
          Todas as ferramentas de inteligência em um só lugar,
          sem misturar planejamento, resultado econômico e saldo bancário.
        </p>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-slate-300">
          <ShieldCheck size={15} className="text-teal-300"/>
          Esta central não modifica transações ou saldos.
        </div>
      </section>

      <section className={surface}>
        <label htmlFor="intelligence-search"
          className="text-[12px] font-bold text-slate-900 dark:text-white">
          Encontrar uma ferramenta
        </label>
        <div className="mt-3 flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800">
          <Search size={17} className="shrink-0 text-slate-400"/>
          <input
            id="intelligence-search"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ex.: revisão, cartão, reservas..."
            className="min-w-0 flex-1 bg-transparent py-3 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />
        </div>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
          {filters.map(item => (
            <button
              type="button"
              key={item.id}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-[11px] font-bold ${
                filter === item.id
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          {total} ferramenta(s) disponíveis neste filtro.
        </p>
      </section>

      {groups.length === 0 && (
        <section className={surface}>
          <p className="text-center text-[12px] text-slate-500">
            Nenhuma ferramenta encontrada. Tente outro termo ou filtro.
          </p>
        </section>
      )}

      {groups.map(group => {
        const Icon = icons[group.id]
        return (
          <section className={surface} key={group.id}>
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tones[group.id]}`}>
                <Icon size={21}/>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                  {group.title}
                </h2>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {group.description}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {group.links.map(link => (
                <Link
                  key={link.id}
                  href={link.href}
                  prefetch={false}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 transition-colors active:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold text-slate-900 dark:text-white">
                        {link.title}
                      </span>
                      <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                        {link.tag}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                      {link.description}
                    </p>
                  </div>
                  <ArrowUpRight size={17} className="shrink-0 text-teal-600"/>
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      <p className="px-2 text-center text-[10px] leading-5 text-slate-500">
        Os dados são consultados por cada ferramenta quando ela é aberta.
        Esta central não carrega o histórico financeiro nem executa
        cálculos de saldo ou sincronizações adicionais.
      </p>
    </main>
  )
}
