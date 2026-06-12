'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

export default function Root() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/home')
      } else {
        router.replace('/login')
      }
    }
  }, [user, loading, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-light dark:bg-surface-dark">
      <div className="w-8 h-8 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
