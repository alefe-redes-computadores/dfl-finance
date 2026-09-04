// src/contexts/ToastContext.tsx
'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'
import Toast from '@/components/Toast'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const cleanMessage = message.trim()
    if (!cleanMessage) return

    setToasts((current) => {
      const withoutDuplicate = current.filter(
        (toast) => !(toast.message === cleanMessage && toast.type === type)
      )

      return [
        ...withoutDuplicate.slice(-2),
        { id: crypto.randomUUID(), message: cleanMessage, type },
      ]
    })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[200000] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
