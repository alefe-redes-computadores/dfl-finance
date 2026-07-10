'use client'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {children}
    </div>
  )
}
