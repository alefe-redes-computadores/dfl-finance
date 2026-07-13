'use client'

import { useRef, useState, useCallback, ReactNode } from 'react'

interface SwipeAction {
  label: string
  onAction: () => void
  bgColor: string
  icon?: ReactNode
}

interface SwipeableRowProps {
  children: ReactNode
  leftAction?: SwipeAction
  rightAction?: SwipeAction
  threshold?: number
}

export default function SwipeableRow({
  children,
  leftAction,
  rightAction,
  threshold = 80,
}: SwipeableRowProps) {
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const [swipe, setSwipe] = useState<'left' | 'right' | null>(null)
  const [swiping, setSwiping] = useState(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchEndX.current = e.touches[0].clientX
    setSwiping(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback(() => {
    const dx = touchEndX.current - touchStartX.current

    if (Math.abs(dx) > threshold) {
      if (dx > 0 && rightAction) {
        setSwipe('right')
        rightAction.onAction()
      } else if (dx < 0 && leftAction) {
        setSwipe('left')
        leftAction.onAction()
      }
    }

    setSwiping(false)
    setTimeout(() => setSwipe(null), 300)
  }, [leftAction, rightAction, threshold])

  return (
    <div className="relative overflow-hidden rounded-[16px]">
      {leftAction && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end px-4 rounded-r-[16px]"
          style={{ backgroundColor: leftAction.bgColor }}
        >
          <span className="text-white font-bold text-sm flex items-center gap-2">
            {leftAction.icon}
            {leftAction.label}
          </span>
        </div>
      )}

      {rightAction && (
        <div
          className="absolute inset-y-0 left-0 flex items-center px-4 rounded-l-[16px]"
          style={{ backgroundColor: rightAction.bgColor }}
        >
          <span className="text-white font-bold text-sm flex items-center gap-2">
            {rightAction.icon}
            {rightAction.label}
          </span>
        </div>
      )}

      <div
        className={`relative bg-white dark:bg-slate-800 transition-transform duration-300 ${
          swipe === 'left'
            ? '-translate-x-[80px]'
            : swipe === 'right'
            ? 'translate-x-[80px]'
            : ''
        } ${swiping ? 'select-none' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}