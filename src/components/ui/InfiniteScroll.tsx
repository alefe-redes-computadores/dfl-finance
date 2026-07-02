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
  endText = 'Não há mais itens para carregar',
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
      <div ref={observerRef} className="py-6 text-center">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{loadingText}</span>
          </div>
        )}
        {!hasNextPage && !isFetchingNextPage && (
          <p className="text-sm text-gray-400 dark:text-gray-500">{endText}</p>
        )}
      </div>
    </div>
  )
      }
