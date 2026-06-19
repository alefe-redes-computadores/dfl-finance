'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Landmark } from 'lucide-react'

const PERSONAL_BANKS = [
  { slug: 'bradesco', name: 'Bradesco', color: '#dc2626', emoji: '🔴' },
  { slug: 'caixa', name: 'Caixa', color: '#0284c7', emoji: '🏦' },
  { slug: 'carteira', name: 'Carteira', color: '#16a34a', emoji: '👛' },
  { slug: 'itau', name: 'Itaú', color: '#f97316', emoji: '🟠' },
  { slug: 'nubank', name: 'Nubank', color: '#8b5cf6', emoji: '🟣' },
  { slug: 'outra', name: 'Outra', color: '#94a3b8', emoji: '🏛️' },
]

const DFL_BANKS = [
  { slug: 'cora', name: 'Cora', color: '#7c3aed', emoji: '🟣' },
  { slug: 'ifood-pago', name: 'iFood Pago', color: '#ea1d2c', emoji: '🍔' },
  { slug: 'infinitpay', name: 'InfinitPay', color: '#111827', emoji: '⚫' },
  { slug: 'mercado-pago', name: 'Mercado Pago', color: '#009ee3', emoji: '💙' },
  { slug: 'pagbank', name: 'PagBank', color: '#22c55e', emoji: '💚' },
  { slug: 'stone', name: 'Stone', color: '#00a868', emoji: '🟢' },
  { slug: 'outra', name: 'Outra', color: '#94a3b8', emoji: '🏛️' },
]

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [accounts, setAccounts] = useState<any[]>([])
  const [context, setContext] = useState<'personal' | 'dfl'>('personal')
  const [showForm, setShowForm] = useState(false)

  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState(PERSONAL_BANKS[0].slug)
  const [color, setColor] = useState(PERSONAL_BANKS[0].color)
  const [rawBalance, setRawBalance] = useState('')
  const [loading, setLoading] = useState(true)

  const AVAILABLE_BANKS = context === 'personal' ? PERSONAL_BANKS : DFL_BANKS

  const loadAccounts = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('name')

    setAccounts(data ?? [])
    setLoading(false)
  }, [user, context])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  // Atualiza o banco padrão ao trocar de contexto
  useEffect(() => {
    const defaultBank = AVAILABLE_BANKS[0]
    setBankSlug(defaultBank.slug)
    setColor(defaultBank.color)
  }, [context])

  function resetForm() {
    const defaultBank = AVAILABLE_BANKS[0]
    setName('')
    setBankSlug(defaultBank.slug)
    setColor(defaultBank.color)
    setRawBalance('')
  }

  async function handleSave() {
    if (!name.trim() || !user) return

    const selectedBank = AVAILABLE_BANKS.find(b => b.slug === bankSlug)
    const bankColor = selectedBank ? selectedBank.color : color

    const { error } = await supabase.from('accounts').insert({
      user_id: user.id,
      name: name.trim(),
      bank_slug: bankSlug,
      balance: Number(rawBalance.replace(',', '.') || '0'),
      context,
      color: bankColor,
    })

    if (!error) {
      resetForm()
      setShowForm(false)
      loadAccounts()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir esta conta?')) return
    await supabase.from('accounts').delete().eq('id', id)
    loadAccounts()
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 px-4 pt-6 pb-24 font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}>
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Contas</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)}>
          <Plus size={24} className="text-gray-700" />
        </button>
      </div>

      {/* Contexto DFL / Pessoal */}
      <div className="flex bg-gray-200 rounded-full p-1 mb-6">
        <button 
          onClick={() => setContext('dfl')}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${context === 'dfl' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          DFL
        </button>
        <button 
          onClick={() => setContext('personal')}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${context === 'personal' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          Pessoal
        </button>
      </div>

      {/* Saldo Total */}
      <div className="bg-emerald-900 rounded-3xl p-6 text-white mb-6 shadow-lg">
        <p className="text-emerald-100/80 text-sm font-medium mb-1">Saldo Total ({context === 'dfl' ? 'DFL' : 'Pessoal'})</p>
        <h2 className="text-3xl font-bold">R$ {totalBalance.toFixed(2).replace('.', ',')}</h2>
      </div>

      {/* Formulário Nova Conta */}
      {showForm && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6 space-y-4">
          <h2 className="font-bold text-gray-800">Nova Conta</h2>
          
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome da Conta</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Conta Corrente principal" 
              className="w-full bg-gray-100 p-3 rounded-xl outline-none text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Instituição</label>
            <select 
              value={bankSlug} 
              onChange={e => setBankSlug(e.target.value)}
              className="w-full bg-gray-100 p-3 rounded-xl outline-none text-sm"
            >
              {AVAILABLE_BANKS.map(bank => (
                <option key={bank.slug} value={bank.slug}>{bank.emoji} {bank.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Saldo Inicial (R$)</label>
            <input 
              type="number"
              value={rawBalance} 
              onChange={e => setRawBalance(e.target.value)}
              placeholder="0.00" 
              className="w-full bg-gray-100 p-3 rounded-xl outline-none text-sm"
            />
          </div>

          <button 
            onClick={handleSave} 
            className="w-full bg-emerald-900 text-white py-3 rounded-xl font-bold mt-2"
          >
            Salvar Conta
          </button>
        </div>
      )}

      {/* Lista de Contas */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-emerald-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Landmark size={48} className="mb-4 opacity-20" />
          <p>Nenhuma conta cadastrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => {
            const bankDef = ALL_BANKS.find(b => b.slug === acc.bank_slug)
            return (
              <div key={acc.id} className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm" style={{ backgroundColor: `${acc.color}20` }}>
                    {bankDef?.emoji || '🏛️'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{acc.name}</h3>
                    <p className="text-xs text-gray-500">{bankDef?.name || 'Outro'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-gray-900">
                    R$ {Number(acc.balance || 0).toFixed(2).replace('.', ',')}
                  </span>
                  <button onClick={() => handleDelete(acc.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
