'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Wallet, Tags, ChevronRight, LogOut, Camera, Check, Edit2, Bot, Lock, CreditCard, Hash, PieChart, Target, TrendingUp, Users, BarChart2 } from 'lucide-react'

export default function MorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const isGoogleLogin = user?.app_metadata?.provider === 'google'

  useEffect(() => { if (user) setName(user.user_metadata?.full_name || '') }, [user])

  const saveName = async () => {
    await supabase.auth.updateUser({ data: { full_name: name } })
    setIsEditing(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 px-5 pt-8">
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
      <h1 className="text-2xl font-bold mb-6">Mais</h1>
      <div className="bg-gradient-to-r from-teal-700 to-orange-500 rounded-2xl p-4 mb-8 text-white shadow-lg"><h3 className="font-bold">DFL Finance Pro</h3><p className="text-xs text-teal-50">Sem limites e relatórios avançados</p></div>
      <div className="bg-white p-4 rounded-2xl flex items-center gap-4 mb-8 shadow-sm border">
        <img src={user?.user_metadata?.avatar_url || '/avatar.png'} className="w-16 h-16 rounded-full" />
        <div className="flex-1">
          {isEditing ? <div className="flex items-center gap-2"><input value={name} onChange={e => setName(e.target.value)} className="bg-gray-100 p-1 rounded" /><button onClick={saveName}><Check size={16}/></button></div> : <div className="flex items-center gap-2"><h2 className="font-bold text-lg">{name}</h2>{!isGoogleLogin && <button onClick={() => setIsEditing(true)}><Edit2 size={14}/></button>}</div>}
          <p className="text-gray-500 text-sm">{user?.email}</p>
        </div>
      </div>
      <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">Organizar</h4>
      <div className="bg-white rounded-2xl shadow-sm border mb-6">
        <Link href="/accounts" className="flex items-center justify-between p-4 border-b"><div className="flex items-center gap-3"><Wallet className="text-teal-700" /> Contas</div><ChevronRight /></Link>
        <Link href="/categories" className="flex items-center justify-between p-4"><div className="flex items-center gap-3"><Tags className="text-teal-700" /> Categorias</div><ChevronRight /></Link>
      </div>
      <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">No forno</h4>
      <div className="bg-white rounded-2xl shadow-sm border opacity-70">
        {[ {icon: CreditCard, title: 'Cartões'}, {icon: Hash, title: 'Tags'}, {icon: PieChart, title: 'Orçamento'}, {icon: Target, title: 'Metas'}, {icon: TrendingUp, title: 'Projeções'}, {icon: Users, title: 'Assinaturas'}, {icon: BarChart2, title: 'Relatórios'} ].map((item, i) => (
          <button key={i} onClick={() => setModalOpen(true)} className="w-full flex items-center justify-between p-4 border-b last:border-0">
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><item.icon size={16} /></div><span className="font-medium text-sm">{item.title}</span></div>
            <Lock size={14} />
          </button>
        ))}
      </div>
      <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="w-full mt-6 flex items-center justify-center gap-2 p-4 text-red-600 font-bold"><LogOut size={18} /> Sair</button>
    </div>
  )
}
