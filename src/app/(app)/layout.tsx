'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import BottomNav from '@/components/BottomNav'
import { ContextProvider } from '@/components/ContextToggle'
import { Loader2 } from 'lucide-react'
import { useBottomNavVisible } from '@/hooks/useBottomNavVisible'

function AppContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname() || ''
  const [mounted, setMounted] = useState(false)

  const bottomNavVisible = useBottomNavVisible()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    document.documentElement.style.overflow = ''
    document.documentElement.style.touchAction = ''
    document.body.style.overflow = ''
    document.body.style.touchAction = ''
  }, [pathname])

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
      className="app-page h-[100dvh] overflow-y-auto overscroll-y-contain transition-colors duration-300"
      style={{
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        ...(bottomNavVisible
          ? {
              paddingBottom:
                'calc(68px + var(--safe-area-bottom))',
            }
          : {}),
      }}
    >
      <div className="page-transition min-h-full">
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