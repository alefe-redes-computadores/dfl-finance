'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Wallet, CreditCard, Tags, Hash, PieChart, Target, TrendingUp, RefreshCw, Landmark, Users, FileText, BarChart2, Bot, ScanLine, FileDown, Settings, ChevronRight, Moon, Sun, Camera, Edit2, Check, X, LogOut, Lock } from 'lucide-react'

export default function MorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [displayName, setDisplayName] = useState('Usuário')
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture || '')
      setDisplayName(user.user_metadata?.full_name || 'Usuário')
      setNameInput(user.user_metadata?.full_name || 'Usuário')
    }
  }, [user])

  const menuAtivos = [
    { icon: Wallet, label: 'Contas', href: '/accounts' },
    { icon: Tags, label: 'Categorias', href: '/categories' },
  ]

  const menuEmBreve = [
    { icon: CreditCard, label: 'Cartões de Crédito' },
    { icon: Hash, label: 'Tags' },
    { icon: PieChart, label: 'Orçamento' },
    { icon: Target, label: 'Metas' },
    { icon: TrendingUp, label: 'Projeções' },
    { icon: Users, label: 'Quem me deve', isPro: true },
    { icon: BarChart2, label: 'Relatórios Pro', isPro: true },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-brand-teal/10 rounded-full flex items-center justify-center mx-auto mb-4"><Bot size={32} className="text-brand-teal" /></div>
            <h3 className="font-bold text-lg mb-2">Saindo do forno!</h3>
            <p className="text-gray-500 mb-6 text-sm">Estamos preparando essa função com muito capricho.</p>
            <button onClick={() => setModalOpen(false)} className="w-full bg-brand-teal text-white py-3 rounded-xl font-bold">Entendido</button>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-5 pt-8">
        <h1 className="text-2xl font-semibold mb-6">Mais</h1>
        
        <div className="bg-gradient-to-r from-teal-700 to-orange-500 rounded-2xl p-4 mb-8 text-white flex items-center justify-between">
          <div><h3 className="font-bold">DFL Finance Pro</h3><p className="text-xs text-teal-50">Sem limites e relatórios avançados</p></div>
          <button className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">Ver</button>
        </div>

        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">Menu Principal</h4>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border mb-6">
          {menuAtivos.map((item, i) => (
            <Link key={i} href={item.href!} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center"><item.icon size={16} className="text-brand-teal" /></div><span className="font-medium text-sm">{item.label}</span></div>
              <ChevronRight size={16} className="text-gray-300" />
            </Link>
          ))}
        </div>

        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">No forno</h4>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border opacity-70">
          {menuEmBreve.map((item, i) => (
            <button key={i} onClick={() => setModalOpen(true)} className="w-full flex items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><item.icon size={16} className="text-gray-500" /></div><span className="font-medium text-sm text-gray-600">{item.label}</span></div>
              {item.isPro ? <span className="text-[10px] font-bold text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full">PRO</span> : <Lock size={14} className="text-gray-300" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
