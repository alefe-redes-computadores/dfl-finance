'use client'

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUpRight, BarChart3, LoaderCircle, MessageSquareText, Sparkles } from 'lucide-react'
import { db } from '@/lib/db'
import {
  answerFinancialReadOnlyQuestion,
  type ReadOnlyFinancialQuestion,
} from '@/lib/financialReadOnlyQuestions'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Props = {
  question: ReadOnlyFinancialQuestion
  userId: string | null
  context: 'dfl' | 'personal'
  onTalk: () => void
  onView: () => void
}

/** Dados locais por usuario/contexto/data; nenhum envio para Gemini neste componente. */
export default function FinancialReadOnlyAnswer({ question, userId, context, onTalk, onView }: Props) {
  const queryKey = `${userId ?? ''}:${context}:${question.start}:${question.end}`
  const rows = useLiveQuery(async () => {
    if (!userId) return { key: queryKey, transactions: [], categories: [] }
    const [transactions, categories] = await Promise.all([
      db.transactions.where('[user_id+context+date]')
        .between([userId, context, question.start], [userId, context, question.end], true, true).toArray(),
      db.categories.where('[user_id+context]').equals([userId, context]).toArray(),
    ])
    return { key: queryKey, transactions, categories }
  }, [queryKey])

  // Descarta inclusive um snapshot anterior durante troca rapida de usuario/contexto.
  const answer = useMemo(() => rows && rows.key === queryKey && userId ? answerFinancialReadOnlyQuestion(
    question, rows.transactions, rows.categories, context,
  ) : null, [rows, queryKey, userId, question, context])

  const displayAmount = answer && (question.kind === 'income' ? answer.income
    : question.kind === 'flow' ? answer.net : answer.expense)
  return (
    <section aria-label="Resposta financeira local" className="mb-4 rounded-[23px] border border-amber-400/25 bg-white/90 p-4 shadow-[0_5px_24px_rgba(245,158,11,0.05)] dark:border-amber-400/15 dark:bg-slate-900/90">
      <div className="flex items-center gap-2">
        <Sparkles size={17} className="shrink-0 text-amber-500" aria-hidden="true" />
        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-amber-700 dark:text-amber-300">DFL Comando · Resposta local</span>
        <span className="ml-auto shrink-0 rounded-full bg-teal-50 px-2 py-1 text-[9px] font-bold text-teal-700 dark:bg-teal-950/35 dark:text-teal-300">Somente leitura</span>
      </div>
      {!answer ? (
        <p role="status" className="mt-4 flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
          <LoaderCircle size={15} className="animate-spin" /> Conferindo lançamentos neste dispositivo…
        </p>
      ) : (
        <>
          <h2 className="mt-3 text-[16px] font-extrabold text-slate-900 dark:text-slate-100">{answer.title}</h2>
          <p className="mt-1 text-[11.5px] leading-[1.6] text-slate-500 dark:text-slate-400">{answer.detail}</p>
          {answer.state === 'ready' && (
            <>
              {answer.category && <p className="mt-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">{answer.category}</p>}
              {question.kind === 'flow' ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-[14px] bg-emerald-50/70 p-3 dark:bg-emerald-950/25">
                    <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Receitas</p>
                    <p className="mt-1 text-[15px] font-black tabular-nums text-emerald-800 dark:text-emerald-200">{money.format(answer.income)}</p>
                  </div>
                  <div className="rounded-[14px] bg-rose-50/70 p-3 dark:bg-rose-950/25">
                    <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">Despesas</p>
                    <p className="mt-1 text-[15px] font-black tabular-nums text-rose-800 dark:text-rose-200">{money.format(answer.expense)}</p>
                  </div>
                  <div className="col-span-2 rounded-[14px] bg-slate-50 p-3 dark:bg-slate-800/80">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Diferença entre receitas e despesas (não é saldo bancário)</p>
                    <p className="mt-1 text-[17px] font-black tabular-nums text-slate-900 dark:text-slate-100">{money.format(answer.net)}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[26px] font-black tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
                  {money.format(displayAmount ?? 0)}
                </p>
              )}
              <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">{answer.count} {answer.count === 1 ? 'lançamento considerado' : 'lançamentos considerados'} · {context === 'dfl' ? 'Empresa' : 'Pessoal'}</p>
            </>
          )}
        </>
      )}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={onView} className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <BarChart3 size={15} aria-hidden="true" /> Ver extrato do período <ArrowUpRight size={13} aria-hidden="true" />
        </button>
        <button type="button" onClick={onTalk} className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-teal-700 px-3 text-[11px] font-extrabold text-white transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 dark:bg-teal-600">
          <MessageSquareText size={15} aria-hidden="true" /> Aprofundar com Gemini
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-400 dark:text-slate-500">Os números vêm dos registros locais disponíveis, com as regras de Análises. Ao tocar em Enviar no chat, o Gemini recebe a pergunta e o contexto financeiro estruturado previsto pelo Assistente.</p>
    </section>
  )
}
