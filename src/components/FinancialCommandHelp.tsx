'use client'

import { ArrowUpRight, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'
import type { FinancialHelpTopic } from '@/lib/financialCommandHelp'

type Props = {
  topic: FinancialHelpTopic
  onExample: (value: string) => void
  onOpen: (href: string) => void
  onTalk: () => void
}

export default function FinancialCommandHelp({ topic, onExample, onOpen, onTalk }: Props) {
  return (
    <section aria-label="Ajuda do DFL Comando" className="mb-4 rounded-[23px] border border-teal-500/20 bg-white/90 p-4 shadow-[0_6px_28px_rgba(13,148,136,0.06)] dark:border-teal-400/15 dark:bg-slate-900/90">
      <div className="flex items-center gap-2">
        <Sparkles size={17} className="text-teal-600 dark:text-teal-400" aria-hidden="true" />
        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-teal-700 dark:text-teal-300">DFL Comando · Ajuda local</span>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Sem executar</span>
      </div>
      <h2 className="mt-3 text-[17px] font-black text-slate-950 dark:text-white">{topic.title}</h2>
      <p className="mt-1 text-[11.5px] leading-[1.65] text-slate-500 dark:text-slate-400">{topic.detail}</p>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Exemplos de frases">
        {topic.examples.map(example => (
          <button key={example} type="button" onClick={() => onExample(example)}
            className="min-h-9 rounded-full border border-teal-500/20 bg-teal-50/75 px-3 py-1.5 text-[10.5px] font-bold text-teal-800 transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-teal-400/15 dark:bg-teal-950/30 dark:text-teal-200">
            {example}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {topic.actions.map(item => (
          <button key={item.id} type="button" onClick={() => onOpen(item.href)}
            className="flex min-h-[58px] items-center gap-3 rounded-[15px] border border-slate-200/80 bg-slate-50/80 px-3 text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-700 dark:bg-slate-800/70">
            <span className="min-w-0 flex-1"><span className="block text-[12px] font-extrabold text-slate-800 dark:text-slate-100">{item.title}</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-500 dark:text-slate-400">{item.detail}</span></span>
            <ArrowUpRight size={15} className="shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          </button>
        ))}
      </div>
      {topic.geminiHint && (
        <button type="button" onClick={onTalk}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-teal-700 px-3 text-[11px] font-extrabold text-white transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 dark:bg-teal-600">
          <MessageSquareText size={15} aria-hidden="true" /> Continuar esta pergunta no Gemini
        </button>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-[9.5px] leading-4 text-slate-400 dark:text-slate-500"><ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> Frases abrem caminhos ou respostas de leitura. Nenhuma ação financeira é confirmada silenciosamente.</p>
    </section>
  )
}
