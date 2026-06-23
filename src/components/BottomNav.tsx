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

  // Oculta a BottomNav em rotas específicas
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
      {/* Overlay Escurecido com Blur */}
      <div
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-md transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Container Base Flutuante para os botões do Arco */}
      {/* Posicionado exatamente no centro inferior da tela, logo acima do '+' */}
      <div className={`fixed bottom-[100px] left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none scale-50'}`}>
        
        {/* RECEITA — Arco Cima Esquerda */}
        <button
          onClick={() => handleNavigate('/transactions/new?type=income')}
          className={`absolute flex flex-col items-center gap-2 transition-all duration-300 ${isOpen ? '-translate-x-[75px] -translate-y-[100px]' : 'translate-x-0 translate-y-0'}`}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
            <ArrowUp size={24} className="text-emerald-500" />
          </div>
          <span className="text-[11px] font-bold text-white tracking-wide">Receita</span>
        </button>

        {/* CARTÃO — Arco Cima Direita */}
        <button
          onClick={handleCardClick}
          className={`absolute flex flex-col items-center gap-2 transition-all duration-300 delay-75 ${isOpen ? 'translate-x-[75px] -translate-y-[100px]' : 'translate-x-0 translate-y-0'}`}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
            <CreditCard size={24} className="text-orange-400" />
          </div>
          <span className="text-[11px] font-bold text-white tracking-wide whitespace-nowrap">Desp. Cartão</span>
        </button>

        {/* TRANSFERIR — Arco Baixo Esquerda */}
        <button
          onClick={handleOpenTransfer}
          className={`absolute flex flex-col items-center gap-2 transition-all duration-300 delay-100 ${isOpen ? '-translate-x-[105px] -translate-y-[20px]' : 'translate-x-0 translate-y-0'}`}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
            <ArrowLeftRight size={24} className="text-teal-600" />
          </div>
          <span className="text-[11px] font-bold text-white tracking-wide">Transferir</span>
        </button>

        {/* DESPESA — Arco Baixo Direita */}
        <button
          onClick={() => handleNavigate('/transactions/new?type=expense')}
          className={`absolute flex flex-col items-center gap-2 transition-all duration-300 delay-150 ${isOpen ? 'translate-x-[105px] -translate-y-[20px]' : 'translate-x-0 translate-y-0'}`}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
            <ArrowDown size={24} className="text-red-500" />
          </div>
          <span className="text-[11px] font-bold text-white tracking-wide">Despesa</span>
        </button>
      </div>

      {/* Barra de Navegação Inferior Principal */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-safe">
        <div className="flex items-center justify-around px-2 py-2 max-w-md mx-auto">
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

                  {/* Botão Central (+) Flutuante */}
                  <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`relative z-50 w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 -mt-8 border-4 border-white ${isOpen ? 'bg-gray-800 rotate-45' : 'bg-teal-700 rotate-0'}`}
                  >
                    <Plus className="text-white" size={28} />
                  </button>
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

      {/* Modal Global de Transferência */}
      <TransferModal 
        isOpen={isTransferModalOpen} 
        onClose={() => setIsTransferModalOpen(false)} 
        onComplete={() => {
          // Opcional: Recarregar dados se estiver na Home
          if (pathname === '/home') {
            window.location.reload();
          }
        }}
      />
    </>
  )
}
