'use client'

import { ArrowUpRight, ListFilter, Sparkles } from 'lucide-react'
import type { GlobalSearchResult } from '@/lib/globalSearch'
import type { FinancialSearchFacetId } from '@/lib/financialSearchFacets'
import type { FinancialResultGuidance } from '@/lib/financialSearchGuidance'

type Props = {
  guidance: FinancialResultGuidance
  onRefine: (facet: FinancialSearchFacetId) => void
  onOpen: (item: GlobalSearchResult) => void
}

/** Apenas apresenta uma acao explicita; jamais navega, filtra ou grava por efeito. */
export default function FinancialResultGuide({ guidance, onRefine, onOpen }: Props) {
  return (
    <section aria-label="Orientação contextual dos resultados" className="mb-3 rounded-[18px] border border-amber-300/30 bg-amber-50/55 px-3.5 py-3 dark:border-amber-400/15 dark:bg-slate-900/75">
      <div className="flex items-start gap-2.5">
        <Sparkles size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-extrabold text-slate-900 dark:text-slate-100">{guidance.title}</p>
          <p className="mt-1 text-[11px] leading-[1.5] text-slate-600 dark:text-slate-300">{guidance.detail}</p>
          <button type="button"
            onClick={() => guidance.kind === 'refine' ? onRefine(guidance.facet) : onOpen(guidance.item)}
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-amber-400/25 bg-white/80 px-3 text-[11px] font-extrabold text-teal-700 transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-amber-400/15 dark:bg-slate-800 dark:text-teal-300">
            {guidance.kind === 'refine' ? <ListFilter size={14} aria-hidden="true" /> : <ArrowUpRight size={14} aria-hidden="true" />}
            {guidance.actionLabel}
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-[9.5px] text-slate-400 dark:text-slate-500">Com base somente nos resultados locais · Nenhum dado é alterado</p>
    </section>
  )
}
