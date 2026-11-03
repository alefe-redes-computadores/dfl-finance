'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUpRight, BarChart3, CalendarDays, LoaderCircle, MessageSquareText, SearchCheck, ShieldCheck } from 'lucide-react'
import { db } from '@/lib/db'
import {
  answerScopedFinancialQuestion,
  type ScopedFinancialQuestion,
  type ScopedFinancialContext,
} from '@/lib/financialScopedQuestions'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
type Props = {
  question: ScopedFinancialQuestion
  userId: string | null
  context: ScopedFinancialContext
  onTalk: () => void
}

/** Só dados locais do usuario/contexto, sem rede ou escrita. */
export default function FinancialScopedAnswer({ question, userId, context, onTalk }: Props) {
  const router = useRouter()
  const key = JSON.stringify([userId, context, question.period.start, question.period.end])
  const rows = useLiveQuery(async () => {
    if (!userId) return { key, transactions: [], categories: [], accounts: [], failed: false }
    try {
      const [transactions, categories, accounts] = await Promise.all([
        db.transactions.where('[user_id+context+date]').between(
          [userId, context, question.period.start],
          [userId, context, question.period.end], true, true,
        ).toArray(),
        db.categories.where('[user_id+context]').equals([userId, context]).toArray(),
        db.accounts.where('[user_id+context]').equals([userId, context]).toArray(),
      ])
      return { key, transactions, categories, accounts, failed: false }
    } catch {
      return { key, transactions: [], categories: [], accounts: [], failed: true }
    }
  }, [key])
  const answer = useMemo(() => rows?.key === key && !rows.failed && userId
    ? answerScopedFinancialQuestion(question, rows.transactions, rows.categories, rows.accounts, context)
    : null, [rows, key, userId, question, context])
  const failed = rows?.key === key && rows.failed

  return (
    <section aria-label="Consulta financeira combinada" className="mb-4 rounded-[23px] border border-teal-500/20 bg-white/95 p-4 shadow-[0_6px_24px_rgba(13,148,136,0.045)] dark:border-teal-400/15 dark:bg-slate-900/95">
      <div className="flex items-center gap-2">
        <SearchCheck size={17} className="shrink-0 text-teal-700 dark:text-teal-400" aria-hidden="true" />
        <span className="text-[10px] font-black uppercase tracking-[0.11em] text-teal-700 dark:text-teal-300">DFL Comando · Consulta combinada</span>
        <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Local</span>
      </div>
      {failed ? (
        <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Não foi possível ler os registros locais agora. Nenhum total foi presumido.</p>
      ) : !answer ? (
        <p role="status" className="mt-4 flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400"><LoaderCircle size={15} className="animate-spin" /> Conferindo registros disponíveis neste contexto…</p>
      ) : (
        <>
          <h2 className="mt-3 text-[16px] font-extrabold text-slate-950 dark:text-slate-100">{answer.title}</h2>
          <p className="mt-1 text-[11.5px] leading-[1.6] text-slate-500 dark:text-slate-400">{answer.detail}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"><CalendarDays size={12} className="mr-1 inline-block" /> {question.period.label}</span>
            <span className="rounded-full bg-teal-50 px-2.5 py-1.5 text-[10px] font-bold text-teal-700 dark:bg-teal-950/35 dark:text-teal-300">{context === 'dfl' ? 'Empresa' : 'Pessoal'}</span>
            {answer.account && <span className="rounded-full bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">Conta: {answer.account}</span>}
            {answer.category && <span className="rounded-full bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">Categoria: {answer.category}</span>}
          </div>
          {answer.state === 'ready' ? (
            <>
              <p className="mt-4 text-[28px] font-black tabular-nums tracking-tight text-slate-950 dark:text-slate-100">{currency.format(answer.amount ?? 0)}</p>
              <p className="mt-1 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">{answer.count} {answer.count === 1 ? 'lançamento realizado' : 'lançamentos realizados'} considerados</p>
              {(answer.records?.length ?? 0) > 0 && <div className="mt-3 space-y-1.5" aria-label="Lançamentos considerados">
                {answer.records?.map(item => (
                  <button key={item.id} type="button" onClick={() => router.push(item.href)}
                    className="flex min-h-[52px] w-full items-center gap-2 rounded-[14px] border border-slate-200/70 bg-slate-50/70 px-3 text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-700 dark:bg-slate-800/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-bold text-slate-800 dark:text-slate-100">{item.label}</span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">{item.date.split('-').reverse().join('/')}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-slate-700 dark:text-slate-200">{currency.format(item.amount)}</span>
                    <ArrowUpRight size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                ))}
                {answer.count > (answer.records?.length ?? 0) && <p className="px-1 text-[10px] text-slate-500 dark:text-slate-400">Primeiros {answer.records?.length} lançamentos. Abra o extrato para consultar os demais.</p>}
              </div>}
            </>
          ) : (
            <p className="mt-3 text-[11px] font-semibold text-amber-800 dark:text-amber-300">Consulta incompleta · valor não calculado</p>
          )}
        </>
      )}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => router.push('/transactions')} className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><BarChart3 size={15} aria-hidden="true" /> Abrir extrato <ArrowUpRight size={13} aria-hidden="true" /></button>
        <button type="button" onClick={onTalk} className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-teal-700 px-3 text-[11px] font-extrabold text-white transition active:scale-[0.99] dark:bg-teal-600"><MessageSquareText size={15} aria-hidden="true" /> Aprofundar no Gemini</button>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[9.5px] leading-4 text-slate-400 dark:text-slate-500"><ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> Somente registros disponíveis neste dispositivo. Nenhuma ação financeira é gravada ou enviada ao Gemini sem confirmação no chat.</p>
    </section>
  )
}
