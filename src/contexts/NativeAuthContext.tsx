'use client'

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import { useAuthDeepLink } from '@/lib/hooks/useAuthDeepLink'

interface NativeAuthContextValue {
  isProcessing: boolean
}

const NativeAuthContext =
  createContext<NativeAuthContextValue | null>(
    null,
  )

export function NativeAuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const authDeepLink = useAuthDeepLink()

  return (
    <NativeAuthContext.Provider
      value={authDeepLink}
    >
      {children}
    </NativeAuthContext.Provider>
  )
}

export function useNativeAuth() {
  const context =
    useContext(NativeAuthContext)

  if (!context) {
    throw new Error(
      'useNativeAuth precisa estar dentro de NativeAuthProvider.',
    )
  }

  return context
}
