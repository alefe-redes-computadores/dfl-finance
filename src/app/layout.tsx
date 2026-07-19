'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import BottomNav from '@/components/BottomNav'
import { ContextProvider } from '@/components/ContextToggle'
import { Loader2 } from 'lucide-react'
import { useBottomNavVisible } from '@/hooks/useBottomNavVisible'

function AppContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  // ✅ NOVO: mesma fonte de verdade usada pelo BottomNav pra decidir se
  // renderiza. Assim o padding-bottom (pb-20) só é aplicado quando o nav
  // realmente vai aparecer na tela — nas telas de formulário (transactions/new,
  // transactions/edit, transactions/card-expense) o nav some e o espaço
  // reservado pra ele também some, evitando um respiro vazio no fim da página.
  const bottomNavVisible = useBottomNavVisible()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!loading && !user && mounted) {
      router.replace('/login')
    }
  }, [user, loading, router, mounted])

  if (loading || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900">
        <Loader2 size={40} className="animate-spin text-teal-700" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div
      className={`min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 ${
        bottomNavVisible ? 'pb-20' : ''
      }`}
    >
      <div className="page-transition">
        {children}
      </div>
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
