'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

interface BottomNavOverlayCtx {
  hidden: boolean
  setHidden: (v: boolean) => void
}

const Ctx = createContext<BottomNavOverlayCtx>({
  hidden: false,
  setHidden: () => {},
})

export const useBottomNavOverlay = () => useContext(Ctx)

export function BottomNavOverlayProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false)

  const setHidden = useCallback((v: boolean) => {
    setHiddenState(v)
  }, [])

  return (
    <Ctx.Provider value={{ hidden, setHidden }}>
      {children}
    </Ctx.Provider>
  )
}