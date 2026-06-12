'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
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
  const [accounts, setAccounts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState('carteira')
  const [balance, setBalance] = useState('')
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) loadAccounts()
  }, [user])

  async function loadAccounts() {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.uid)
      .order('created_at', { ascending: true })
    setAccounts(data ?? [])
  }

  async function handleSave() {
    if (!name) return
    setSaving(true)
    await supabase.from('accounts').insert({
      user_id: user!.uid,
      name,
      bank_slug: bankSlug,
      balance: Number(balance) || 0,
      context,
    })
    setName('')
    setBankSlug('carteira')
    setBalance('')
    setShowForm(false)
    setSaving(false)
    loadAccounts()
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Contas</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-9 h-9 bg-brand-teal rounded-full flex items-center justify-center"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-white">Nova conta</p>

          {/* Contexto */}
          <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-full p-1 gap-1 w-fit">
            {(['dfl', 'personal'] as const).map(c => (
              <button
                key={c}
                onClick={() => setContext(c)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  context === c
                    ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {c === 'dfl' ? 'DFL' : 'Pessoal'}
              </button>
            ))}
          </div>

          {/* Banco */}
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
                      ? 'border-brand-teal bg-brand-light dark:bg-brand-teal/20'
                      : 'border-gray-200 dark:border-zinc-700'
                  }`}
                >
                  {BANK_LOGOS[b.slug] ? (
                    <img src={BANK_LOGOS[b.slug]} alt={b.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: b.color }}>
                      {b.name[0]}
                    </div>
                  )}
                  <span className="text-[10px] text-gray-600 dark:text-gray-400 text-center leading-tight">{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nome da conta</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Carteira, Inter..."
              className="w-full bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none text-gray-800 dark:text-white"
            />
          </div>

          {/* Saldo inicial */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Saldo inicial (R$)</label>
            <input
              type="number"
              inputMode="decimal"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0,00"
              className="w-full bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none text-gray-800 dark:text-white"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="w-full bg-brand-teal text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar conta'}
          </button>
        </div>
      )}

      {/* Lista */}
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <span className="text-4xl mb-3">🏦</span>
          <p className="text-sm font-medium">Nenhuma conta cadastrada</p>
          <p className="text-xs mt-1">Clique no + para adicionar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
              {BANK_LOGOS[acc.bank_slug] ? (
                <img src={BANK_LOGOS[acc.bank_slug]} alt={acc.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 bg-gray-200 dark:bg-zinc-700 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-500">{acc.name[0]}</span>
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{acc.name}</p>
                <p className="text-xs text-gray-400">{acc.context === 'dfl' ? 'DFL' : 'Pessoal'}</p>
              </div>
              <p className="text-sm font-bold text-gray-800 dark:text-white mr-2">
                R$ {Number(acc.balance).toFixed(2).replace('.', ',')}
              </p>
              <button onClick={() => handleDelete(acc.id)}>
                <Trash2 size={16} className="text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
