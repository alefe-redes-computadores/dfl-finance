'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Home, ArrowLeftRight, BarChart2, MoreHorizontal, ArrowUp, ArrowDown, CreditCard, Plus } from 'lucide-react'
import React from 'react'

const tabs = [
  { href: '/home', icon: Home, label: 'Início' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
  { href: '/analysis', icon: BarChart2, label: 'Análise' },
  { href: '/more', icon: MoreHorizontal, label: 'Mais' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)

  const handleNavigate = (path: string) => {
    setIsOpen(false)
    router.push(path)
  }

  const handleCartao = () => {
    setIsOpen(false)
    alert('💳 Funcionalidade "Despesa Cartão" em desenvolvimento. Em breve!')
  }

  return (
    <>
      {/* OVERLAY ESCURO COM DESFOQUE */}
      <div 
        className={`fixed inset-0 bg-black/80 z-40 backdrop-blur-sm transition-all duration-300 ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* MENU FLUTUANTE EM ARCO */}
      <div 
        className={`fixed bottom-[100px] left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
      >
         <div className="relative w-72 h-48">
            
            {/* RECEITA (Topo Esquerda) */}
            <button 
              onClick={() => handleNavigate('/new-transaction?type=income')}
              className={`absolute top-0 left-4 flex flex-col items-center gap-2 transition-all duration-300 delay-75 ${
                isOpen ? 'translate-y-0 scale-100' : 'translate-y-12 scale-0 opacity-0'
              }`}
            >
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
                <ArrowUp size={28} className="text-emerald-700" />
              </div>
              <span className="text-[10px] font-bold text-gray-200 uppercase tracking-widest">Receita</span>
            </button>

            {/* DESPESA CARTÃO (Topo Direita) */}
            <button 
              onClick={handleCartao}
              className={`absolute top-0 right-4 flex flex-col items-center gap-2 transition-all duration-300 delay-100 ${
                isOpen ? 'translate-y-0 scale-100' : 'translate-y-12 scale-0 opacity-0'
              }`}
            >
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl opacity-90">
                <CreditCard size={28} className="text-orange-500" />
              </div>
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Cartão</span>
            </button>

            {/* TRANSFERIR (Baixo Esquerda) */}
            <button 
              onClick={() => handleNavigate('/new-transaction?type=transfer')}
              className={`absolute bottom-4 left-0 flex flex-col items-center gap-2 transition-all duration-300 delay-150 ${
                isOpen ? 'translate-y-0 scale-100' : 'translate-y-12 scale-0 opacity-0'
              }`}
            >
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
                <ArrowLeftRight size={28} className="text-teal-700" />
              </div>
              <span className="text-[10px] font-bold text-gray-200 uppercase tracking-widest">Transferir</span>
            </button>

            {/* DESPESA (Baixo Direita) */}
            <button 
              onClick={() => handleNavigate('/new-transaction?type=expense')}
              className={`absolute bottom-4 right-0 flex flex-col items-center gap-2 transition-all duration-300 delay-200 ${
                isOpen ? 'translate-y-0 scale-100' : 'translate-y-12 scale-0 opacity-0'
              }`}
            >
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
                <ArrowDown size={28} className="text-red-600" />
              </div>
              <span className="text-[10px] font-bold text-gray-200 uppercase tracking-widest">Despesa</span>
            </button>

         </div>
      </div>

      {/* SUA BARRA DE NAVEGAÇÃO ORIGINAL */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 safe-bottom z-50">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto relative">
          {tabs.map((tab, i) => {
            const active = pathname === tab.href
            const Icon = tab.icon

            // Lógica que você tinha para adicionar o FAB central no índice 2
            if (i === 2) {
              return (
                <React.Fragment key="fab-group">
                  <div className="relative -mt-6 mx-1 z-50">
                    <button
                      onClick={toggleMenu}
                      className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 ${
                        isOpen ? 'bg-gray-800 rotate-45' : 'bg-brand-teal rotate-0'
                      }`}
                    >
                      <Plus className="text-white" size={32} strokeWidth={1.5} />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => router.push(tab.href)}
                    className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]"
                  >
                    <Icon
                      size={22}
                      className={active ? 'text-brand-teal' : 'text-gray-400 dark:text-gray-500'}
                    />
                    <span className={`text-[10px] ${active ? 'text-brand-teal font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                      {tab.label}
                    </span>
                  </button>
                </React.Fragment>
              )
            }

            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]"
              >
                <Icon
                  size={22}
                  className={active ? 'text-brand-teal' : 'text-gray-400 dark:text-gray-500'}
                />
                <span className={`text-[10px] ${active ? 'text-brand-teal font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
