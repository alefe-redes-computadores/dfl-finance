'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Paperclip } from 'lucide-react'

type TxType = 'income' | 'expense' | 'sangria' | 'transfer'
type Context = 'dfl' | 'personal'

export default function NewTransactionPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [type, setType] = useState<TxType>('expense') // Mudei o padrão para despesa (mais comum)
  const [context, setContext] = useState<Context>('dfl')
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
    // Se for transferência ou sangria, podemos querer carregar outras opções depois, 
    // mas por hora mantemos a lógica de despesa/receita
    const catType = type === 'income' ? 'income' : 'expense'

    // CORREÇÃO: user.id ao invés de user.uid
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .eq('type', catType)

    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)

    setCategories(cats ?? [])
    setAccounts(accs ?? [])
    setCategoryId('')
  }

  async function handleSave() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Informe um valor válido.')
      return
    }
    if (!user) {
      setError('Usuário não autenticado.')
      return
    }

    setSaving(true)
    setError('')

    let receiptUrl = null

    if (receipt) {
      const ext = receipt.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}` // CORREÇÃO: user.id
      const { error: upErr } = await supabase.storage
        .from('receipts')
        .upload(path, receipt)
      if (!upErr) {
        const { data } = supabase.storage.from('receipts').getPublicUrl(path)
        receiptUrl = data.publicUrl
      }
    }

    const { error: txErr } = await supabase.from('transactions').insert({
      user_id: user.id, // CORREÇÃO: user.id
      type,
      amount: Number(amount),
      description: description || null,
      category_id: categoryId || null,
      account_id: accountId || null,
      date,
      status,
      receipt_url: receiptUrl,
      context,
    })

    if (txErr) {
      console.error(txErr)
      setError(`Erro: ${txErr.message}`)
    } else {
      router.replace('/transactions') // Mudando para voltar para a tela de transações
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
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10 min-h-screen bg-slate-50">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}>
          <ChevronLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Nova transação</h1>
      </div>

      {/* Contexto */}
      <div className="flex bg-gray-200 rounded-full p-1 gap-1 mb-4 w-fit">
        {(['dfl', 'personal'] as Context[]).map(c => (
          <button
            key={c}
            onClick={() => setContext(c)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              context === c
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            {c === 'dfl' ? 'DFL' : 'Pessoal'}
          </button>
        ))}
      </div>

      {/* Tipo */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {types.map(t => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`py-2 rounded-xl text-xs font-semibold transition-all ${
              type === t.key
                ? `${t.color} text-white shadow-md`
                : 'bg-white text-gray-500 border border-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">

        {/* Valor */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs text-gray-500 mb-1 block font-bold uppercase">Valor (R$)</label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-3xl font-bold text-gray-900 outline-none"
          />
        </div>

        {/* Descrição */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs text-gray-500 mb-1 block font-bold uppercase">Descrição</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Compra no mercado"
            className="w-full bg-transparent text-sm text-gray-800 outline-none"
          />
        </div>

        {/* Conta */}
        {accounts.length > 0 ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-xs text-gray-500 mb-1 block font-bold uppercase">Conta</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full bg-transparent text-sm text-gray-800 outline-none py-1"
            >
              <option value="">Selecionar...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-xs text-red-500 px-2">Crie uma conta primeiro para lançar valores.</p>
        )}

        {/* Categoria */}
        {categories.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-xs text-gray-500 mb-3 block font-bold uppercase">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                    categoryId === cat.id
                      ? 'bg-emerald-900 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <span>{cat.icon}</span> {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Data */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-xs text-gray-500 mb-1 block font-bold uppercase">Data</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-transparent text-sm text-gray-800 outline-none"
            />
          </div>

          {/* Status */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-xs text-gray-500 mb-1 block font-bold uppercase">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as 'done' | 'pending')}
              className="w-full bg-transparent text-sm text-gray-800 outline-none py-1"
            >
              <option value="done">✅ Pago</option>
              <option value="pending">⏳ Pendente</option>
            </select>
          </div>
        </div>

        {/* Comprovante */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs text-gray-500 mb-2 block font-bold uppercase">Comprovante</label>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Paperclip size={18} className="text-gray-500" />
            </div>
            <span className="text-sm text-gray-500 truncate flex-1">
              {receipt ? receipt.name : 'Anexar recibo'}
            </span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => setReceipt(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-emerald-900 text-white rounded-2xl py-4 font-bold text-sm disabled:opacity-50 mt-4 shadow-lg"
        >
          {saving ? 'Salvando...' : 'Salvar transação'}
        </button>

      </div>
    </div>
  )
}
