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

const HIDDEN_ROUTES = ['/new-transaction', '/accounts', '/categories']

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isCartaoModal, setIsCartaoModal] = useState(false)

  if (HIDDEN_ROUTES.some(r => pathname.startsWith(r))) return null

  const handleNavigate = (path: string) => {
    setIsOpen(false)
    router.push(path)
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Botões flutuantes — posicionamento absoluto a partir do centro da tela */}
      <div
        className={`fixed inset-0 z-50 pointer-events-none transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* RECEITA — cima esquerda */}
        <button
          onClick={() => handleNavigate('/new-transaction?type=income')}
          className={`pointer-events-auto absolute flex flex-col items-center gap-1.5 transition-all duration-300 ${isOpen ? 'scale-100' : 'scale-50'}`}
          style={{ bottom: '110px', left: 'calc(50% - 110px)' }}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-2xl">
            <ArrowUp size={26} className="text-emerald-700" />
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Receita</span>
        </button>

        {/* CARTÃO — cima direita: Corrigido para navegar para a nova rota */}
        <button
          onClick={() => handleNavigate('/cards/new')}
          className={`pointer-events-auto absolute flex flex-col items-center gap-1.5 transition-all duration-300 delay-75 ${isOpen ? 'scale-100' : 'scale-50'}`}
          style={{ bottom: '110px', left: 'calc(50% + 40px)' }}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-2xl">
            <CreditCard size={26} className="text-orange-500" />
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Cartão</span>
        </button>

        {/* TRANSFERIR — baixo esquerda */}
        <button
          onClick={() => handleNavigate('/new-transaction?type=transfer')}
          className={`pointer-events-auto absolute flex flex-col items-center gap-1.5 transition-all duration-300 delay-100 ${isOpen ? 'scale-100' : 'scale-50'}`}
          style={{ bottom: '34px', left: 'calc(50% - 175px)' }}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-2xl">
            <ArrowLeftRight size={26} className="text-teal-700" />
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Transferir</span>
        </button>

        {/* DESPESA — baixo direita */}
        <button
          onClick={() => handleNavigate('/new-transaction?type=expense')}
          className={`pointer-events-auto absolute flex flex-col items-center gap-1.5 transition-all duration-300 delay-150 ${isOpen ? 'scale-100' : 'scale-50'}`}
          style={{ bottom: '34px', left: 'calc(50% + 105px)' }}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-2xl">
            <ArrowDown size={26} className="text-red-600" />
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Despesa</span>
        </button>
      </div>

      {/* Modal cartão em breve (Mantido intacto) */}
      {isCartaoModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsCartaoModal(false)}
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl mb-4" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <CreditCard size={28} className="text-orange-500" />
            </div>
            <h3 className="font-bold text-lg mb-1 text-gray-800">Em breve!</h3>
            <p className="text-gray-500 text-sm mb-5 leading-relaxed">
              A funcionalidade de <b>Despesa no Cartão</b> está sendo preparada com capricho para o DFL Finance!
            </p>
            <button onClick={() => setIsCartaoModal(false)} className="w-full bg-brand-teal text-white py-3 rounded-xl font-bold">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Barra de navegação */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 z-50">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {tabs.map((tab, i) => {
            const active = pathname === tab.href
            const Icon = tab.icon

            if (i === 1) {
              return (
                <React.Fragment key="fab-group">
                  <button
                    onClick={() => router.push(tab.href)}
                    className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]"
                  >
                    <Icon size={22} className={active ? 'text-brand-teal' : 'text-gray-400'} />
                    <span className={`text-[10px] ${active ? 'text-brand-teal font-medium' : 'text-gray-400'}`}>{tab.label}</span>
                  </button>

                  <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 -mt-5 ${isOpen ? 'bg-zinc-900 rotate-45' : 'bg-brand-teal rotate-0'}`}
                  >
                    <Plus className={isOpen ? 'text-gray-400' : 'text-white'} size={30} />
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
                <Icon size={22} className={active ? 'text-brand-teal' : 'text-gray-400'} />
                <span className={`text-[10px] ${active ? 'text-brand-teal font-medium' : 'text-gray-400'}`}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
