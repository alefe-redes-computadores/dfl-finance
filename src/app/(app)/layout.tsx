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
      <div className="app-page flex items-center justify-center px-6">
        <div className="app-surface flex items-center gap-3 px-5 py-4" role="status" aria-live="polite">
          <Loader2 size={22} className="animate-spin text-teal-700 dark:text-teal-400" />
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Carregando seus dados…</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div
      className="app-page transition-colors duration-300"
      style={bottomNavVisible ? { paddingBottom: 'calc(72px + max(var(--safe-area-bottom), 16px))' } : undefined}
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