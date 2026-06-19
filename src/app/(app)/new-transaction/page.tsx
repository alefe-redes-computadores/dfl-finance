'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Paperclip } from 'lucide-react'

type TxType = 'income' | 'expense' | 'sangria' | 'transfer'
type Context = 'dfl' | 'personal'

export default function NewTransactionPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultType = (searchParams.get('type') as TxType) || 'expense'

  const [type, setType] = useState<TxType>(defaultType)
  const [context, setContext] = useState<Context>('dfl')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  
  // Contas (accountId vira Origem em caso de transferência)
  const [accountId, setAccountId] = useState('') 
  const [toAccountId, setToAccountId] = useState('') // Conta de destino para transferências
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState<'done' | 'pending'>('done')
  const [receipt, setReceipt] = useState<File | null>(null)
  
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadOptions = useCallback(async () => {
    if (!user?.id) return
    const catType = type === 'income' ? 'income' : 'expense'

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
      .order('name')

    setCategories(cats ?? [])
    setAccounts(accs ?? [])
  }, [user, context, type])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  async function handleSave() {
    const numAmount = Number(amount.replace(',', '.'))
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Informe um valor válido.')
      return
    }
    if (!user) {
      setError('Usuário não autenticado.')
      return
    }
    if (!accountId) {
      setError(type === 'transfer' ? 'Selecione a conta de origem.' : 'Selecione uma conta.')
      return
    }
    if (type === 'transfer' && !toAccountId) {
      setError('Selecione a conta de destino.')
      return
    }
    if (type === 'transfer' && accountId === toAccountId) {
      setError('A conta de origem e destino não podem ser iguais.')
      return
    }

    setSaving(true)
    setError('')

    try {
      let receiptUrl = null

      // Upload do comprovante se houver
      if (receipt) {
        const ext = receipt.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(path, receipt)
        if (!upErr) {
          const { data } = supabase.storage.from('receipts').getPublicUrl(path)
          receiptUrl = data.publicUrl
        }
      }

      // 1. SALVAR A TRANSAÇÃO NO HISTÓRICO
      const { error: txErr } = await supabase.from('transactions').insert({
        user_id: user.id,
        type,
        amount: numAmount,
        description: description || (type === 'transfer' ? 'Transferência entre contas' : null),
        category_id: type === 'transfer' ? null : (categoryId || null),
        account_id: accountId,
        to_account_id: type === 'transfer' ? toAccountId : null,
        date,
        status,
        receipt_url: receiptUrl,
        context,
      })

      if (txErr) throw txErr

      // 2. ATUALIZAÇÃO DE SALDO AUTOMÁTICA SE ESTIVER MARCA COMO "CONCLUÍDA/PAGO"
      if (status === 'done') {
        if (type === 'income') {
          const account = accounts.find(a => a.id === accountId)
          const newBalance = Number(account.balance || 0) + numAmount
          await supabase.from('accounts').update({ balance: newBalance }).eq('id', accountId)
        } 
        else if (type === 'expense' || type === 'sangria') {
          const account = accounts.find(a => a.id === accountId)
          const newBalance = Number(account.balance || 0) - numAmount
          await supabase.from('accounts').update({ balance: newBalance }).eq('id', accountId)
        } 
        else if (type === 'transfer') {
          const fromAccount = accounts.find(a => a.id === accountId)
          const toAccount = accounts.find(a => a.id === toAccountId)
          
          const newFromBalance = Number(fromAccount.balance || 0) - numAmount
          const newToBalance = Number(toAccount.balance || 0) + numAmount

          await supabase.from('accounts').update({ balance: newFromBalance }).eq('id', accountId)
          await supabase.from('accounts').update({ balance: newToBalance }).eq('id', toAccountId)
        }
      }

      router.replace('/transactions')
    } catch (err: any) {
      console.error(err)
      setError(`Erro ao salvar: ${err.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  const types: { key: TxType; label: string; color: string }[] = [
    { key: 'income', label: 'Receita', color: 'bg-green-500' },
    { key: 'expense', label: 'Despesa', color: 'bg-red-500' },
    { key: 'sangria', label: 'Sangria', color: 'bg-orange-500' },
    { key: 'transfer', label: 'Transferência', color: 'bg-blue-500' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10 min-h-screen bg-slate-50 font-sans">

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
              context === c ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
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
              type === t.key ? `${t.color} text-white shadow-md` : 'bg-white text-gray-500 border border-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">

        {/* Valor */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs text-gray-500 mb-1 block font-bold uppercase tracking-wider">Valor (R$)</label>
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
          <label className="text-xs text-gray-500 mb-1 block font-bold uppercase tracking-wider">Descrição</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={type === 'transfer' ? 'Ex: Transferência para reserva' : 'Ex: Compra no mercado'}
            className="w-full bg-transparent text-sm text-gray-800 outline-none"
          />
        </div>

        {/* Fluxo Dinâmico de Contas */}
        {accounts.length > 0 ? (
          <div className="space-y-4">
            {/* Conta Normal ou Conta de Origem */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <label className="text-xs text-gray-500 mb-1 block font-bold uppercase tracking-wider">
                {type === 'transfer' ? 'Conta de Origem (Sairá Saldo)' : 'Conta'}
              </label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-800 outline-none py-1"
              >
                <option value="">Selecionar conta...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} (R$ {Number(acc.balance).toFixed(2)})</option>
                ))}
              </select>
            </div>

            {/* SE FOR TRANSFERÊNCIA: Mostrar campo da Conta de Destino */}
            {type === 'transfer' && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-in fade-in duration-200">
                <label className="text-xs text-gray-500 mb-1 block font-bold uppercase tracking-wider">Conta de Destino (Entrará Saldo)</label>
                <select
                  value={toAccountId}
                  onChange={e => setToAccountId(e.target.value)}
                  className="w-full bg-transparent text-sm text-gray-800 outline-none py-1"
                >
                  <option value="">Selecionar destino...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (R$ {Number(acc.balance).toFixed(2)})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-red-500 font-bold px-2">Crie uma conta primeiro na aba "Mais" antes de fazer lançamentos.</p>
        )}

        {/* Categoria (Esconder se for Transferência) */}
        {type !== 'transfer' && categories.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-xs text-gray-500 mb-3 block font-bold uppercase tracking-wider">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    categoryId === cat.id ? 'bg-emerald-900 text-white shadow-md' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <span>{cat.icon}</span> {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Data e Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-xs text-gray-500 mb-1 block font-bold uppercase tracking-wider">Data</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-transparent text-sm text-gray-800 outline-none"
            />
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-xs text-gray-500 mb-1 block font-bold uppercase tracking-wider">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as 'done' | 'pending')}
              className="w-full bg-transparent text-sm text-gray-800 outline-none py-1"
            >
              <option value="done">✅ Concluído</option>
              <option value="pending">⏳ Pendente</option>
            </select>
          </div>
        </div>

        {/* Comprovante */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs text-gray-500 mb-2 block font-bold uppercase tracking-wider">Comprovante</label>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Paperclip size={18} className="text-gray-500" />
            </div>
            <span className="text-sm text-gray-500 truncate flex-1 font-medium">
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
          className="w-full bg-emerald-900 text-white rounded-2xl py-4 font-bold text-sm disabled:opacity-50 mt-4 shadow-lg transition-all active:scale-[0.99]"
        >
          {saving ? 'Salvando...' : 'Salvar transação'}
        </button>

      </div>
    </div>
  )
}
