'use client'

import { useEffect, Component, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import BottomNav from '@/components/BottomNav'
import { ContextProvider } from '@/components/ContextToggle'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h2 className="text-lg font-bold text-red-600">Algo deu errado</h2>
          <p className="text-sm text-gray-500 mt-2">{this.state.error?.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}

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
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-20">
        {children}
        <BottomNav />
      </div>
    </ErrorBoundary>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ContextProvider>
      <AppContent>{children}</AppContent>
    </ContextProvider>
  )
}