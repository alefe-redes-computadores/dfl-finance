'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUpRight, CalendarClock, GitCompareArrows, LoaderCircle, MessageSquareText, Sparkles } from 'lucide-react'
import { db } from '@/lib/db'
import {
  answerFinancialQuestion360,
  financial360Destination,
  type Financial360Context,
  type Financial360Inputs,
  type Financial360Question,
} from '@/lib/financialQuestion360'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = new Intl.NumberFormat('pt-BR', { style: 'decimal', maximumFractionDigits: 1 })

type Props = { question: Financial360Question; userId: string | null; context: Financial360Context; onTalk: () => void }

/** R432: uma resposta por identidade de consulta, separada por usuário e contexto. */
export default function FinancialQuestion360Answer({ question, userId, context, onTalk }: Props) {
  const router = useRouter()
  const key = JSON.stringify([userId, context, question])
  const result = useLiveQuery(async () => {
    const data: Financial360Inputs = {}
    if (!userId) return { key, data }
    // Apenas os conjuntos necessários; a tela nunca escreve nem consulta API.
    if (question.kind === 'comparison') {
      const periods = question.periods
      if (periods) {
        const start = periods[0].start < periods[1].start ? periods[0].start : periods[1].start
        const end = periods[0].end > periods[1].end ? periods[0].end : periods[1].end
        data.transactions = await db.transactions.where('[user_id+context+date]')
          .between([userId, context, start], [userId, context, end], true, true).toArray()
      }
    } else if (question.kind === 'pending-expenses') {
      data.transactions = question.month
        ? await db.transactions.where('[user_id+context+date]').between(
          [userId, context, question.month.start], [userId, context, question.month.end], true, true,
        ).toArray()
        : await db.transactions.where('[user_id+context]').equals([userId, context]).toArray()
    } else if (question.kind === 'receivables') {
      data.debts = await db.debts.where('[user_id+context]').equals([userId, context]).toArray()
    } else if (question.kind === 'open-invoices' || question.kind === 'due') {
      // credit_invoices não tem índice [user_id+context]; usa índice user_id
      // e isola o contexto com filtro explícito antes de renderizar.
      const [invoices, cards] = await Promise.all([
        db.credit_invoices.where('user_id').equals(userId).and(item => item.context === context).toArray(),
        db.credit_cards.where('[user_id+context]').equals([userId, context]).toArray(),
      ])
      data.invoices = invoices
      data.cards = cards
      if (question.kind === 'due' && question.dueSource !== 'invoices') {
        const [transactions, subscriptions, loans, financings] = await Promise.all([
          db.transactions.where('[user_id+context]').equals([userId, context]).toArray(),
          db.subscriptions.where('[user_id+context]').equals([userId, context]).toArray(),
          db.loans.where('[user_id+context]').equals([userId, context]).toArray(),
          db.financings.where('[user_id+context]').equals([userId, context]).toArray(),
        ])
        data.transactions = transactions
        data.subscriptions = subscriptions
        data.loans = loans
        data.financings = financings
      }
    }
    return { key, data }
  }, [key])
  const answer = useMemo(() => result?.key === key && userId
    ? answerFinancialQuestion360(question, result.data, context) : null,
  [result, key, question, context, userId])
  const isCompare = question.kind === 'comparison'
  const changeRatio = answer?.first && answer?.second && answer.second.amount !== 0 && answer.difference !== undefined
    ? (answer.difference / Math.abs(answer.second.amount)) * 100 : null

  return (
    <section aria-label="Consulta financeira ampliada" className="mb-4 rounded-[23px] border border-amber-400/25 bg-white/90 p-4 shadow-[0_5px_24px_rgba(245,158,11,0.05)] dark:border-amber-400/15 dark:bg-slate-900/90">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="shrink-0 text-amber-500" aria-hidden="true" />
        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-amber-700 dark:text-amber-300">DFL Comando · Consulta 360</span>
        <span className="ml-auto rounded-full bg-teal-50 px-2 py-1 text-[9px] font-bold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">Local · leitura</span>
      </div>
      {!answer ? (
        <p role="status" className="mt-4 flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400"><LoaderCircle size={16} className="animate-spin" /> Consultando somente os registros deste contexto…</p>
      ) : (
        <>
          <h2 className="mt-3 text-[16px] font-extrabold text-slate-900 dark:text-slate-100">{answer.title}</h2>
          <p className="mt-1 text-[11.5px] leading-[1.6] text-slate-500 dark:text-slate-400">{answer.detail}</p>
          {answer.state === 'ready' && isCompare && answer.first && answer.second ? (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {[answer.first,answer.second].map((value,i)=>(
                  <div key={i} className="min-w-0 rounded-[15px] bg-slate-50 p-3 dark:bg-slate-800/70">
                    <p className="truncate text-[10px] font-semibold capitalize text-slate-500 dark:text-slate-400">{value.label}</p>
                    <p className="mt-1 text-[15px] font-black tabular-nums text-slate-900 dark:text-slate-100">{currency.format(value.amount)}</p>
                    <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{value.count} registros realizados</p>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-2 rounded-xl bg-teal-50/60 px-3 py-2 text-[11px] font-bold text-teal-800 dark:bg-teal-950/25 dark:text-teal-300">
                <GitCompareArrows size={15} aria-hidden="true" /> Diferença (primeiro − segundo): {currency.format(answer.difference ?? 0)}{changeRatio === null ? '' : ` · ${percent.format(changeRatio)}%`}
              </p>
            </div>
          ) : answer.state === 'ready' ? (
            <>
              {typeof answer.total === 'number' && (
                <p className="mt-3 text-[26px] font-black tabular-nums tracking-tight text-slate-900 dark:text-slate-100">{currency.format(answer.total)}</p>
              )}
              <p className="mt-2 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">{answer.count} {answer.count===1?'registro encontrado':'registros encontrados'} · {context==='dfl'?'Empresa':'Pessoal'}</p>
              {(answer.items?.length ?? 0)>0 && (
                <div className="mt-3 space-y-1.5" aria-label="Registros relacionados">
                  {answer.items?.map(item=>(
                    <button key={item.id} type="button" onClick={()=>router.push(item.href)}
                      className="flex min-h-[53px] w-full items-center gap-2 rounded-[14px] border border-slate-200/70 bg-slate-50/70 px-3 text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-700 dark:bg-slate-800/60">
                      <CalendarClock size={15} className="shrink-0 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-bold text-slate-800 dark:text-slate-100">{item.label}</span><span className="block text-[10px] text-slate-500 dark:text-slate-400">{item.source}{item.date?` · ${item.date.split('-').reverse().join('/')}`:''}</span></span>
                      {typeof item.amount==='number'&&<span className="shrink-0 text-[11px] font-extrabold tabular-nums text-slate-700 dark:text-slate-200">{currency.format(item.amount)}</span>}
                      <ArrowUpRight size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                  ))}
                  {answer.count>(answer.items?.length??0)&&<p className="px-1 text-[10px] text-slate-500 dark:text-slate-400">Mostrando os primeiros {answer.items?.length} registros. Abra a área correspondente para consultar os demais.</p>}
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 rounded-xl bg-amber-50/70 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/25 dark:text-amber-300">Nenhum total foi presumido para essa consulta.</p>
          )}
        </>
      )}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={()=>router.push(financial360Destination(question))} className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><ArrowUpRight size={14} aria-hidden="true" /> Abrir área relacionada</button>
        <button type="button" onClick={onTalk} className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-teal-700 px-3 text-[11px] font-extrabold text-white active:scale-[0.99] dark:bg-teal-600"><MessageSquareText size={15} aria-hidden="true" /> Aprofundar com Gemini</button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-400 dark:text-slate-500">Apenas registros locais disponíveis · Sem ações automáticas. Perguntas abertas continuam no chat Gemini após sua confirmação.</p>
    </section>
  )
}
