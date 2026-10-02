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
  Search,
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

  // Visibilidade vem do hook compartilhado.
  // É a mesma fonte de verdade usada pelo AppLayout
  // pra decidir o padding-bottom. Antes essa lógica vivia só aqui dentro,
  // duplicada e sem sincronia com o layout.
  const isVisible = useBottomNavVisible()

  if (!isVisible) return null

  const navigateSafely = (path: string) => {
    router.push(path)

    if (typeof window === 'undefined') return

    const targetPath =
      path.split('?')[0]

    window.setTimeout(() => {
      const currentPath =
        window.location.pathname

      const arrived =
        currentPath === targetPath ||
        currentPath.startsWith(
          `${targetPath}/`
        )

      if (!arrived) {
        window.location.assign(path)
      }
    }, 700)
  }

  const handleNavigate = (path: string) => {
    vibrate([10])
    setIsOpen(false)
    navigateSafely(path)
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
    navigateSafely('/transactions/card-expense')
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
      navigateSafely('/transactions/new')
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
        className={`fixed bottom-[calc(76px+var(--safe-area-bottom))] left-4 right-4 z-[60] mx-auto max-w-md origin-bottom transition-all duration-200 ${
          isOpen
            ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto'
            : 'translate-y-3 scale-[0.97] opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="app-nav-quick-panel">
          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => {
                vibrate([10])
                setIsOpen(false)
                setQuickActionType('income')
                setQuickActionOpen(true)
              }}
              className="app-nav-quick-action"
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
              className="app-nav-quick-action"
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
              className="app-nav-quick-action"
              aria-label="Lançar cartão"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-orange-50 dark:bg-orange-950/40">
                <CreditCard size={21} className="text-orange-500 dark:text-orange-400" />
              </div>
              <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                Cartão
              </span>
            </button>

            <button type="button" onClick={() => handleNavigate('/search')} className="app-nav-quick-action" aria-label="Busca global">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-violet-50 dark:bg-violet-950/40"><Search size={21} className="text-violet-600 dark:text-violet-400" /></div><span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">Buscar</span>
            </button>

            <button
              type="button"
              onClick={handleOpenTransfer}
              className="app-nav-quick-action"
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

      <nav
        className="app-nav-shell"
        aria-label="Navegação principal"
      >
        <div className="relative mx-auto grid h-[68px] max-w-md grid-cols-5 items-center px-2">
          {tabs.slice(0, 2).map((tab) => {
            const active =
              pathname === tab.href ||
              pathname.startsWith(
                `${tab.href}/`
              )

            const Icon = tab.icon

            return (
              <button
                type="button"
                key={tab.href}
                onClick={() =>
                  handleNavigate(tab.href)
                }
                title={tab.label}
                aria-current={
                  active
                    ? 'page'
                    : undefined
                }
                className="app-nav-tab"
              >
                <div
                  className={`app-nav-tab-icon ${
                    active
                      ? 'app-nav-tab-icon-active'
                      : ''
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

          <div aria-hidden="true" />

          {tabs.slice(2).map((tab) => {
            const active =
              pathname === tab.href ||
              pathname.startsWith(
                `${tab.href}/`
              )

            const Icon = tab.icon

            return (
              <button
                type="button"
                key={tab.href}
                onClick={() =>
                  handleNavigate(tab.href)
                }
                title={tab.label}
                aria-current={
                  active
                    ? 'page'
                    : undefined
                }
                className="app-nav-tab"
              >
                <div
                  className={`app-nav-tab-icon ${
                    active
                      ? 'app-nav-tab-icon-active'
                      : ''
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

          <div className="pointer-events-none absolute left-1/2 top-0 z-[45] -translate-x-1/2 -translate-y-[38%]">
            <div className="pointer-events-auto rounded-full border border-gray-200/70 bg-gray-50 p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={handleCentralAction}
                className={`relative flex h-[56px] w-[56px] items-center justify-center rounded-full text-white shadow-[0_7px_22px_rgba(15,118,110,0.30)] transition-all duration-200 active:scale-[0.92] ${
                  !isTransactionsRoot &&
                  isOpen
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
                aria-expanded={
                  isTransactionsRoot
                    ? false
                    : isOpen
                }
              >
                <Plus size={27} />
              </button>
            </div>
          </div>
        </div>
      </nav>

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
