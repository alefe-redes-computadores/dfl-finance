'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import BottomNav from '@/components/BottomNav'
import { ContextProvider } from '@/components/ContextToggle'

function AppContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Redireciona apenas se o carregamento terminou e não há usuário
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  // Se estiver carregando OU não houver usuário, exibe o spinner
  // Isso resolve a tela branca (o antigo 'return null')
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-20">
      {children}
      <BottomNav />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ContextProvider>
      <AppContent>{children}</AppContent>
    </ContextProvider>
  )
}