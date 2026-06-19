'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Wallet, CreditCard, Tags, Hash, PieChart, Target, TrendingUp, Users, BarChart2, Bot, ChevronRight, Camera, Edit2, Check, X, LogOut, Lock } from 'lucide-react'

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
      setAvatarUrl(user.user_metadata?.avatar_url || '')
      setDisplayName(user.user_metadata?.full_name || 'Usuário')
      setNameInput(user.user_metadata?.full_name || 'Usuário')
    }
  }, [user])

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !user) return
    const filePath = `${user.id}-${Date.now()}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
    if (!uploadError) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } })
      setAvatarUrl(data.publicUrl)
    }
  }

  const saveName = async () => {
    await supabase.auth.updateUser({ data: { full_name: nameInput } })
    setDisplayName(nameInput)
    setIsEditingName(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

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
      
      <div className="bg-white p-4 rounded-2xl flex items-center gap-4 mb-8 shadow-sm border">
        <label className="cursor-pointer relative">
          <img src={avatarUrl || '/avatar.png'} className="w-16 h-16 rounded-full" />
          <input type="file" className="hidden" onChange={handleAvatarUpload} />
          <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center opacity-0 hover:opacity-100"><Camera size={18} className="text-white" /></div>
        </label>
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="bg-gray-100 p-1 rounded" />
              <button onClick={saveName}><Check size={16} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg">{displayName}</h2>
              <button onClick={() => setIsEditingName(true)}><Edit2 size={14} /></button>
            </div>
          )}
          <p className="text-gray-500 text-sm">{user?.email}</p>
        </div>
      </div>

      <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">Menu Principal</h4>
      <div className="bg-white rounded-2xl shadow-sm border mb-6">
        <Link href="/accounts" className="flex items-center justify-between p-4 border-b"><div className="flex items-center gap-3"><Wallet className="text-teal-700" /> Contas</div><ChevronRight /></Link>
        <Link href="/categories" className="flex items-center justify-between p-4"><div className="flex items-center gap-3"><Tags className="text-teal-700" /> Categorias</div><ChevronRight /></Link>
      </div>

      <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">No forno</h4>
      <div className="bg-white rounded-2xl shadow-sm border opacity-70">
        {[CreditCard, Hash, PieChart, Target, TrendingUp, Users, BarChart2].map((Icon, i) => (
          <button key={i} onClick={() => setModalOpen(true)} className="w-full flex items-center justify-between p-4 border-b last:border-0">
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><Icon size={16} /></div><span className="font-medium text-sm">Função {i+1}</span></div>
            <Lock size={14} />
          </button>
        ))}
      </div>

      <button onClick={handleLogout} className="w-full mt-6 flex items-center justify-center gap-2 p-4 text-red-600 font-bold"><LogOut size={18} /> Sair da conta</button>
    </div>
  )
}
