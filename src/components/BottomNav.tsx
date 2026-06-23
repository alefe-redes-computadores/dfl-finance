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

const HIDDEN_ROUTES = ['/new-transaction', '/accounts', '/categories', '/cards/new']

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)

  if (HIDDEN_ROUTES.some(r => pathname.startsWith(r))) return null

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
    alert("Função de Despesa no Cartão em desenvolvimento!")
    setIsOpen(false)
  }

  return (
    <>
      {/* Overlay Escurecido (Z-50) - Cobre toda a tela, inclusive a barra branca */}
      <div
        className={`fixed inset-0 z-50 bg-[#121414]/80 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Container Z-60: Fica por cima do Overlay. Garante que o botão não afunde! */}
      <div className="fixed bottom-0 left-0 w-full z-60 pointer-events-none pb-safe flex flex-col items-center">
        
        {/* O Arco de Botões (Ancorado a 80px do fundo) */}
        <div className={`absolute bottom-[80px] w-full flex justify-center transition-all duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none scale-50'}`}>
          <button onClick={() => handleNavigate('/transactions/new?type=income')} className={`absolute flex flex-col items-center gap-2 transition-all duration-300 ${isOpen ? '-translate-x-[68px] -translate-y-[85px]' : 'translate-x-0 translate-y-0'}`}>
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl"><ArrowUp size={24} className="text-emerald-500" /></div>
            <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Receita</span>
          </button>

          <button onClick={handleCardClick} className={`absolute flex flex-col items-center gap-2 transition-all duration-300 delay-75 ${isOpen ? 'translate-x-[68px] -translate-y-[85px]' : 'translate-x-0 translate-y-0'}`}>
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl"><CreditCard size={24} className="text-orange-400" /></div>
            <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Desp. Cartão</span>
          </button>

          <button onClick={handleOpenTransfer} className={`absolute flex flex-col items-center gap-2 transition-all duration-300 delay-100 ${isOpen ? '-translate-x-[115px] -translate-y-[15px]' : 'translate-x-0 translate-y-0'}`}>
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl"><ArrowLeftRight size={24} className="text-teal-600" /></div>
            <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Transferir</span>
          </button>

          <button onClick={() => handleNavigate('/transactions/new?type=expense')} className={`absolute flex flex-col items-center gap-2 transition-all duration-300 delay-150 ${isOpen ? 'translate-x-[115px] -translate-y-[15px]' : 'translate-x-0 translate-y-0'}`}>
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl"><ArrowDown size={24} className="text-red-500" /></div>
            <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap drop-shadow-md">Despesa</span>
          </button>
        </div>

        {/* Botão Central (+) - Com margin-bottom para se encaixar na barra branca perfeitamente */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`mb-[10px] w-[56px] h-[56px] rounded-full flex items-center justify-center shadow-lg transition-all duration-300 pointer-events-auto border-4 ${isOpen ? 'bg-gray-800 rotate-45 border-transparent' : 'bg-teal-700 rotate-0 border-white'}`}
        >
          <Plus className="text-white" size={28} />
        </button>
      </div>

      {/* Barra Branca de Navegação (Z-40) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 pb-safe">
        <div className="flex items-center justify-around px-2 h-[64px] max-w-md mx-auto relative">
          {tabs.map((tab, i) => {
            const active = pathname === tab.href
            const Icon = tab.icon

            if (i === 1) {
              return (
                <React.Fragment key="fab-group">
                  <button onClick={() => router.push(tab.href)} className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]">
                    <Icon size={22} className={active ? 'text-teal-700' : 'text-gray-400'} />
                    <span className={`text-[10px] ${active ? 'text-teal-700 font-bold' : 'text-gray-400 font-medium'}`}>{tab.label}</span>
                  </button>
                  {/* Espaço vazio onde o botão flutuante se encaixa */}
                  <div className="w-[60px]" />
                </React.Fragment>
              )
            }

            return (
              <button key={tab.href} onClick={() => router.push(tab.href)} className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]">
                <Icon size={22} className={active ? 'text-teal-700' : 'text-gray-400'} />
                <span className={`text-[10px] ${active ? 'text-teal-700 font-bold' : 'text-gray-400 font-medium'}`}>{tab.label}</span>
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
