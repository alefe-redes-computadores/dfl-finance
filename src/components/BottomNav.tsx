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
  const [isCartaoModalOpen, setIsCartaoModalOpen] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)

  const handleNavigate = (path: string) => {
    setIsOpen(false)
    router.push(path)
  }

  const handleCartao = () => {
    setIsOpen(false)
    setIsCartaoModalOpen(true)
  }

  return (
    <>
      {/* 1. OVERLAY ESCURO COM DESFOQUE PARA O MENU FLUTUANTE */}
      <div 
        className={`fixed inset-0 bg-[#1a1a1a]/95 z-40 backdrop-blur-sm transition-all duration-300 ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* 2. BOTÕES FLUTUANTES EM ARCO MATEMÁTICO PERFEITO */}
      {/* O ponto de origem (w-0 h-0) fica exatemente no centro do FAB */}
      <div className="fixed bottom-[40px] left-1/2 z-50 w-0 h-0 flex items-center justify-center pointer-events-none">
         
         {/* RECEITA (Topo Esquerda - Ângulo de ~110 graus) */}
         <button 
           onClick={() => handleNavigate('/new-transaction?type=income')}
           className={`absolute flex flex-col items-center gap-2 transition-all duration-300 ease-out pointer-events-auto ${
             isOpen ? '-translate-x-[60px] -translate-y-[135px] scale-100 opacity-100 delay-75' : 'translate-x-0 translate-y-0 scale-50 opacity-0'
           }`}
         >
           <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
             <ArrowUp size={28} className="text-emerald-700" />
           </div>
           <span className="text-[10px] font-bold text-gray-200 uppercase tracking-widest">Receita</span>
         </button>

         {/* DESPESA CARTÃO (Topo Direita - Ângulo de ~70 graus) */}
         <button 
           onClick={handleCartao}
           className={`absolute flex flex-col items-center gap-2 transition-all duration-300 ease-out pointer-events-auto ${
             isOpen ? 'translate-x-[60px] -translate-y-[135px] scale-100 opacity-100 delay-100' : 'translate-x-0 translate-y-0 scale-50 opacity-0'
           }`}
         >
           <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
             <CreditCard size={28} className="text-orange-500" />
           </div>
           <span className="text-[10px] font-bold text-gray-200 uppercase tracking-widest">Cartão</span>
         </button>

         {/* TRANSFERIR (Baixo Esquerda - Ângulo de ~150 graus) */}
         <button 
           onClick={() => handleNavigate('/new-transaction?type=transfer')}
           className={`absolute flex flex-col items-center gap-2 transition-all duration-300 ease-out pointer-events-auto ${
             isOpen ? '-translate-x-[120px] -translate-y-[60px] scale-100 opacity-100 delay-150' : 'translate-x-0 translate-y-0 scale-50 opacity-0'
           }`}
         >
           <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
             <ArrowLeftRight size={28} className="text-teal-700" />
           </div>
           <span className="text-[10px] font-bold text-gray-200 uppercase tracking-widest">Transferir</span>
         </button>

         {/* DESPESA (Baixo Direita - Ângulo de ~30 graus) */}
         <button 
           onClick={() => handleNavigate('/new-transaction?type=expense')}
           className={`absolute flex flex-col items-center gap-2 transition-all duration-300 ease-out pointer-events-auto ${
             isOpen ? 'translate-x-[120px] -translate-y-[60px] scale-100 opacity-100 delay-200' : 'translate-x-0 translate-y-0 scale-50 opacity-0'
           }`}
         >
           <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
             <ArrowDown size={28} className="text-red-600" />
           </div>
           <span className="text-[10px] font-bold text-gray-200 uppercase tracking-widest">Despesa</span>
         </button>
      </div>

      {/* 3. MODAL BONITINHO DO CARTÃO DE CRÉDITO */}
      {isCartaoModalOpen && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setIsCartaoModalOpen(false)}
        >
          <div 
            className="bg-white p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 duration-200" 
            onClick={e => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-100">
              <CreditCard size={32} className="text-orange-500" />
            </div>
            <h3 className="font-bold text-xl mb-2 text-gray-800">Saindo do forno!</h3>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              A funcionalidade de <b>Despesa no Cartão</b> está sendo preparada com muito capricho para o DFL Finance. Em breve você poderá lançar suas faturas!
            </p>
            <button 
              onClick={() => setIsCartaoModalOpen(false)} 
              className="w-full bg-emerald-900 hover:bg-emerald-800 text-white py-3.5 rounded-xl font-bold transition-colors shadow-md"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* 4. SUA BARRA DE NAVEGAÇÃO ORIGINAL */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 safe-bottom z-50">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto relative">
          {tabs.map((tab, i) => {
            const active = pathname === tab.href
            const Icon = tab.icon

            if (i === 2) {
              return (
                <React.Fragment key="fab-group">
                  {/* O BOTÃO FAB (MAIS) */}
                  <div className="relative -mt-6 mx-1 z-50">
                    <button
                      onClick={toggleMenu}
                      className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 ${
                        isOpen ? 'bg-[#1a1a1a] rotate-45' : 'bg-brand-teal rotate-0'
                      }`}
                    >
                      <Plus className={isOpen ? 'text-gray-400' : 'text-white'} size={32} strokeWidth={1.5} />
                    </button>
                  </div>
                  
                  {/* ÍCONE DA POSIÇÃO 2 */}
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
