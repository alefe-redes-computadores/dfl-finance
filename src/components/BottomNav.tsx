'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Home, ArrowLeftRight, BarChart2, MoreHorizontal, ArrowUp, ArrowDown, CreditCard, Plus } from 'lucide-react'
import React from 'react'
import TransferModal from './TransferModal'

const tabs = [
  { href: '/home', icon: Home, label: 'Início' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
  { href: '/analysis', icon: BarChart2, label: 'Análise' },
  { href: '/more', icon: MoreHorizontal, label: 'Mais' },
]

// Só mostra o BottomNav nas 4 abas principais
const VISIBLE_ROUTES = ['/home', '/transactions', '/analysis', '/more']

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)

  // Se a rota atual NÃO for uma das 4 abas principais, esconde o BottomNav
  if (!VISIBLE_ROUTES.some(r => pathname === r || pathname.startsWith(r + '?'))) {
    return null
  }

  const handleNavigate = (path: string) => {
    setIsOpen(false)
    router.push(path)
  }

  const handleOpenTransfer = () => {
    setIsOpen(false)
    setIsTransferModalOpen(true)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsOpen(false)
    router.push('/transactions/card-expense')
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-[50] bg-[#121414]/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      <div className={`fixed bottom-[95px] left-1/2 -translate-x-1/2 z-[60] flex justify-center w-full max-w-md pointer-events-none transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 scale-50'}`}>
         <div className="relative w-full h-full flex justify-center items-end">
            <button onClick={() => handleNavigate('/transactions/new?type=income')} className={`absolute pointer-events-auto flex flex-col items-center gap-2 transition-all duration-300 ${isOpen ? '-translate-x-[75px] -translate-y-[85px]' : 'translate-x-0 translate-y-0'}`}>
              <div className="w-[52px] h-[52px] bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-xl"><ArrowUp size={22} className="text-emerald-500" /></div>
              <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Receita</span>
            </button>

            <button onClick={handleCardClick} className={`absolute pointer-events-auto flex flex-col items-center gap-2 transition-all duration-300 delay-75 ${isOpen ? 'translate-x-[75px] -translate-y-[85px]' : 'translate-x-0 translate-y-0'}`}>
              <div className="w-[52px] h-[52px] bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-xl"><CreditCard size={22} className="text-orange-400" /></div>
              <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Cartão</span>
            </button>

            <button onClick={handleOpenTransfer} className={`absolute pointer-events-auto flex flex-col items-center gap-2 transition-all duration-300 delay-100 ${isOpen ? '-translate-x-[130px] -translate-y-[15px]' : 'translate-x-0 translate-y-0'}`}>
              <div className="w-[52px] h-[52px] bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-xl"><ArrowLeftRight size={22} className="text-teal-600" /></div>
              <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Transferir</span>
            </button>

            <button onClick={() => handleNavigate('/transactions/new?type=expense')} className={`absolute pointer-events-auto flex flex-col items-center gap-2 transition-all duration-300 delay-150 ${isOpen ? 'translate-x-[130px] -translate-y-[15px]' : 'translate-x-0 translate-y-0'}`}>
              <div className="w-[52px] h-[52px] bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-xl"><ArrowDown size={22} className="text-red-500" /></div>
              <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Despesa</span>
            </button>
         </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.2)] z-[40] pb-safe h-[68px] transition-colors duration-300">
        <div className="flex items-center justify-around h-full max-w-md mx-auto relative px-2">
          
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[50]">
            <div className="bg-[#f8f9fa] dark:bg-slate-700 p-1.5 rounded-full">
               <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative w-[56px] h-[56px] rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 ${isOpen ? 'bg-gray-800 dark:bg-slate-600 rotate-45' : 'bg-[#ea8773] rotate-0 hover:scale-105'}`}
              >
                <Plus className="text-white" size={28} />
              </button>
            </div>
          </div>

          {tabs.map((tab, i) => {
            const active = pathname === tab.href
            const Icon = tab.icon

            if (i === 1) {
              return (
                <React.Fragment key="fab-group">
                  <button
                    onClick={() => router.push(tab.href)}
                    title={tab.label}
                    className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px] group relative"
                  >
                    <Icon size={22} className={`transition-colors ${active ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                    <span className={`text-[10px] ${active ? 'text-gray-800 dark:text-gray-200 font-bold' : 'text-gray-400 dark:text-gray-500 font-medium'}`}>{tab.label}</span>
                    <span className="absolute -top-8 bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900 text-xs rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      {tab.label}
                    </span>
                  </button>
                  <div className="w-[72px]" />
                </React.Fragment>
              )
            }

            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                title={tab.label}
                className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px] group relative"
              >
                <Icon size={22} className={`transition-colors ${active ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                <span className={`text-[10px] ${active ? 'text-gray-800 dark:text-gray-200 font-bold' : 'text-gray-400 dark:text-gray-500 font-medium'}`}>{tab.label}</span>
                <span className="absolute -top-8 bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900 text-xs rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
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
        onComplete={() => { if (pathname === '/home') window.location.reload() }}
      />
    </>
  )
}