'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Tag, Wallet, ChevronDown, ChevronUp, Check, Paperclip } from 'lucide-react'

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
  const [tagId, setTagId] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [saving, setSaving] = useState(false)

  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [receipt, setReceipt] = useState<File | null>(null)

  const [showCatModal, setShowCatModal] = useState(false)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)

  const handleDateChange = (newDateStr: string) => {
    setDate(newDateStr)
    const selectedDate = new Date(newDateStr + 'T12:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selectedDate.setHours(0, 0, 0, 0)

    setIsPaid(selectedDate <= today)
  }

  const isIncome = type === 'income'
  const themeColor = isIncome ? 'text-emerald-700' : 'text-red-600'
  const bgColor = isIncome ? 'bg-emerald-700' : 'bg-red-600'
  const selectedCat = categories.find(c => c.id === categoryId)
  const selectedAcc = accounts.find(a => a.id === accountId)
  const selectedTag = tags.find(t => t.id === tagId)

  const loadData = useCallback(async () => {
    if (!user?.id) return
    const catType = type === 'income' ? 'income' : 'expense'

    const [{ data: cats }, { data: accs }, { data: tgs }] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('context', context)
        .eq('type', catType),
      supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('context', context)
        .order('name'),
      supabase
        .from('tags')
        .select('*')
        .eq('user_id', user.id)
        .eq('context', context)
        .order('name')
    ])

    setCategories(Array.isArray(cats) ? cats : [])
    setAccounts(Array.isArray(accs) ? accs : [])
    setTags(Array.isArray(tgs) ? tgs : [])
  }, [user, context, type])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setAmount(val) // Atualiza o visual
    
    // Converte para número de forma segura
    const rawValue = val.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(rawValue)
    setAmountNum(isNaN(num) ? 0 : num) 
  }

  const handleSave = async () => {
    const rawAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.')) || 0;
    
    if (rawAmount <= 0) {
      alert("Erro: O valor da transação deve ser maior que R$ 0,00.");
      setSaving(false);
      return;
    }

    setSaving(true)
    try {
      let receiptUrl = null

      if (receipt) {
        const ext = receipt.name.split('.').pop()
        const path = `${user!.id}/${Date.now()}.${ext}`
        const { data } = await supabase.storage.from('receipts').upload(path, receipt)

        if (data) {
          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
          receiptUrl = urlData.publicUrl
        }
      }

      const { error } = await supabase.from('transactions').insert({
        user_id: user!.id,
        type,
        amount: rawAmount,
        description: desc || null,
        category_id: categoryId || null,
        account_id: accountId || null,
        tag_id: tagId || null,
        date,
        status: isPaid ? 'done' : 'pending',
        context,
        receipt_url: receiptUrl,
      })

      if (error) throw error

      if (isPaid && accountId) {
        const { data: acc } = await supabase.from('accounts').select('balance').eq('id', accountId).single()
        
        if (acc) {
          const currentBalance = Number(acc.balance) || 0
          const newBalance = type === 'income'
            ? currentBalance + rawAmount
            : currentBalance - rawAmount

          await supabase.from('accounts').update({ balance: newBalance }).eq('id', accountId)
        }
      }

      router.refresh()
      router.push('/transactions')
    } catch (e) {
      console.error(e)
      alert('Erro ao salvar transação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-black font-sans text-gray-800 overflow-y-auto pb-32">
      <div className="flex items-center justify-between px-4 pt-5 pb-2 sticky top-0 bg-white dark:bg-black z-40">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
          <ChevronLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-base">Nova Transação</h1>
        <label className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 cursor-pointer">
          <Paperclip size={18} className={receipt ? 'text-emerald-700' : 'text-gray-500'} />
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={e => setReceipt(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div className="flex justify-center mt-2 mb-1">
        <div className="flex bg-gray-100 p-1 rounded-full">
          {(['dfl', 'personal'] as Context[]).map(c => (
            <button
              key={c}
              onClick={() => setContext(c)}
              className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                context === c ? 'bg-white shadow-sm' : 'text-gray-500'
              }`}
            >
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      <div className="py-6 text-center px-6">
        <p className="text-gray-400 text-xs mb-2">Valor</p>
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

      <div className="bg-white rounded-3xl mx-4 shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-medium text-sm">{isIncome ? 'Recebido' : 'Pago'}</span>
          <button onClick={() => setIsPaid(!isPaid)} className={`w-12 h-6 rounded-full transition-colors ${isPaid ? bgColor : 'bg-gray-300'}`}>
            <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <button onClick={() => setShowCatModal(true)} className="w-full flex items-center gap-4 px-5 py-4 border-b border-gray-100">
          <Tag size={18} className="text-gray-400" />
          <span className={`flex-1 text-left text-sm font-medium ${selectedCat ? 'text-gray-800' : 'text-gray-400'}`}>
            {selectedCat ? `${selectedCat.icon} ${selectedCat.name}` : 'Categoria'}
          </span>
        </button>

        <button onClick={() => setShowAccModal(true)} className="w-full flex items-center gap-4 px-5 py-4">
          <Wallet size={18} className="text-gray-400" />
          <span className={`flex-1 text-left text-sm font-medium ${selectedAcc ? 'text-gray-800' : 'text-gray-400'}`}>
            {selectedAcc ? selectedAcc.name : 'Conta'}
          </span>
        </button>
      </div>

      <div className="mx-4 mt-3">
        <button onClick={() => setShowDetails(!showDetails)} className="text-emerald-800 text-sm font-bold flex items-center gap-1 py-2">
          {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDetails && (
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden mt-2">
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-5 py-4 text-sm border-b border-gray-100 outline-none"
            />
            <input
              placeholder="Descrição"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-5 py-4 text-sm border-b border-gray-100 outline-none"
            />
            <button onClick={() => setShowTagModal(true)} className="w-full flex items-center gap-4 px-5 py-4">
              <Tag size={18} className="text-gray-400" />
              <span className={`text-sm font-medium ${selectedTag ? 'text-gray-800' : 'text-gray-400'}`}>
                {selectedTag ? selectedTag.name : 'Vincular Tag'}
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-8 w-full flex justify-center z-50">
        <button onClick={handleSave} disabled={saving} className={`w-16 h-16 ${bgColor} rounded-full flex items-center justify-center shadow-xl`}>
          {saving ? <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" /> : <Check size={30} className="text-white" />}
        </button>
      </div>

      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 h-[50vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-4">Categorias</h3>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => { setCategoryId(cat.id); setShowCatModal(false) }} className="w-full p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}20` }}>
                  {cat.icon}
                </div>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAccModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 h-[50vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-4">Selecionar Conta</h3>
            {accounts.map(acc => (
              <button key={acc.id} onClick={() => { setAccountId(acc.id); setShowAccModal(false) }} className="w-full p-3 flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: acc.color }}
                >
                  {acc.name.substring(0, 2).toUpperCase()}
                </div>
                {acc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 h-[50vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-4">Selecionar Tag</h3>
            {tags.map(tag => (
              <button key={tag.id} onClick={() => { setTagId(tag.id); setShowTagModal(false) }} className="w-full p-3 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewTransactionPage() {
  return <Suspense><NewTransactionContent /></Suspense>
}