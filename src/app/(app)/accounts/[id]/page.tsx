'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, ArrowLeft, Save, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

export default function AccountDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState({ name: '', balance: 0, color: '#64748b' })

  useEffect(() => {
    if (!id) return
    async function loadAccount() {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single()
      
      if (data && !error) setAccount(data)
      setLoading(false)
    }
    loadAccount()
  }, [id])

  async function handleUpdate() {
    setLoading(true)
    const { error } = await supabase
      .from('accounts')
      .update({ name: account.name, balance: account.balance, color: account.color })
      .eq('id', id)
    
    if (!error) router.back()
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return
    setLoading(true)
    await supabase.from('accounts').delete().eq('id', id)
    router.back()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-700" size={40} />
    </div>
  )

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] p-6 font-sans">
      <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-gray-600 font-medium">
        <ArrowLeft size={20} /> Voltar
      </button>

      <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100">
        <h1 className="text-xl font-bold text-gray-800 mb-6">Detalhes da Conta</h1>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase">Nome da Conta</label>
            <input 
              className="w-full p-4 mt-1 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-teal-500"
              value={account.name} 
              onChange={e => setAccount({...account, name: e.target.value})} 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase">Saldo Inicial</label>
            <input 
              type="number"
              className="w-full p-4 mt-1 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-teal-500"
              value={account.balance} 
              onChange={e => setAccount({...account, balance: parseFloat(e.target.value)})} 
            />
          </div>

          <button 
            onClick={handleUpdate} 
            className="w-full bg-teal-700 text-white p-4 rounded-2xl font-bold flex justify-center items-center gap-2 mt-4 hover:bg-teal-800 transition"
          >
            <Save size={20} /> Salvar Alterações
          </button>

          <button 
            onClick={handleDelete} 
            className="w-full bg-red-50 text-red-500 p-4 rounded-2xl font-bold flex justify-center items-center gap-2 hover:bg-red-100 transition"
          >
            <Trash2 size={20} /> Excluir Conta
          </button>
        </div>
      </div>
    </div>
  )
}
