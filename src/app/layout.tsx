'use client'

import { Navigation } from '@/components/Navigation'
import { ContextToggleProvider } from '@/components/ContextToggle'
import ErudaButton from '@/components/ErudaButton' // 🔥 Importe aqui

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ContextToggleProvider>
      <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 overflow-hidden">
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </main>
        <Navigation />
        
        {/* 🔥 Botão Flutuante de Debug */}
        <ErudaButton />
        
      </div>
    </ContextToggleProvider>
  )
}
