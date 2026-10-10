'use client'

import {
  useEffect,
} from 'react'
import {
  useRouter,
} from 'next/navigation'

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    // A cold offline boot needs a cached HTML navigation, not an RSC fetch.
    if (!navigator.onLine) {
      window.location.replace('/home')
      return
    }
    router.replace('/home')
  }, [router])

  return (
    <main className="app-page flex min-h-[100dvh] items-center justify-center">
      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
        Abrindo DFL Finance…
      </span>
    </main>
  )
}
