import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-6 text-center text-slate-900 dark:bg-slate-950 dark:text-white">
      <span className="text-[13px] font-black tracking-[0.16em] text-teal-600">DFL FINANCE · 404</span>
      <h1 className="mt-3 text-[25px] font-black">Esta página não está disponível</h1>
      <p className="mt-2 max-w-sm text-[13px] leading-6 text-slate-500 dark:text-slate-400">O endereço pode ter mudado. Seus dados financeiros não foram alterados.</p>
      <Link href="/home" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-teal-600 px-6 text-[13px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500">Voltar ao Finance</Link>
    </main>
  )
}
