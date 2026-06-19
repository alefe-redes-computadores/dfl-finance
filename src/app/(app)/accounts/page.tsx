'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Landmark } from 'lucide-react'

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [accounts, setAccounts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [name, setName] = useState('')
  const [rawBalance, setRawBalance] = useState('')
  const [selectedBank, setSelectedBank] = useState<any>(null)

  useEffect(() => { if (user) loadAccounts() }, [user])

  async function loadAccounts() {
    if (!user?.id) return
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    setAccounts(data ?? [])
  }

  const handleSave = async () => {
    if (!user?.id || !name || !selectedBank) return
    const { error } = await supabase.from('accounts').insert({
      user_id: user.id, name, bank_slug: selectedBank.slug, balance: parseInt(rawBalance || '0', 10) / 100, context, color: selectedBank.color
    })
    if (error) { alert("Erro: " + error.message); return }
    setName(''); setRawBalance(''); setShowForm(false); setSelectedBank(null); loadAccounts()
  }

  const personalBanks = [
    { slug: 'nubank', name: 'Nubank', color: '#8b5cf6' },
    { slug: 'inter', name: 'Inter', color: '#f97316' },
    { slug: 'caixa', name: 'Caixa', color: '#0ea5e9' },
    { slug: 'itau', name: 'Itaú', color: '#eab308' },
    { slug: 'bradesco', name: 'Bradesco', color: '#dc2626' },
    { slug: 'santander', name: 'Santander', color: '#ef4444' }
  ]

  const dflBanks = [
    { slug: 'stone', name: 'Stone PJ', color: '#059669' },
    { slug: 'ifood', name: 'iFood Pago', color: '#e11d48' },
    { slug: 'infinitpay', name: 'InfinitPay', color: '#7c3aed' },
    { slug: 'mercado', name: 'Mercado P.', color: '#0ea5e9' },
    { slug: 'cora', name: 'Cora', color: '#4f46e5' }
  ]

  const banks = context === 'personal' ? personalBanks : dflBanks

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="bg-white p-4 flex items-center justify-between border-b"><button onClick={() => router.back()}><ChevronLeft /></button><h1 className="font-bold text-lg">Contas</h1><button onClick={() => setShowForm(true)}><Plus /></button></div>
      <div className="p-4">
        <div className="bg-white rounded-2xl p-6 border mb-6 shadow-sm text-center">
          <p className="text-sm text-gray-500">Saldo total</p>
          <h2 className="text-3xl font-light text-gray-800">R$ {accounts.reduce((a, c) => a + Number(c.balance), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
        </div>
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-white p-4 rounded-2xl flex items-center gap-4 border shadow-sm">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-50"><Landmark size={24} color={acc.color} /></div>
              <div className="flex-1"><p className="font-bold text-gray-800">{acc.name}</p><p className="text-xs text-gray-400 uppercase">{acc.context === 'personal' ? 'Pessoal' : 'Jurídica'}</p></div>
              <p className="font-bold text-gray-800 text-lg">R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          ))}
        </div>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-4">Nova Conta</h3>
            <div className="flex bg-gray-100 p-1 rounded-full mb-4">
              <button onClick={() => {setContext('dfl'); setSelectedBank(null)}} className={`flex-1 py-2 rounded-full font-bold text-sm ${context === 'dfl' ? 'bg-white shadow' : ''}`}>Jurídica</button>
              <button onClick={() => {setContext('personal'); setSelectedBank(null)}} className={`flex-1 py-2 rounded-full font-bold text-sm ${context === 'personal' ? 'bg-white shadow' : ''}`}>Pessoal</button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">{banks.map(b => (<button key={b.slug} onClick={() => { setSelectedBank(b); setName(b.name) }} className={`p-3 rounded-xl border text-xs font-bold ${selectedBank?.slug === b.slug ? 'border-teal-800 bg-teal-50' : ''}`}>{b.name}</button>))}</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" className="w-full bg-gray-50 p-4 rounded-xl mb-3" />
            <input value={(parseInt(rawBalance || '0', 10) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} onChange={(e) => setRawBalance(e.target.value.replace(/\D/g, ''))} className="w-full bg-gray-50 p-4 rounded-xl mb-4 font-bold text-lg" />
            <button onClick={handleSave} className="w-full bg-teal-800 text-white py-4 rounded-xl font-bold">Salvar conta</button>
          </div>
        </div>
      )}
    </div>
  )
}
