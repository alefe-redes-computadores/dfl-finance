// src/components/BottomNav.tsx
'use client'

import React, { useEffect, useState } from 'react'
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
  Zap,
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

  const isHome = pathname === '/home'

  // V167: atalhos e FAB não persistem entre telas.
  useEffect(() => {
    setIsOpen(false)
    setQuickActionOpen(false)
  }, [pathname])

  // V184: Escape fecha atalhos sem navegar ou alterar lancamentos.
  useEffect(() => {
    if (!isOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isOpen])

  // Visibilidade vem do hook compartilhado.
  // É a mesma fonte de verdade usada pelo AppLayout
  // pra decidir o padding-bottom. Antes essa lógica vivia só aqui dentro,
  // duplicada e sem sincronia com o layout.
  const isVisible = useBottomNavVisible()

  if (!isVisible) return null

  // V184: navegação client-side é a autoridade.
  // Não forçar reload após 700ms: páginas lentas ou transições
  // legítimas não significam falha de navegação.
  const navigateSafely = (path: string) => {
    if (pathname === path) return
    router.push(path)
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
    // V167: o botão + principal SEMPRE abre o cadastro completo.
    // Lançamento rápido é opcional e acessível apenas nos atalhos da Home.
    vibrate([15])
    setIsOpen(false)
    setQuickActionOpen(false)
    navigateSafely('/transactions/new')
  }

  return (
    <>
      {isHome && (
        <>
          {!isOpen && !quickActionOpen && (
            <button
              type="button"
              onClick={toggleMenu}
              aria-label="Abrir atalhos da Home"
              aria-expanded={isOpen}
              aria-controls="dfl-home-quick-actions"
              className="fixed bottom-[calc(92px+var(--safe-area-bottom))] left-4 z-[60] flex h-10 items-center gap-1.5 rounded-full border border-teal-600/20 bg-slate-900 px-3.5 text-[11px] font-semibold text-white shadow-lg shadow-slate-900/20 transition active:scale-95 dark:border-slate-600 dark:bg-slate-700"
            >
              <Zap size={15} aria-hidden="true" />
              Atalhos
            </button>
          )}
      <div
        className={`fixed inset-0 z-[50] bg-black/60 dark:bg-[#121414]/80 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <div
        id="dfl-home-quick-actions"
        className={`fixed bottom-[calc(76px+var(--safe-area-bottom))] left-4 right-4 z-[60] mx-auto max-w-md origin-bottom transition-all duration-200 motion-reduce:transition-none motion-reduce:transform-none ${
          isOpen
            ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto'
            : 'translate-y-3 scale-[0.97] opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="app-nav-quick-panel">
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => {
                vibrate([10])
                setIsOpen(false)
                navigateSafely('/transactions/new?type=income')
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
                navigateSafely('/transactions/new?type=expense')
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
            <button
              type="button"
              onClick={() => {
                vibrate([10])
                setIsOpen(false)
                setQuickActionType('expense')
                setQuickActionOpen(true)
              }}
              className="app-nav-quick-action"
              aria-label="Lançamento rápido opcional"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-slate-100 dark:bg-slate-700">
                <Zap size={21} className="text-slate-600 dark:text-slate-300" />
              </div>
              <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                Rápido
              </span>
            </button>
          </div>
        </div>
      </div>
        </>
      )}

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
                className="relative flex h-[56px] w-[56px] items-center justify-center rounded-full bg-teal-700 text-white shadow-[0_7px_22px_rgba(15,118,110,0.30)] transition-all duration-200 active:scale-[0.92] dark:bg-teal-600"
                aria-label="Nova transação completa"
                aria-expanded={false}
              >
                <Plus size={27} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {isHome && (
        <FAB
          isOpen={quickActionOpen}
          initialType={quickActionType}
          onClose={() => setQuickActionOpen(false)}
        />
      )}

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
