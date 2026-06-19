'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Budget de cores definido manualmente para garantir que não quebre a UI
const BANKS = [
  { slug: 'carteira', name: 'Carteira', color: '#10b981' },
  { slug: 'inter', name: 'Inter', color: '#f97316' },
  { slug: 'stone', name: 'Stone PJ', color: '#059669' },
  { slug: 'nubank', name: 'Nubank', color: '#8b5cf6' },
  { slug: 'itau', name: 'Itaú', color: '#eab308' },
  { slug: 'bradesco', name: 'Bradesco', color: '#dc2626' },
  { slug: 'bb', name: 'Banco do Brasil', color: '#2563eb' },
  { slug: 'caixa', name: 'Caixa', color: '#0ea5e9' },
  { slug: 'outro', name: 'Outro', color: '#64748b' },
]

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [accounts, setAccounts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  
  // Estados do form
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState('carteira')
  const [balance, setBalance] = useState('') 

  useEffect(() => {
    if (user) loadAccounts()
  }, [user])

  async function loadAccounts() {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error("Erro ao carregar contas:", error)
    } else {
      setAccounts(data ?? [])
    }
  }

  async function handleSave() {
    if (!name || !user) return
    
    // Converte saldo (ex: 100,50 -> 100.50)
    const numericBalance = parseFloat(balance.replace(/\./g, '').replace(',', '.')) || 0
    
    const { error } = await supabase.from('accounts').insert({
      user_id: user.id,
      name: name,
      bank_slug: bankSlug,
      balance: numericBalance,
      context: context,
    })

    if (error) {
      alert("Erro ao salvar no banco: " + error.message)
    } else {
      setName('')
      setBalance('')
      setShowForm(false)
      loadAccounts()
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) alert("Erro ao excluir: " + error.message)
    loadAccounts()
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-20">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()}><ChevronLeft size={24} /></button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Contas</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-brand-teal text-white p-2 rounded-full shadow-lg">
          <Plus size={24} />
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-zinc-800 mb-6">
          <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-full mb-6">
            <button onClick={() => setContext('dfl')} className={`flex-1 py-2 rounded-full font-bold text-sm ${context === 'dfl' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>DFL</button>
            <button onClick={() => setContext('personal')} className={`flex-1 py-2 rounded-full font-bold text-sm ${context === 'personal' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>Pessoal</button>
          </div>
          
          <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Banco</label>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {BANKS.map(b => (
              <button key={b.slug} onClick={() => setBankSlug(b.slug)} 
                className={`flex flex-col items-center p-2 rounded-xl border ${bankSlug === b.slug ? 'border-brand-teal bg-brand-teal/10' : 'border-gray-200 dark:border-zinc-700'}`}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mb-1" style={{backgroundColor: b.color}}>{b.name[0]}</div>
                <span className="text-[9px] truncate w-full text-center">{b.name}</span>
              </button>
            ))}
          </div>

          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da conta" className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl mb-3 text-sm outline-none" />
          <input value={balance} onChange={e => setBalance(e.target.value)} placeholder="Saldo inicial (ex: 100,00)" className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl mb-4 text-sm outline-none" />
          
          <button onClick={handleSave} className="w-full bg-brand-teal text-white py-4 rounded-xl font-bold">Salvar conta</button>
        </div>
      )}

      <div className="space-y-3">
        {accounts.map(acc => {
          const bank = BANKS.find(b => b.slug === acc.bank_slug) || BANKS[8]
          return (
            <div key={acc.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{backgroundColor: bank.color}}>{acc.name[0]}</div>
                <div>
                  <p className="font-bold text-sm">{acc.name}</p>
                  <p className="text-[10px] font-bold text-brand-teal uppercase">{acc.context}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-bold text-sm">R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <button onClick={() => handleDelete(acc.id)} className="text-red-400"><Trash2 size={16} /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
