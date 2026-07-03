'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

// Mantivemos desligados para testar
// import BottomNav from '@/components/BottomNav'
// import { ContextProvider } from '@/components/ContextToggle'

function AppContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="w-8 h-8 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-20">
      <div className="p-4 bg-red-600 text-white text-center font-bold text-sm">
        MODO DE RECUPERAÇÃO - TENTATIVA 2
      </div>
      {children}
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AppContent>{children}</AppContent>
      </body>
    </html>
  )
}
