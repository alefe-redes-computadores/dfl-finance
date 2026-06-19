'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Calendar, Tag, Wallet, ChevronDown, ChevronUp, Check, Paperclip, X } from 'lucide-react'

type TxType = 'income' | 'expense' | 'transfer'
type Context = 'dfl' | 'personal'

function NewTransactionContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [type, setType] = useState<TxType>((searchParams.get('type') as TxType) || 'expense')
  const [context, setContext] = useState<Context>('dfl')
  const [amount, setAmount] = useState('0,00')
  const [amountNum, setAmountNum] = useState(0)
  const [isPaid, setIsPaid] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [desc, setDesc] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [receipt, setReceipt] = useState<File | null>(null)

  // Modais de seleção
  const [showCatModal, setShowCatModal] = useState(false)
  const [showAccModal, setShowAccModal] = useState(false)

  const isIncome = type === 'income'
  const themeColor = isIncome ? 'text-emerald-700' : 'text-red-600'
  const bgColor = isIncome ? 'bg-emerald-700' : 'bg-red-600'
  const selectedCat = categories.find(c => c.id === categoryId)
  const selectedAcc = accounts.find(a => a.id === accountId)

  const loadData = useCallback(async () => {
    if (!user?.id) return
    const catType = type === 'income' ? 'income' : 'expense'
    const [{ data: cats }, { data: accs }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id).eq('context', context).eq('type', catType),
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('context', context)
    ])
    setCategories(cats ?? [])
    setAccounts(accs ?? [])
    setCategoryId('')
    setAccountId('')
  }, [user, context, type])

  useEffect(() => { loadData() }, [loadData])

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '')
    const num = Number(val) / 100
    setAmountNum(num)
    setAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    if (amountNum <= 0) { alert('Informe um valor.'); return }
    setSaving(true)
    try {
      let receiptUrl = null
      if (receipt) {
        const ext = receipt.name.split('.').pop()
        const path = `${user!.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('receipts').upload(path, receipt)
        if (!upErr) {
          const { data } = supabase.storage.from('receipts').getPublicUrl(path)
          receiptUrl = data.publicUrl
        }
      }
      await supabase.from('transactions').insert({
        user_id: user!.id,
        type,
        amount: amountNum,
        description: desc || null,
        category_id: categoryId || null,
        account_id: accountId || null,
        date,
        status: isPaid ? 'done' : 'pending',
        context,
        receipt_url: receiptUrl,
      })
      router.push('/transactions')
    } catch (e) {
      console.error(e)
      alert('Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-transition min-h-screen bg-white font-sans text-gray-800 pb-32">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800">
          <ChevronLeft size={22} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="font-bold text-base">
          {type === 'income' ? 'Nova Receita' : type === 'transfer' ? 'Nova Transferência' : 'Nova Despesa'}
        </h1>
        {/* Ícone comprovante no header */}
        <label className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 cursor-pointer">
          <Paperclip size={18} className={receipt ? 'text-brand-teal' : 'text-gray-500'} />
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setReceipt(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      {/* Toggle contexto */}
      <div className="flex justify-center mt-2 mb-1">
        <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-full">
          {(['dfl', 'personal'] as Context[]).map(c => (
            <button key={c} onClick={() => setContext(c)}
              className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${context === c ? 'bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      {/* Valor */}
      <div className="py-6 text-center px-6">
        <p className="text-gray-400 text-xs mb-2">
          {type === 'income' ? 'Valor da receita' : type === 'transfer' ? 'Valor da transferência' : 'Valor da despesa'}
        </p>
        <div className="flex justify-center items-center gap-1">
          <span className={`text-2xl font-medium ${themeColor} opacity-60`}>R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={handleAmount}
            className={`text-5xl font-bold outline-none bg-transparent ${themeColor} w-48 text-center`}
          />
        </div>
      </div>

      {/* Campos */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl mx-4 shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">

        {/* Pago/Recebido toggle */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isPaid ? bgColor : 'bg-gray-200'}`}>
              {isPaid && <Check size={14} className="text-white" />}
            </div>
            <span className="font-medium text-sm">{isIncome ? 'Recebido' : 'Pago'}</span>
          </div>
          <button
            onClick={() => setIsPaid(!isPaid)}
            className={`w-12 h-6 rounded-full transition-colors duration-200 ${isPaid ? bgColor : 'bg-gray-300'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 mt-0.5 ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Data */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <Calendar size={18} className="text-gray-400 shrink-0" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="flex-1 outline-none bg-transparent text-sm font-medium text-gray-700 dark:text-gray-300"
          />
        </div>

        {/* Descrição */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="w-4 h-4 shrink-0" />
          <input
            placeholder="Descrição"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            className="flex-1 outline-none bg-transparent text-sm font-medium text-gray-700 dark:text-gray-300 placeholder-gray-400"
          />
        </div>

        {/* Categoria */}
        <button
          onClick={() => setShowCatModal(true)}
          className="w-full flex items-center gap-4 px-5 py-4 border-b border-gray-100 dark:border-zinc-800"
        >
          <Tag size={18} className="text-gray-400 shrink-0" />
          <span className={`flex-1 text-left text-sm font-medium ${selectedCat ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>
            {selectedCat ? `${selectedCat.icon ?? ''} ${selectedCat.name}` : 'Categoria'}
          </span>
          {selectedCat && (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedCat.color }} />
          )}
          <ChevronDown size={16} className="text-gray-400" />
        </button>

        {/* Conta */}
        <button
          onClick={() => setShowAccModal(true)}
          className="w-full flex items-center gap-4 px-5 py-4"
        >
          <Wallet size={18} className="text-gray-400 shrink-0" />
          <span className={`flex-1 text-left text-sm font-medium ${selectedAcc ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>
            {selectedAcc ? selectedAcc.name : 'Conta'}
          </span>
          <ChevronDown size={16} className="text-gray-400" />
        </button>
      </div>

      {/* Mais detalhes */}
      <div className="mx-4 mt-3">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-brand-teal text-sm font-bold flex items-center gap-1 py-2"
        >
          {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDetails && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden mt-2">
            {/* Comprovante */}
            <label className="flex items-center gap-4 px-5 py-4 cursor-pointer border-b border-gray-100 dark:border-zinc-800">
              <Paperclip size={18} className="text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-500">
                {receipt ? receipt.name : 'Anexar comprovante'}
              </span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setReceipt(e.target.files?.[0] ?? null)} />
            </label>

            {/* Tags — em breve */}
            <button
              onClick={() => {}}
              disabled
              className="w-full flex items-center gap-4 px-5 py-4 opacity-40"
            >
              <Tag size={18} className="text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-500 flex-1 text-left">Tags</span>
              <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-bold">Em breve</span>
            </button>
          </div>
        )}
      </div>

      {/* Botão salvar */}
      <div className="fixed bottom-8 w-full flex justify-center z-30">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-16 h-16 ${bgColor} rounded-full flex items-center justify-center shadow-xl disabled:opacity-60 transition-transform active:scale-95`}
        >
          {saving
            ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Check size={30} className="text-white" />
          }
        </button>
      </div>

      {/* Modal Categoria */}
      {showCatModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl p-5 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-gray-800 dark:text-white">Categoria</h3>
              <button onClick={() => setShowCatModal(false)}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {categories.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Nenhuma categoria cadastrada</p>
            ) : (
              <div className="space-y-1">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setCategoryId(cat.id); setShowCatModal(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${categoryId === cat.id ? 'bg-brand-teal/10' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${cat.color}20` }}>
                      {cat.icon}
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-white flex-1 text-left">{cat.name}</span>
                    {categoryId === cat.id && <Check size={16} className="text-brand-teal" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Conta */}
      {showAccModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAccModal(false)}>
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl p-5 max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-gray-800 dark:text-white">Conta</h3>
              <button onClick={() => setShowAccModal(false)}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {accounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm mb-3">Nenhuma conta cadastrada</p>
                <button
                  onClick={() => { setShowAccModal(false); router.push('/accounts') }}
                  className="text-brand-teal text-sm font-bold"
                >
                  Cadastrar conta →
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => { setAccountId(acc.id); setShowAccModal(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${accountId === acc.id ? 'bg-brand-teal/10' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-gray-500">
                      {acc.name[0]}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{acc.name}</p>
                      <p className="text-xs text-gray-400">
                        {Number(acc.balance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    {accountId === acc.id && <Check size={16} className="text-brand-teal" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewTransactionPage() {
  return (
    <Suspense>
      <NewTransactionContent />
    </Suspense>
  )
}