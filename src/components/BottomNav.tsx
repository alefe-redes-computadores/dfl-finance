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
        className={`fixed bottom-[95px] left-1/2 -translate-x-1/2 z-[60] flex justify-center w-full max-w-md pointer-events-none transition-all duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 scale-50'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="relative w-full h-full flex justify-center items-end">
          <button
            type="button"
            onClick={() => handleNavigate('/transactions/new?type=income')}
            className={`absolute pointer-events-auto flex flex-col items-center gap-2 transition-all duration-300 active:scale-[0.95] ${
              isOpen ? '-translate-x-[75px] -translate-y-[85px]' : 'translate-x-0 translate-y-0'
            }`}
            aria-label="Nova receita"
          >
            <div className="w-[52px] h-[52px] bg-white dark:bg-slate-800 rounded-[20px] flex items-center justify-center shadow-lg">
              <ArrowUp size={24} className="text-emerald-500" />
            </div>
            <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Receita</span>
          </button>

          <button
            type="button"
            onClick={handleCardClick}
            className={`absolute pointer-events-auto flex flex-col items-center gap-2 transition-all duration-300 delay-75 active:scale-[0.95] ${
              isOpen ? 'translate-x-[75px] -translate-y-[85px]' : 'translate-x-0 translate-y-0'
            }`}
            aria-label="Lançar cartão"
          >
            <div className="w-[52px] h-[52px] bg-white dark:bg-slate-800 rounded-[20px] flex items-center justify-center shadow-lg">
              <CreditCard size={24} className="text-orange-400" />
            </div>
            <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Cartão</span>
          </button>

          <button
            type="button"
            onClick={handleOpenTransfer}
            className={`absolute pointer-events-auto flex flex-col items-center gap-2 transition-all duration-300 delay-100 active:scale-[0.95] ${
              isOpen ? '-translate-x-[130px] -translate-y-[15px]' : 'translate-x-0 translate-y-0'
            }`}
            aria-label="Transferir"
          >
            <div className="w-[52px] h-[52px] bg-white dark:bg-slate-800 rounded-[20px] flex items-center justify-center shadow-lg">
              <ArrowLeftRight size={24} className="text-teal-600" />
            </div>
            <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Transferir</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('/transactions/new?type=expense')}
            className={`absolute pointer-events-auto flex flex-col items-center gap-2 transition-all duration-300 delay-150 active:scale-[0.95] ${
              isOpen ? 'translate-x-[130px] -translate-y-[15px]' : 'translate-x-0 translate-y-0'
            }`}
            aria-label="Nova despesa"
          >
            <div className="w-[52px] h-[52px] bg-white dark:bg-slate-800 rounded-[20px] flex items-center justify-center shadow-lg">
              <ArrowDown size={24} className="text-red-500" />
            </div>
            <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Despesa</span>
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-[0_-8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.2)] z-[40] pb-safe h-[68px] transition-colors duration-300">
        <div className="flex items-center justify-around h-full max-w-md mx-auto relative px-2">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[45]">
            <div className="bg-[#f8f9fa] dark:bg-slate-900 p-1.5 rounded-full">
              <button
                type="button"
                onClick={toggleMenu}
                className={`relative w-[56px] h-[56px] rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 active:scale-[0.90] ${
                  isOpen ? 'bg-gray-800 dark:bg-slate-600 rotate-45' : 'bg-teal-700 rotate-0'
                }`}
                aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={isOpen}
              >
                <Plus className="text-white" size={28} />
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
                    className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px] group relative active:scale-[0.95] transition-transform"
                  >
                    <Icon size={22} className={active ? 'text-teal-700 dark:text-teal-400' : 'text-gray-400 dark:text-gray-500'} />
                    <span className={active ? 'text-teal-700 dark:text-teal-400 font-bold text-[10px]' : 'text-gray-400 dark:text-gray-500 font-medium text-[10px]'}>
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
                className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px] group relative active:scale-[0.95] transition-transform"
              >
                <Icon size={22} className={active ? 'text-teal-700 dark:text-teal-400' : 'text-gray-400 dark:text-gray-500'} />
                <span className={active ? 'text-teal-700 dark:text-teal-400 font-bold text-[10px]' : 'text-gray-400 dark:text-gray-500 font-medium text-[10px]'}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

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
