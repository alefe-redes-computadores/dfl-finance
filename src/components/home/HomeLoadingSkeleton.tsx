'use client'

/** Estado de carregamento da Home: apenas apresentação, sem consultar dados financeiros. */
function Block({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse motion-reduce:animate-none bg-slate-200/70 dark:bg-slate-700/70 ${className}`} />
}

export default function HomeLoadingSkeleton() {
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl bg-gray-50 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] dark:bg-slate-900" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Preparando sua visão financeira</span>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3"><Block className="h-4 w-36 rounded-full" /><Block className="h-9 w-48 max-w-full rounded-2xl" /></div>
        <Block className="h-10 w-10 rounded-2xl" />
      </div>
      <div className="mb-4 rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-800/70">
        <Block className="mb-5 h-3 w-28 rounded-full" /><Block className="mb-4 h-9 w-52 max-w-full rounded-xl" />
        <div className="flex justify-between gap-4"><Block className="h-3 w-24 rounded-full" /><Block className="h-3 w-16 rounded-full" /></div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        {[0, 1].map(i => <div key={i} className="rounded-[24px] border border-slate-200/70 bg-white p-4 dark:border-slate-700/70 dark:bg-slate-800/70"><Block className="mb-4 h-8 w-8 rounded-xl" /><Block className="mb-3 h-3 w-20 max-w-full rounded-full" /><Block className="h-6 w-24 max-w-full rounded-lg" /></div>)}
      </div>
      <div className="rounded-[24px] border border-slate-200/70 bg-white p-4 dark:border-slate-700/70 dark:bg-slate-800/70">
        <div className="mb-5 flex items-center justify-between"><Block className="h-4 w-32 rounded-full" /><Block className="h-7 w-7 rounded-lg" /></div>
        {[0, 1, 2].map(i => <div key={i} className="flex items-center gap-3 py-3"><Block className="h-10 w-10 shrink-0 rounded-2xl" /><div className="flex-1 space-y-2"><Block className="h-3 w-3/5 rounded-full" /><Block className="h-2.5 w-2/5 rounded-full" /></div><Block className="h-4 w-14 rounded-full" /></div>)}
      </div>
    </div>
  )
}
