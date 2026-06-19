'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Landmark } from 'lucide-react'

const BANKS = [
  { slug: 'carteira', name: 'Carteira', color: '#16a34a', emoji: '💵' },
  { slug: 'inter', name: 'Inter', color: '#ea580c', emoji: '🟠' },
  { slug: 'stone', name: 'Stone PJ', color: '#059669', emoji: '🟢' },
  { slug: 'nubank', name: 'Nubank', color: '#8b5cf6', emoji: '💜' },
  { slug: 'bradesco', name: 'Bradesco', color: '#dc2626', emoji: '🔴' },
  { slug: 'itau', name: 'Itaú', color: '#ca8a04', emoji: '🟡' },
  { slug: 'caixa', name: 'Caixa', color: '#0284c7', emoji: '🔵' },
]

const COLORS = [
  '#16a34a',
  '#dc2626',
  '#ea580c',
  '#0891b2',
  '#7c3aed',
  '#ca8a04',
  '#94a3b8',
  '#ec4899',
  '#14b8a6',
]

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [accounts, setAccounts] = useState<any[]>([])
  const [context, setContext] = useState<'personal' | 'dfl'>('personal')

  const [showForm, setShowForm] = useState(false)

  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState('carteira')
  const [color, setColor] = useState('#16a34a')
  const [rawBalance, setRawBalance] = useState('')

  useEffect(() => {
    if (user) loadAccounts()
  }, [user, context])

  async function loadAccounts() {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.id)
      .eq('context', context)
      .order('name')

    setAccounts(data ?? [])
  }

  function resetForm() {
    setName('')
    setBankSlug('carteira')
    setColor('#16a34a')
    setRawBalance('')
  }

  async function handleSave() {
    if (!name.trim()) return

    await supabase.from('accounts').insert({
      user_id: user!.id,
      name: name.trim(),
      bank_slug: bankSlug,
      balance: parseInt(rawBalance || '0', 10) / 100,
      context,
      color,
    })

    resetForm()
    setShowForm(false)
    loadAccounts()
  }

  async function handleDelete(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    loadAccounts()
  }

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + Number(acc.balance || 0),
    0
  )

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 p-4 font-sans text-sm">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}>
            <ChevronLeft size={24} />
          </button>

          <h1 className="text-base font-bold">Contas</h1>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="bg-emerald-900 text-white p-2 rounded-full"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* ABAS */}
      <div className="flex bg-slate-200 p-1 rounded-xl mb-6">
        <button
          onClick={() => setContext('personal')}
          className={`flex-1 py-2 rounded-lg font-bold transition ${
            context === 'personal'
              ? 'bg-white shadow'
              : 'text-slate-500'
          }`}
        >
          Pessoal
        </button>

        <button
          onClick={() => setContext('dfl')}
          className={`flex-1 py-2 rounded-lg font-bold transition ${
            context === 'dfl'
              ? 'bg-white shadow'
              : 'text-slate-500'
          }`}
        >
          Jurídica
        </button>
      </div>

      {/* SALDO TOTAL */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 mb-6 shadow-sm">
        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">
          Saldo total
        </p>

        <p className="text-3xl font-semibold text-slate-800">
          {totalBalance.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
        </p>
      </div>

      {/* LISTA */}
      <div className="space-y-3">
        {accounts.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Landmark size={28} className="text-slate-400" />
            </div>

            <h3 className="font-bold text-slate-700 mb-1">
              Nenhuma conta cadastrada
            </h3>

            <p className="text-slate-500 text-xs">
              Toque no botão + para criar sua primeira conta.
            </p>
          </div>
        )}

        {accounts.map(acc => {
          const bank = BANKS.find(b => b.slug === acc.bank_slug)

          return (
            <div
              key={acc.id}
              className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-slate-100 shadow-sm"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{
                  backgroundColor: `${acc.color}20`,
                  color: acc.color,
                }}
              >
                {bank?.emoji ?? '🏦'}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">
                  {acc.name}
                </p>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    {bank?.name || 'Conta'}
                  </span>

                  <span className="text-slate-300">•</span>

                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    {context}
                  </span>
                </div>
              </div>

              <p className="font-bold text-slate-900 whitespace-nowrap">
                {Number(acc.balance).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>

              <button onClick={() => handleDelete(acc.id)}>
                <Trash2
                  size={16}
                  className="text-slate-300 hover:text-red-500 transition"
                />
              </button>
            </div>
          )
        })}
      </div>

      {/* MODAL */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowForm(false)
            resetForm()
          }}
        >
          <div
            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1">Nova Conta</h2>

            <p className="text-xs text-slate-500 mb-6">
              Escolha um banco e personalize sua conta.
            </p>

            {/* BANCOS */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {BANKS.map(bank => (
                <button
                  key={bank.slug}
                  onClick={() => {
                    setBankSlug(bank.slug)
                    setName(bank.name)
                    setColor(bank.color)
                  }}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 text-xl ${
                      bankSlug === bank.slug
                        ? 'border-emerald-900'
                        : 'border-transparent'
                    }`}
                    style={{
                      backgroundColor: bank.color + '20',
                    }}
                  >
                    {bank.emoji}
                  </div>

                  <span className="text-[10px] text-center w-full truncate">
                    {bank.name}
                  </span>
                </button>
              ))}
            </div>

            {/* CORES */}
            <div className="mb-6">
              <label className="text-xs text-gray-500 mb-2 block font-bold">
                Cor de destaque
              </label>

              <div className="flex gap-2 flex-wrap mb-3">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${
                      color === c
                        ? 'border-black scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-full h-12 rounded-xl border border-slate-200 cursor-pointer"
              />
            </div>

            {/* NOME */}
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome da conta"
              className="w-full bg-slate-50 p-4 rounded-xl mb-3 text-sm"
            />

            {/* SALDO */}
            <input
              value={(parseInt(rawBalance || '0', 10) / 100).toLocaleString(
                'pt-BR',
                {
                  style: 'currency',
                  currency: 'BRL',
                }
              )}
              onChange={e =>
                setRawBalance(e.target.value.replace(/\D/g, ''))
              }
              className="w-full bg-slate-50 p-4 rounded-xl mb-6 font-bold text-lg"
            />

            <button
              onClick={handleSave}
              className="w-full bg-emerald-900 text-white py-4 rounded-xl font-bold"
            >
              Salvar conta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}