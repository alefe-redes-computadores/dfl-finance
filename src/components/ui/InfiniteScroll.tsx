'use client'

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface InfiniteScrollProps {
  children: React.ReactNode
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  loadingText?: string
  endText?: string
}

export function InfiniteScroll({
  children,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  loadingText = 'Carregando mais...',
  endText = 'Fim da lista',
}: InfiniteScrollProps) {
  const observerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current)
      }
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div>
      {children}
      <div ref={observerRef} className="py-8 text-center flex flex-col items-center justify-center">
        {isFetchingNextPage && (
          <div className="flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600 dark:text-teal-500" />
            <span className="text-[11px] font-bold uppercase tracking-widest">{loadingText}</span>
          </div>
        )}
        {!hasNextPage && !isFetchingNextPage && (
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-slate-800/50 py-2 px-5 rounded-full inline-block border border-gray-100 dark:border-slate-700/50">
            {endText}
          </p>
        )}
      </div>
    </div>
  )
}
