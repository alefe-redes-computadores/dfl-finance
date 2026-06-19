'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Wallet, CreditCard, Tags, Hash, PieChart, Target, TrendingUp, Users, BarChart2, Bot, ChevronRight, Camera, Edit2, Check, X, Lock } from 'lucide-react'

export default function MorePage() {
  const [modalOpen, setModalOpen] = useState(false)

  const functions = [
    { icon: CreditCard, title: 'Investimentos' },
    { icon: Hash, title: 'Relatórios' },
    { icon: PieChart, title: 'Configurações' },
    { icon: Target, title: 'Segurança' },
    { icon: TrendingUp, title: 'Notificações' },
    { icon: Users, title: 'Suporte' },
    { icon: BarChart2, title: 'Ajuda' }
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="bg-white p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4"><Bot size={32} className="text-teal-700" /></div>
            <h3 className="font-bold text-lg mb-2">Saindo do forno!</h3>
            <p className="text-gray-500 mb-6 text-sm">Estamos preparando essa função com muito capricho.</p>
            <button onClick={() => setModalOpen(false)} className="w-full bg-teal-800 text-white py-3 rounded-xl font-bold">Entendido</button>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-5 pt-8">
        <h1 className="text-2xl font-semibold mb-6">Mais</h1>
        
        <div className="bg-gradient-to-r from-teal-700 to-orange-500 rounded-2xl p-4 mb-8 text-white flex items-center justify-between shadow-lg">
          <div><h3 className="font-bold">DFL Finance Pro</h3><p className="text-xs text-teal-50">Sem limites e relatórios avançados</p></div>
          <button className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">Ver</button>
        </div>

        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">Menu Principal</h4>
        <div className="bg-white rounded-2xl shadow-sm border mb-6">
          <Link href="/accounts" className="flex items-center justify-between p-4 border-b hover:bg-gray-50"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center"><Wallet size={16} className="text-teal-700" /></div><span className="font-medium text-sm">Contas</span></div><ChevronRight size={16} /></Link>
          <Link href="/categories" className="flex items-center justify-between p-4 hover:bg-gray-50"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center"><Tags size={16} className="text-teal-700" /></div><span className="font-medium text-sm">Categorias</span></div><ChevronRight size={16} /></Link>
        </div>

        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">No forno</h4>
        <div className="bg-white rounded-2xl shadow-sm border opacity-70">
          {functions.map((item, i) => (
            <button key={i} onClick={() => setModalOpen(true)} className="w-full flex items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><item.icon size={16} className="text-gray-500" /></div><span className="font-medium text-sm text-gray-600">{item.title}</span></div>
              <Lock size={14} className="text-gray-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
