'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'

const BANKS = [
  { slug: 'carteira', name: 'Carteira', color: '#16a34a' },
  { slug: 'inter', name: 'Inter', color: '#ea580c' },
  { slug: 'stone', name: 'Stone PJ', color: '#16a34a' },
  { slug: 'infinitpay', name: 'InfinitPay', color: '#7c3aed' },
  { slug: 'nubank', name: 'Nubank', color: '#7c3aed' },
  { slug: 'bradesco', name: 'Bradesco', color: '#dc2626' },
  { slug: 'itau', name: 'Itaú', color: '#ca8a04' },
  { slug: 'outro', name: 'Outro', color: '#94a3b8' },
]

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [accounts, setAccounts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  
  // Estados do Formulário
  const [context, setContext] = useState<'dfl' | 'personal'>('personal')
  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState('carteira')
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

  // Máscara de moeda: formata enquanto digita
  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    setRawBalance(value)
  }

  const formatCurrency = (value: string) => {
    const num = parseInt(value || '0', 10) / 100
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  async function handleSave() {
    const numericBalance = parseInt(rawBalance || '0', 10) / 100
    await supabase.from('accounts').insert({
      user_id: user!.id,
      name,
      bank_slug: bankSlug,
      balance: numericBalance,
      context,
    })
    setName('')
    setBankSlug('carteira')
    setRawBalance('')
    setShowForm(false)
    loadAccounts()
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ChevronLeft size={24} /></button>
          <h1 className="text-xl font-bold">Contas</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="w-10 h-10 bg-brand-teal rounded-full flex items-center justify-center text-white">
          <Plus size={24} />
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-zinc-800 mb-6">
          <h2 className="text-lg font-bold mb-4">Nova conta</h2>
          
          {/* Seletor DFL / Pessoal */}
          <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-full mb-4">
            <button onClick={() => setContext('dfl')} className={`flex-1 py-2 rounded-full text-sm font-bold ${context === 'dfl' ? 'bg-white shadow-sm' : ''}`}>DFL</button>
            <button onClick={() => setContext('personal')} className={`flex-1 py-2 rounded-full text-sm font-bold ${context === 'personal' ? 'bg-white shadow-sm' : ''}`}>Pessoal</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Banco</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {BANKS.map(b => (
                  <button key={b.slug} onClick={() => setBankSlug(b.slug)} className={`p-2 rounded-2xl border ${bankSlug === b.slug ? 'border-brand-teal bg-brand-teal/10' : 'border-gray-100 dark:border-zinc-800'}`}>
                    <div className="w-8 h-8 rounded-full mx-auto flex items-center justify-center text-white text-[10px]" style={{backgroundColor: b.color}}>{b.name[0]}</div>
                  </button>
                ))}
              </div>
            </div>
            
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Carteira, Inter..." className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-2xl outline-none" />
            
            <input 
              type="text" 
              value={formatCurrency(rawBalance)} 
              onChange={handleBalanceChange} 
              className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-2xl outline-none font-bold"
            />

            <button onClick={handleSave} className="w-full bg-brand-teal text-white py-4 rounded-2xl font-bold">Salvar conta</button>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20 text-gray-400">
          <div className="text-6xl mb-4">🏦</div>
          <p className="font-medium">Nenhuma conta cadastrada</p>
          <p className="text-sm">Clique no + para adicionar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex items-center gap-4 border border-gray-100 dark:border-zinc-800">
              <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center font-bold text-gray-500">{acc.name[0]}</div>
              <div className="flex-1">
                <p className="font-semibold">{acc.name}</p>
                <span className="text-[10px] uppercase font-bold text-brand-teal">{acc.context}</span>
              </div>
              <p className="font-bold">R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
