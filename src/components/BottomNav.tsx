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

const HIDDEN_ROUTES = ['/new-transaction']

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isCartaoModal, setIsCartaoModal] = useState(false)

  if (HIDDEN_ROUTES.some(r => pathname.startsWith(r))) return null

  const toggleMenu = () => setIsOpen(!isOpen)

  const handleNavigate = (path: string) => {
    setIsOpen(false)
    router.push(path)
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-all duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Botões flutuantes */}
      <div className="fixed bottom-[52px] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        {/* RECEITA */}
        <button
          onClick={() => handleNavigate('/new-transaction?type=income')}
          className={`absolute flex flex-col items-center gap-1.5 pointer-events-auto transition-all duration-300 ease-out ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}
          style={{ transform: isOpen ? 'translate(-70px, -140px) scale(1)' : 'translate(0,0) scale(0.5)' }}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
            <ArrowUp size={26} className="text-emerald-700" />
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Receita</span>
        </button>

        {/* DESPESA CARTÃO */}
        <button
          onClick={() => { setIsOpen(false); setIsCartaoModal(true) }}
          className={`absolute flex flex-col items-center gap-1.5 pointer-events-auto transition-all duration-300 ease-out ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}
          style={{ transform: isOpen ? 'translate(70px, -140px) scale(1)' : 'translate(0,0) scale(0.5)' }}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
            <CreditCard size={26} className="text-orange-500" />
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Cartão</span>
        </button>

        {/* TRANSFERIR */}
        <button
          onClick={() => handleNavigate('/new-transaction?type=transfer')}
          className={`absolute flex flex-col items-center gap-1.5 pointer-events-auto transition-all duration-300 ease-out ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}
          style={{ transform: isOpen ? 'translate(-130px, -70px) scale(1)' : 'translate(0,0) scale(0.5)' }}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
            <ArrowLeftRight size={26} className="text-teal-700" />
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Transferir</span>
        </button>

        {/* DESPESA */}
        <button
          onClick={() => handleNavigate('/new-transaction?type=expense')}
          className={`absolute flex flex-col items-center gap-1.5 pointer-events-auto transition-all duration-300 ease-out ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}
          style={{ transform: isOpen ? 'translate(130px, -70px) scale(1)' : 'translate(0,0) scale(0.5)' }}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
            <ArrowDown size={26} className="text-red-600" />
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Despesa</span>
        </button>
      </div>

      {/* Modal cartão */}
      {isCartaoModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsCartaoModal(false)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl mb-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <CreditCard size={28} className="text-orange-500" />
            </div>
            <h3 className="font-bold text-lg mb-1 text-gray-800">Em breve!</h3>
            <p className="text-gray-500 text-sm mb-5 leading-relaxed">
              A funcionalidade de <b>Despesa no Cartão</b> está sendo preparada. Em breve disponível no DFL Finance!
            </p>
            <button
              onClick={() => setIsCartaoModal(false)}
              className="w-full bg-brand-teal text-white py-3 rounded-xl font-bold"
            >
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
                    key={tab.href}
                    onClick={() => router.push(tab.href)}
                    className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]"
                  >
                    <Icon size={22} className={active ? 'text-brand-teal' : 'text-gray-400'} />
                    <span className={`text-[10px] ${active ? 'text-brand-teal font-medium' : 'text-gray-400'}`}>{tab.label}</span>
                  </button>

                  {/* FAB */}
                  <button
                    onClick={toggleMenu}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 -mt-5 ${isOpen ? 'bg-zinc-900 rotate-45' : 'bg-brand-teal'}`}
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