// src/components/BottomNav.tsx
'use client'

import React, { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Home,
  ArrowLeftRight,
  BarChart2,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  CreditCard,
  Plus,
} from 'lucide-react'
import TransferModal from './TransferModal'
import FAB from './FAB'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useBottomNavVisible } from '@/hooks/useBottomNavVisible'

const tabs = [
  { href: '/home', icon: Home, label: 'Início' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
  { href: '/analysis', icon: BarChart2, label: 'Análise' },
  { href: '/more', icon: MoreHorizontal, label: 'Mais' },
]

export default function BottomNav() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const { vibrate } = useHapticFeedback()
  const [isOpen, setIsOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [quickActionOpen, setQuickActionOpen] = useState(false)
  const [quickActionType, setQuickActionType] = useState<'expense' | 'income'>('expense')

  // ✅ CORRIGIDO: visibilidade agora vem de um hook compartilhado
  // (useBottomNavVisible), a mesma fonte de verdade usada pelo AppLayout
  // pra decidir o padding-bottom. Antes essa lógica vivia só aqui dentro,
  // duplicada e sem sincronia com o layout.
  const isVisible = useBottomNavVisible()

  if (!isVisible) return null

  const handleNavigate = (path: string) => {
    vibrate([10])
    setIsOpen(false)
    router.push(path)
  }

  const handleOpenTransfer = () => {
    vibrate([10])
    setIsOpen(false)
    setIsTransferModalOpen(true)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault()
    vibrate([10])
    setIsOpen(false)
    router.push('/transactions/card-expense')
  }

  const toggleMenu = () => {
    vibrate([15])
    setIsOpen((v) => !v)
  }

  const handleCentralAction = () => {
    // Em Transações, o botão principal abre o lançamento completo.
    // Nas demais telas, preserva o menu rápido existente.
    if (pathname === '/transactions') {
      vibrate([15])
      setIsOpen(false)
      router.push('/transactions/new')
      return
    }

    toggleMenu()
  }

  const isTransactionsRoot = pathname === '/transactions'

  return (
    <>
      <div
        className={`fixed inset-0 z-[50] bg-black/60 dark:bg-[#121414]/80 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <div
        className={`fixed bottom-[82px] left-4 right-4 z-[60] mx-auto max-w-md origin-bottom transition-all duration-200 ${
          isOpen
            ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto'
            : 'translate-y-3 scale-[0.97] opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="rounded-[24px] border border-gray-200/80 bg-white/95 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.20)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/95">
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => {
                vibrate([10])
                setIsOpen(false)
                setQuickActionType('income')
                setQuickActionOpen(true)
              }}
              className="flex min-w-0 flex-col items-center gap-2 rounded-[18px] px-1 py-3 transition-colors active:scale-[0.96] active:bg-gray-100 dark:active:bg-slate-700"
              aria-label="Nova receita"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-emerald-50 dark:bg-emerald-950/40">
                <ArrowUp size={21} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                Receita
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                vibrate([10])
                setIsOpen(false)
                setQuickActionType('expense')
                setQuickActionOpen(true)
              }}
              className="flex min-w-0 flex-col items-center gap-2 rounded-[18px] px-1 py-3 transition-colors active:scale-[0.96] active:bg-gray-100 dark:active:bg-slate-700"
              aria-label="Nova despesa"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-red-50 dark:bg-red-950/40">
                <ArrowDown size={21} className="text-red-500 dark:text-red-400" />
              </div>
              <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                Despesa
              </span>
            </button>

            <button
              type="button"
              onClick={handleCardClick}
              className="flex min-w-0 flex-col items-center gap-2 rounded-[18px] px-1 py-3 transition-colors active:scale-[0.96] active:bg-gray-100 dark:active:bg-slate-700"
              aria-label="Lançar cartão"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-orange-50 dark:bg-orange-950/40">
                <CreditCard size={21} className="text-orange-500 dark:text-orange-400" />
              </div>
              <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                Cartão
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenTransfer}
              className="flex min-w-0 flex-col items-center gap-2 rounded-[18px] px-1 py-3 transition-colors active:scale-[0.96] active:bg-gray-100 dark:active:bg-slate-700"
              aria-label="Transferir"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-teal-50 dark:bg-teal-950/40">
                <ArrowLeftRight size={21} className="text-teal-700 dark:text-teal-400" />
              </div>
              <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                Transferir
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[40] h-[72px] border-t border-gray-200/70 bg-white/95 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-colors duration-300 dark:border-slate-700/80 dark:bg-slate-800/95 dark:shadow-[0_-8px_30px_rgba(0,0,0,0.18)]">
        <div className="relative mx-auto flex h-full max-w-md items-center justify-around px-2">
          <div className="absolute left-1/2 top-0 z-[45] -translate-x-1/2 -translate-y-[42%]">
            <div className="rounded-full border border-gray-200/70 bg-gray-50 p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={handleCentralAction}
                className={`relative flex h-[54px] w-[54px] items-center justify-center rounded-full text-white shadow-[0_7px_22px_rgba(15,118,110,0.30)] transition-all duration-200 active:scale-[0.92] ${
                  !isTransactionsRoot && isOpen
                    ? 'rotate-45 bg-slate-700 dark:bg-slate-600'
                    : 'rotate-0 bg-teal-700 dark:bg-teal-600'
                }`}
                aria-label={
                  isTransactionsRoot
                    ? 'Nova transação'
                    : isOpen
                      ? 'Fechar menu'
                      : 'Abrir menu'
                }
                aria-expanded={isTransactionsRoot ? false : isOpen}
              >
                <Plus size={26} />
              </button>
            </div>
          </div>

          {tabs.map((tab, i) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`) || pathname.startsWith(`${tab.href}?`)
            const Icon = tab.icon

            if (i === 1) {
              return (
                <React.Fragment key="fab-group">
                  <button
                    type="button"
                    onClick={() => handleNavigate(tab.href)}
                    title={tab.label}
                    className="group relative flex min-w-[56px] flex-col items-center gap-1 px-3 py-1 transition-transform active:scale-[0.95]"
                  >
                    <div
                      className={`flex h-7 min-w-9 items-center justify-center rounded-full px-2 transition-colors ${
                        active ? 'bg-teal-50 dark:bg-teal-950/40' : ''
                      }`}
                    >
                      <Icon
                        size={20}
                        className={
                          active
                            ? 'text-teal-700 dark:text-teal-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }
                      />
                    </div>
                    <span
                      className={
                        active
                          ? 'text-[9.5px] font-semibold text-teal-700 dark:text-teal-400'
                          : 'text-[9.5px] font-medium text-gray-400 dark:text-gray-500'
                      }
                    >
                      {tab.label}
                    </span>
                  </button>
                  <div className="w-[72px]" />
                </React.Fragment>
              )
            }

            return (
              <button
                type="button"
                key={tab.href}
                onClick={() => handleNavigate(tab.href)}
                title={tab.label}
                className="group relative flex min-w-[56px] flex-col items-center gap-1 px-3 py-1 transition-transform active:scale-[0.95]"
              >
                <div
                      className={`flex h-7 min-w-9 items-center justify-center rounded-full px-2 transition-colors ${
                        active ? 'bg-teal-50 dark:bg-teal-950/40' : ''
                      }`}
                    >
                      <Icon
                        size={20}
                        className={
                          active
                            ? 'text-teal-700 dark:text-teal-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }
                      />
                    </div>
                <span
                  className={
                    active
                      ? 'text-[9.5px] font-semibold text-teal-700 dark:text-teal-400'
                      : 'text-[9.5px] font-medium text-gray-400 dark:text-gray-500'
                  }
                >
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <FAB
        isOpen={quickActionOpen}
        initialType={quickActionType}
        onClose={() => setQuickActionOpen(false)}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onComplete={() => {
          setIsTransferModalOpen(false)
        }}
      />
    </>
  )
}
