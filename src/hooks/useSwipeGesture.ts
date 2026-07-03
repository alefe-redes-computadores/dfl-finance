// src/hooks/useSwipeGesture.ts
'use client'

import { useState, useRef, useCallback } from 'react'

interface UseSwipeGestureOptions {
  threshold?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onTap?: () => void
}

export function useSwipeGesture(options: UseSwipeGestureOptions = {}) {
  const { threshold = 80, onSwipeLeft, onSwipeRight, onTap } = options

  const [offsetX, setOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)

  const startX = useRef(0)
  const startY = useRef(0)
  const hasMoved = useRef(false)

  const handleStart = useCallback((clientX: number, clientY: number) => {
    startX.current = clientX
    startY.current = clientY
    hasMoved.current = false
    setIsDragging(true)
  }, [])

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return
    const deltaX = clientX - startX.current
    const deltaY = clientY - startY.current

    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      hasMoved.current = true
      setOffsetX(deltaX)
      if (deltaX > threshold) setDirection('right')
      else if (deltaX < -threshold) setDirection('left')
      else setDirection(null)
    }
  }, [isDragging, threshold])

  const handleEnd = useCallback(() => {
    setIsDragging(false)

    if (!hasMoved.current && onTap) {
      onTap()
    } else if (direction === 'right' && onSwipeRight) {
      onSwipeRight()
    } else if (direction === 'left' && onSwipeLeft) {
      onSwipeLeft()
    }

    setOffsetX(0)
    setDirection(null)
    hasMoved.current = false
  }, [direction, onSwipeLeft, onSwipeRight, onTap])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX, e.clientY)
  }, [handleStart])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX, e.clientY)
  }, [isDragging, handleMove])

  const onMouseUp = useCallback(() => {
    if (isDragging) handleEnd()
  }, [isDragging, handleEnd])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }, [handleStart])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0]
      handleMove(touch.clientX, touch.clientY)
    }
  }, [isDragging, handleMove])

  const onTouchEnd = useCallback(() => {
    if (isDragging) handleEnd()
  }, [isDragging, handleEnd])

  return {
    offsetX,
    isDragging,
    direction,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    style: {
      transform: `translateX(${offsetX}px) rotate(${offsetX * 0.05}deg)`,
      transition: isDragging ? 'none' : 'transform 0.3s ease-out',
    },
  }
}