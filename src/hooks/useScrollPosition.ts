'use client'

import { useState, useEffect } from 'react'

interface ScrollPosition {
  scrollY: number
  windowHeight: number
  documentHeight: number
}

export function useScrollPosition(): ScrollPosition {
  const [position, setPosition] = useState<ScrollPosition>({
    scrollY: 0,
    windowHeight: 0,
    documentHeight: 0,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleScroll = () => {
      setPosition({
        scrollY: window.scrollY,
        windowHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // chama uma vez para inicializar

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return position
}