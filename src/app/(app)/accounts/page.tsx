'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'

const BANKS = [
  { slug: 'carteira', name: 'Carteira', color: '#16a34a', emoji: '👛' },
  { slug: 'inter', name: 'Inter', color: '#ea580c', emoji: '🟠' },
  { slug: 'stone', name: 'Stone PJ', color: '#00a868', emoji: '🟢' },
  { slug: 'infinitpay', name: 'InfinitPay', color: '#7c3aed', emoji: '💜' },
  { slug: 'nubank', name: 'Nubank', color: '#820ad1', emoji: '🟣' },
  { slug: 'bradesco', name: 'Bradesco', color: '#dc2626', emoji: '🔴' },
  { slug: 'itau', name: 'Itaú', color: '#ca8a04', emoji: '🟡' },
  { slug: 'bb', name: 'Banco do Brasil', color: '#1d4ed8', emoji: '🔵' },
  { slug: 'caixa', name: 'Caixa', color: '#0284c7', emoji: '🏦' },
  { slug: 'c6', name: 'C6 Bank', color: '#18181b', emoji: '⚫' },
  { slug: 'mercantil', name: 'Mercantil', color: '#1e40af', emoji: '🏛️' },
  { slug: 'outro', name: 'Outro', color: '#94a3b8', emoji: '🏦' },
]

const BANK_LOGOS: Record<string, string> = {
  inter: 'https://logo.clearbit.com/inter.co',
  nubank: 'https://logo.clearbit.com/nubank.com.br',
  bradesco: 'https://logo.clearbit.com/bradesco.com.br',
  itau: 'https://logo.clearbit.com/itau.com.br',
  stone: 'https://logo.clearbit.com/stone.com.br',
  infinitpay: 'https://logo.clearbit.com/infinitpay.io',
  bb: 'https://logo.clearbit.com/bb.com.br',
  caixa: 'https://logo.clearbit.com/caixa.gov.br',
  c6: 'https://logo.clearbit.com/c6bank.com.br',
  mercantil: 'https://logo.clearbit.com/mercantil.com.br',
}

function BankIcon({ slug, color, emoji, size = 10 }: { slug: string, color: string, emoji: string, size?: number }) {
  const logo = BANK_LOGOS[slug]
  const s = `w-${size} h-${size}`
  if (logo) {
    return (
      <img src={logo} alt={slug} className={`${s} rounded-full object-contain bg-white p-0.5`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
    )
  }
  return (
    <div className={`${s} rounded-full flex items-center justify-center text-white font-bold text-xs`}
      style={{ backgroundColor: color }}>{emoji}</div>
  )
}

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [accounts, setAccounts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [filterContext, setFilterContext] = useState<'dfl' | 'personal'>('dfl')
  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState('carteira')
  const [rawBalance, setRawBalance] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) loadAccounts() }, [user, filterContext])

  async function loadAccounts() {
    const { data } = await supabase
      .from('accounts').select('*')
      .eq('user_id', user!.id)
      .eq('context', filterContext)
      .order('created_at', { ascending: true })
    setAccounts(data ?? [])
  }

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawBalance(e.target.value.replace(/\D/g, ''))
  }

  const formatCurrency = (value: string) => {
    const num = parseInt(value || '0', 10) / 100
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  async function handleSave() {
    if (!name) return
    setSaving(true)
    const numericBalance = parseInt(rawBalance || '0', 10) / 100
    const bank = BANKS.find(b => b.slug === bankSlug)
    await supabase.from('accounts').insert({
      user_id: user!.id,
      name: name || bank?.name,
      bank_slug: bankSlug,
      balance: numericBalance,
      context,
    })
    setName(''); setBankSlug('carteira'); setRawBalance('')
    setShowForm(false); setSaving(false)
    setFilterContext(context)
    loadAccounts()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta conta?')) return
    await supabase.from('accounts').delete().eq('id', id)
    loadAccounts()
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0)

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ChevronLeft size={24} /></button>
          <h1 className="text-xl font-bold">Contas</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="w-10 h-10 bg-brand-teal rounded-full flex items-center justify-center text-white shadow-lg">
          <Plus size={22} />
        </button>
      </div>

      <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-full mb-4">
        {(['dfl', 'personal'] as const).map(c => (
          <button key={c} onClick={() => setFilterContext(c)}
            className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${filterContext === c ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-gray-500'}`}>
            {c === 'dfl' ? '🏪 DFL' : '👤 Pessoal'}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-xl border border-gray-100 dark:border-zinc-800 mb-5">
          <h2 className="text-base font-bold mb-4">Nova conta</h2>
          <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-full mb-4">
            {(['dfl', 'personal'] as const).map(c => (
              <button key={c} onClick={() => setContext(c)}
                className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${context === c ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-gray-500'}`}>
                {c === 'dfl' ? 'DFL' : 'Pessoal'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {BANKS.map(b => (
              <button key={b.slug} onClick={() => { setBankSlug(b.slug); if (!name) setName(b.name) }}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl border ${bankSlug === b.slug ? 'border-brand-teal bg-brand-teal/10' : 'border-gray-100 dark:border-zinc-800'}`}>
                <BankIcon slug={b.slug} color={b.color} emoji={b.emoji} size={8} />
                <span className="text-[9px] text-center truncate w-full">{b.name}</span>
              </button>
            ))}
          </div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da conta" className="w-full bg-gray-50 dark:bg-zinc-800 p-3.5 rounded-2xl outline-none text-sm mb-3" />
          <input type="text" inputMode="numeric" value={formatCurrency(rawBalance)} onChange={handleBalanceChange} className="w-full bg-gray-50 dark:bg-zinc-800 p-3.5 rounded-2xl outline-none font-bold text-lg mb-4" />
          <button onClick={handleSave} disabled={saving} className="w-full bg-brand-teal text-white py-3.5 rounded-2xl font-bold">{saving ? 'Salvando...' : 'Salvar conta'}</button>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="bg-brand-teal rounded-2xl p-4 mb-4 text-white">
          <p className="text-xs opacity-80">Saldo total ({filterContext})</p>
          <p className="text-2xl font-bold">{totalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
      )}

      <div className="space-y-3">
        {accounts.map(acc => {
          const bank = BANKS.find(b => b.slug === acc.bank_slug) ?? BANKS[BANKS.length - 1]
          return (
            <div key={acc.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex items-center gap-4 border border-gray-100 dark:border-zinc-800 shadow-sm">
              <BankIcon slug={acc.bank_slug} color={bank.color} emoji={bank.emoji} size={12} />
              <div className="flex-1"><p className="font-semibold">{acc.name}</p></div>
              <p className="font-bold">{Number(acc.balance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              <button onClick={() => handleDelete(acc.id)}><Trash2 size={16} className="text-red-400" /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
