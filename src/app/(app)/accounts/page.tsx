'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [accounts, setAccounts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [name, setName] = useState('')
  const [rawBalance, setRawBalance] = useState('')

  useEffect(() => {
    if (user) loadAccounts()
  }, [user])

  async function loadAccounts() {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
    setAccounts(data ?? [])
  }

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawBalance(e.target.value.replace(/\D/g, ''))
  }

  const formatDisplay = (value: string) => {
    const num = parseInt(value || '0', 10) / 100
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  async function handleSave() {
    if (!name || !user) return
    const numericBalance = parseInt(rawBalance || '0', 10) / 100
    
    const { error } = await supabase.from('accounts').insert({
      user_id: user.id,
      name: name,
      bank_slug: 'carteira',
      balance: numericBalance,
      context: context
    })

    if (error) {
      alert("Erro ao salvar: " + error.message)
    } else {
      setName('')
      setRawBalance('')
      setShowForm(false)
      loadAccounts()
    }
  }

  async function handleDelete(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    loadAccounts()
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-20">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()}><ChevronLeft size={24} /></button>
        <h1 className="text-xl font-bold">Contas</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-brand-teal text-white p-2 rounded-full shadow-lg">
          <Plus size={24} />
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-zinc-800 mb-6">
          <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-full mb-4">
            <button onClick={() => setContext('dfl')} className={`flex-1 py-2 rounded-full font-bold text-sm ${context === 'dfl' ? 'bg-white shadow' : ''}`}>DFL</button>
            <button onClick={() => setContext('personal')} className={`flex-1 py-2 rounded-full font-bold text-sm ${context === 'personal' ? 'bg-white shadow' : ''}`}>Pessoal</button>
          </div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da conta" className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl mb-3 outline-none" />
          <input value={formatDisplay(rawBalance)} onChange={handleBalanceChange} placeholder="R$ 0,00" className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl mb-4 font-bold text-lg outline-none" />
          <button onClick={handleSave} className="w-full bg-brand-teal text-white py-4 rounded-xl font-bold">Salvar conta</button>
        </div>
      )}

      <div className="space-y-3">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div>
              <p className="font-bold">{acc.name}</p>
              <p className="text-xs uppercase text-brand-teal font-bold">{acc.context}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-bold text-lg">R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <button onClick={() => handleDelete(acc.id)} className="text-red-400"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
