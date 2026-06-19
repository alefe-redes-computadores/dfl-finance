'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useContext_ } from '@/components/ContextToggle'

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

const BANK_LOGOS: Record<string, string> = {
  inter: 'https://logo.clearbit.com/inter.co',
  stone: 'https://logo.clearbit.com/stone.com.br',
  nubank: 'https://logo.clearbit.com/nubank.com.br',
  itau: 'https://logo.clearbit.com/itau.com.br',
  bradesco: 'https://logo.clearbit.com/bradesco.com.br',
  infinitpay: 'https://logo.clearbit.com/infinitpay.io',
}

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const contextData = useContext_() 
  const context = contextData?.context || 'dfl' // Segurança extra
  
  const [accounts, setAccounts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState('carteira')
  const [balance, setBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && context) {
      loadAccounts()
    }
  }, [user, context])

  async function loadAccounts() {
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.id)
      .eq('context', context)
      .order('created_at', { ascending: true })
    setAccounts(data ?? [])
    setLoading(false)
  }

  async function handleSave() {
    if (!name) return
    setSaving(true)
    const numericBalance = parseFloat(balance.replace(',', '.')) || 0
    const { error } = await supabase.from('accounts').insert({ user_id: user!.id, name, bank_slug: bankSlug, balance: numericBalance, context })
    if (!error) { setName(''); setBankSlug('carteira'); setBalance(''); setShowForm(false); loadAccounts() }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    loadAccounts()
  }

  if (loading && accounts.length === 0) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">Carregando...</div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ChevronLeft size={24} /></button>
          <h1 className="text-xl font-bold capitalize">Contas ({context === 'dfl' ? 'Jurídica' : 'Pessoal'})</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform ${showForm ? 'bg-red-500 rotate-45' : 'bg-brand-teal'}`}>
          <Plus size={20} className="text-white" />
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-zinc-800 mb-6">
          <h2 className="text-lg font-bold mb-4">Adicionar Conta</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Banco</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {BANKS.map(b => (
                  <button key={b.slug} onClick={() => { setBankSlug(b.slug); if (!name) setName(b.name) }} className={`p-2 rounded-2xl border ${bankSlug === b.slug ? 'border-brand-teal bg-brand-teal/10' : 'border-gray-100 dark:border-zinc-800'}`}>
                    {BANK_LOGOS[b.slug] ? <img src={BANK_LOGOS[b.slug]} className="w-8 h-8 rounded-full mx-auto" /> : <div className="w-8 h-8 rounded-full mx-auto flex items-center justify-center text-white text-[10px]" style={{backgroundColor: b.color}}>{b.name[0]}</div>}
                  </button>
                ))}
              </div>
            </div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da conta" className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-2xl outline-none" />
            <input type="text" inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value.replace(/[^0-9,]/g, ''))} placeholder="Saldo inicial (0,00)" className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-2xl outline-none" />
            <button onClick={handleSave} disabled={saving} className="w-full bg-brand-teal text-white py-4 rounded-2xl font-bold">{saving ? 'Salvando...' : 'Confirmar conta'}</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm flex items-center gap-4 border border-gray-100 dark:border-zinc-800">
            {BANK_LOGOS[acc.bank_slug] ? <img src={BANK_LOGOS[acc.bank_slug]} className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center"><Wallet size={20} className="text-gray-400" /></div>}
            <div className="flex-1"><p className="font-semibold">{acc.name}</p></div>
            <p className="font-bold">R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <button onClick={() => handleDelete(acc.id)} className="text-red-400"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
