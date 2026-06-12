'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Paperclip } from 'lucide-react'
import { ContextProvider, useContext_ } from '@/components/ContextToggle'

type TxType = 'income' | 'expense' | 'sangria' | 'transfer'

function NewTransactionContent() {
  const { user } = useAuth()
  const { context } = useContext_()
  const router = useRouter()

  const [type, setType] = useState<TxType>('income')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState<'done' | 'pending'>('done')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    loadOptions()
  }, [user, context, type])

  async function loadOptions() {
    const catType = type === 'income' ? 'income' : 'expense'
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user!.uid)
      .eq('context', context)
      .eq('type', catType)

    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.uid)
      .eq('context', context)

    setCategories(cats ?? [])
    setAccounts(accs ?? [])
  }

  async function handleSave() {
    if (!amount || isNaN(Number(amount))) {
      setError('Informe um valor válido.')
      return
    }
    setSaving(true)
    setError('')

    let receiptUrl = null

    if (receipt) {
      const ext = receipt.name.split('.').pop()
      const path = `${user!.uid}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('receipts')
        .upload(path, receipt)
      if (!upErr) {
        const { data } = supabase.storage.from('receipts').getPublicUrl(path)
        receiptUrl = data.publicUrl
      }
    }

    const { error: txErr } = await supabase.from('transactions').insert({
      user_id: user!.uid,
      type,
      amount: Number(amount),
      description,
      category_id: categoryId || null,
      account_id: accountId || null,
      date,
      status,
      receipt_url: receiptUrl,
      context,
    })

    if (txErr) {
      setError('Erro ao salvar. Tente novamente.')
    } else {
      router.back()
    }
    setSaving(false)
  }

  const types: { key: TxType; label: string; color: string }[] = [
    { key: 'income', label: 'Receita', color: 'bg-green-500' },
    { key: 'expense', label: 'Despesa', color: 'bg-red-500' },
    { key: 'sangria', label: 'Sangria', color: 'bg-orange-500' },
    { key: 'transfer', label: 'Transferência', color: 'bg-blue-500' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}>
          <ChevronLeft size={24} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nova transação</h1>
      </div>

      {/* Tipo */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {types.map(t => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`py-2 rounded-xl text-xs font-semibold transition-all ${
              type === t.key
                ? `${t.color} text-white`
                : 'bg-white dark:bg-zinc-900 text-gray-500 dark:text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">

        {/* Valor */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <label className="text-xs text-gray-500 mb-1 block">Valor (R$)</label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0,00"
            className="w-full bg-transparent text-2xl font-bold text-gray-900 dark:text-white outline-none"
          />
        </div>

        {/* Descrição */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Compra no mercado"
            className="w-full bg-transparent text-sm text-gray-800 dark:text-white outline-none"
          />
        </div>

        {/* Categoria */}
        {categories.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
            <label className="text-xs text-gray-500 mb-2 block">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    categoryId === cat.id
                      ? 'bg-brand-teal text-white border-brand-teal'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border-transparent'
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conta */}
        {accounts.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
            <label className="text-xs text-gray-500 mb-1 block">Conta</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full bg-transparent text-sm text-gray-800 dark:text-white outline-none"
            >
              <option value="">Selecionar...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Data */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <label className="text-xs text-gray-500 mb-1 block">Data</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-transparent text-sm text-gray-800 dark:text-white outline-none"
          />
        </div>

        {/* Status */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <label className="text-xs text-gray-500 mb-2 block">Status</label>
          <div className="flex gap-3">
            {(['done', 'pending'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                  status === s
                    ? 'bg-brand-teal text-white'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'
                }`}
              >
                {s === 'done' ? '✅ Concluída' : '⏳ Pendente'}
              </button>
            ))}
          </div>
        </div>

        {/* Comprovante */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <label className="text-xs text-gray-500 mb-2 block">Comprovante (opcional)</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
              <Paperclip size={18} className="text-gray-500" />
            </div>
            <span className="text-sm text-gray-500">
              {receipt ? receipt.name : 'Anexar comprovante'}
            </span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => setReceipt(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {error && <p className="text-red-500 text-xs text-center">{error}</p>}

        {/* Salvar */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-brand-teal text-white rounded-2xl py-4 font-bold text-sm disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar transação'}
        </button>

      </div>
    </div>
  )
}

export default function NewTransactionPage() {
  return (
    <ContextProvider>
      <NewTransactionContent />
    </ContextProvider>
  )
}
