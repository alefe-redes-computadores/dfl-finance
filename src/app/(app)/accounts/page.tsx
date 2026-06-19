'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useContext_ } from '@/components/ContextToggle' // Importante: Conecta com o seletor global

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
  const { context } = useContext_() // Puxa o contexto global (dfl ou personal)
  
  const [accounts, setAccounts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState('carteira')
  const [balance, setBalance] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) loadAccounts()
  }, [user, context]) // Recarrega sempre que o contexto mudar

  async function loadAccounts() {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.id)
      .eq('context', context) // Filtra pelo contexto ATUAL
      .order('created_at', { ascending: true })
    setAccounts(data ?? [])
  }

  async function handleSave() {
    if (!name) return
    setSaving(true)
    
    const { error } = await supabase.from('accounts').insert({
      user_id: user!.id,
      name,
      bank_slug: bankSlug,
      balance: Number(balance) || 0,
      context, // Salva com o contexto atual do sistema
    })

    if (!error) {
      setName('')
      setBankSlug('carteira')
      setBalance('')
      setShowForm(false)
      loadAccounts()
    } else {
      alert('Erro ao salvar conta')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    loadAccounts()
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}>
            <ChevronLeft size={24} className="text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Contas ({context === 'dfl' ? 'Jurídica' : 'Pessoal'})</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-9 h-9 bg-brand-teal rounded-full flex items-center justify-center shadow-lg shadow-brand-teal/20"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-6 border border-gray-100 dark:border-zinc-800 space-y-4">
          <p className="text-sm font-semibold text-gray-800 dark:text-white">Nova conta</p>
          
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Banco</label>
            <div className="grid grid-cols-4 gap-2">
              {BANKS.map(b => (
                <button
                  key={b.slug}
                  onClick={() => {
                    setBankSlug(b.slug)
                    if (!name) setName(b.name)
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                    bankSlug === b.slug
                      ? 'border-brand-teal bg-brand-teal/10 dark:bg-brand-teal/20'
                      : 'border-gray-200 dark:border-zinc-700'
                  }`}
                >
                  {BANK_LOGOS[b.slug] ? (
                    <img src={BANK_LOGOS[b.slug]} alt={b.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: b.color }}>{b.name[0]}</div>
                  )}
                  <span className="text-[10px] text-gray-600 dark:text-gray-400 text-center leading-tight truncate w-full">{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nome da conta</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Conta DFL, Carteira..."
              className="w-full bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-3 text-sm outline-none text-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Saldo inicial (R$)</label>
            <input
              type="number"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0,00"
              className="w-full bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-3 text-sm outline-none text-gray-800 dark:text-white"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="w-full bg-brand-teal text-white rounded-xl py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {saving ? 'Salvando...' : `Salvar conta ${context === 'dfl' ? 'Jurídica' : 'Pessoal'}`}
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-3">
        {accounts.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Nenhuma conta encontrada neste contexto.</div>
        ) : (
          accounts.map(acc => (
            <div key={acc.id} className="bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 border border-gray-100 dark:border-zinc-800">
              {BANK_LOGOS[acc.bank_slug] ? (
                <img src={BANK_LOGOS[acc.bank_slug]} alt={acc.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 bg-gray-200 dark:bg-zinc-700 rounded-full flex items-center justify-center">
                  <Wallet size={18} className="text-gray-500" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{acc.name}</p>
                <p className="text-[10px] uppercase font-bold text-brand-teal tracking-wider">
                  {acc.context === 'dfl' ? 'Jurídica' : 'Pessoal'}
                </p>
              </div>
              <p className="text-sm font-bold text-gray-800 dark:text-white mr-2">
                R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <button onClick={() => handleDelete(acc.id)} className="text-red-400 hover:text-red-600 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
