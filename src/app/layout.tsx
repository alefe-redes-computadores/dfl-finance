'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import BottomNav from '@/components/BottomNav'
import { ContextProvider } from '@/components/ContextToggle'
import './globals.css'

// 1. IMPORTAÇÃO DA POPPINS
import { Poppins } from 'next/font/google'
const poppins = Poppins({ 
  subsets: ['latin'], 
  weight: ['400', '500', '600', '700'] // Pesos comuns da Poppins
})

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
      {children}
      <BottomNav />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // 2. APLICAÇÃO DA CLASSE poppins.className
  return (
    <html lang="pt-BR" className={poppins.className}>
      <body>
        <ContextProvider>
          <AppContent>{children}</AppContent>
        </ContextProvider>
      </body>
    </html>
  )
}
