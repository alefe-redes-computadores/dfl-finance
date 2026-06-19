'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'

// Bancos configurados com cores e emojis conforme solicitado
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

// Logo automática via Clearbit
const getBankLogo = (slug: string) => `https://logo.clearbit.com/${slug === 'inter' ? 'inter.co' : slug === 'nubank' ? 'nubank.com.br' : slug === 'stone' ? 'stone.com.br' : slug === 'infinitpay' ? 'infinitpay.io' : slug + '.com.br'}`

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [accounts, setAccounts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [context, setContext] = useState<'dfl' | 'personal'>('personal')
  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState('carteira')
  const [rawBalance, setRawBalance] = useState('')

  useEffect(() => { if (user) loadAccounts() }, [user, context])

  async function loadAccounts() {
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user!.id).eq('context', context).order('created_at', { ascending: true })
    setAccounts(data ?? [])
  }

  const formatCurrency = (value: string) => (parseInt(value || '0', 10) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function handleSave() {
    if (!name) return
    const numericBalance = parseInt(rawBalance || '0', 10) / 100
    const bank = BANKS.find(b => b.slug === bankSlug)
    await supabase.from('accounts').insert({ user_id: user!.id, name, bank_slug: bankSlug, balance: numericBalance, context })
    setName(''); setRawBalance(''); setShowForm(false); loadAccounts()
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 p-4 font-sans text-gray-900">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()}><ChevronLeft size={24} /></button>
        <h1 className="text-lg font-bold">Contas</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-900 text-white p-2 rounded-full"><Plus size={20} /></button>
      </div>

      {/* Seletor de Contexto */}
      <div className="flex bg-gray-200 p-1 rounded-2xl mb-6">
        <button onClick={() => setContext('personal')} className={`flex-1 py-2 rounded-xl text-sm font-bold ${context === 'personal' ? 'bg-white shadow' : ''}`}>Pessoal</button>
        <button onClick={() => setContext('dfl')} className={`flex-1 py-2 rounded-xl text-sm font-bold ${context === 'dfl' ? 'bg-white shadow' : ''}`}>Jurídica</button>
      </div>

      {/* Card Saldo Total */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Saldo total</p>
        <p className="text-3xl font-light text-gray-800">{totalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      </div>

      {/* Lista de Contas */}
      <div className="space-y-3">
        {accounts.map(acc => {
          const bank = BANKS.find(b => b.slug === acc.bank_slug)
          return (
            <div key={acc.id} className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
              <img src={getBankLogo(acc.bank_slug)} className="w-10 h-10 rounded-full bg-gray-100" />
              <div className="flex-1">
                <p className="font-bold">{acc.name}</p>
                <p className="text-xs text-gray-400 uppercase font-bold">{context === 'personal' ? 'Pessoal' : 'Jurídica'}</p>
              </div>
              <p className="font-bold text-gray-900">{Number(acc.balance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          )
        })}
      </div>

      {/* Modal Nova Conta */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Nova Conta</h2>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {BANKS.map(b => (
                <button key={b.slug} onClick={() => { setBankSlug(b.slug); setName(b.name) }} className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${bankSlug === b.slug ? 'border-emerald-900' : 'border-transparent'}`} style={{ backgroundColor: b.color + '20' }}>{b.emoji}</div>
                  <span className="text-[10px] truncate w-full text-center">{b.name}</span>
                </button>
              ))}
            </div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da conta" className="w-full bg-gray-50 p-4 rounded-2xl mb-3" />
            <input value={formatCurrency(rawBalance)} onChange={(e) => setRawBalance(e.target.value.replace(/\D/g, ''))} className="w-full bg-gray-50 p-4 rounded-2xl mb-4 font-bold text-xl" />
            <button onClick={handleSave} className="w-full bg-emerald-900 text-white py-4 rounded-2xl font-bold">Salvar conta</button>
          </div>
        </div>
      )}
    </div>
  )
}
