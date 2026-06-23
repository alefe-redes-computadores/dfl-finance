'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ChevronLeft, Copy, Trash2, Calendar, Edit3, Tag, Wallet, RefreshCw, Check, Loader2, ChevronRight, ArrowRightLeft, Building, HandCoins } from 'lucide-react'
import { format } from 'date-fns'

export default function EditTransactionPage() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tx, setTx] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)

  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])

  const [amountInput, setAmountInput] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [txType, setTxType] = useState<'income' | 'expense'>('expense')

  const [showDetails, setShowDetails] = useState(false)
  const [notes, setNotes] = useState('')
  const [tagId, setTagId] = useState('')
  const [isRefund, setIsRefund] = useState(false)
  const [isFinancing, setIsFinancing] = useState(false)
  const [isLoan, setIsLoan] = useState(false)

  const handleDateChange = (newDateStr: string) => {
    setDate(newDateStr)
    const selectedDate = new Date(newDateStr + 'T12:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selectedDate.setHours(0, 0, 0, 0)

    setIsPaid(selectedDate <= today)
  }

  const loadData = useCallback(async () => {
    if (id === 'new') {
      setIsNew(true)
      const paramType = searchParams.get('type')
      if (paramType === 'income' || paramType === 'expense') {
        setTxType(paramType)
        if (paramType === 'income') setIsPaid(true)
      }
    }

    setLoading(true)

    try {
      const [{ data: accData }, { data: catData }, { data: tagData }] = await Promise.all([
        supabase.from('accounts').select('id, name, balance').order('name'),
        supabase.from('categories').select('id, name, color, icon').order('name'),
        supabase.from('tags').select('id, name').order('name')
      ])

      setAccounts(accData || [])
      setCategories(catData || [])
      setTags(tagData || [])

      if (id && id !== 'new') {
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', id)
          .single()

        if (txError) {
          console.error('Erro Supabase (Transação):', txError)
          alert('Erro ao buscar transação.')
        } else if (txData) {
          setTx(txData)
          setTxType(txData.type)
          setIsPaid(txData.status === 'done')
          setDate(txData.date)
          setDescription(txData.description || '')
          setCategoryId(txData.category_id || '')
          setAccountId(txData.account_id || '')
          setTagId(txData.tag_id || '')
          setNotes(txData.notes || '')

          const amountSafe = Number(txData.amount) || 0
          setAmountInput(amountSafe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
        }
      }
    } catch (err) {
      console.error('Erro inesperado no loadData:', err)
    } finally {
      setLoading(false)
    }
  }, [id, searchParams])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    setAmountInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    if (!user?.id) {
      alert('Sessão expirada. Faça login novamente.')
      return
    }

    setSaving(true)

    // Converter valor formatado (ex: "1.234,56") para número
    const rawAmount = parseFloat(amountInput.replace(/\./g, '').replace(',', '.'))

    if (isNaN(rawAmount) || rawAmount <= 0) {
      alert('Informe um valor válido.')
      setSaving(false)
      return
    }

    let finalNotes = notes
    if (txType === 'expense' && (isRefund || isFinancing || isLoan)) {
      const flags = []
      if (isRefund) flags.push('[Devolução/Estorno]')
      if (isFinancing) flags.push('[Financiamento]')
      if (isLoan) flags.push('[Empréstimo]')
      finalNotes = `${flags.join(' ')} ${notes}`.trim()
    }

    const payload = {
      user_id: user.id,
      amount: rawAmount,
      status: isPaid ? 'done' : 'pending',
      date,
      description: description || null,
      category_id: categoryId || null,
      account_id: accountId || null,
      notes: finalNotes || null,
      type: txType,
      context: 'dfl'
    }

    try {
      // --- Estorno do valor antigo (se a transação original estava como 'done') ---
      if (!isNew && tx && tx.status === 'done' && tx.account_id) {
        // Buscar saldo atual da conta antiga no banco
        const { data: oldAccData, error: oldAccError } = await supabase
          .from('accounts')
          .select('balance')
          .eq('id', tx.account_id)
          .single()

        if (oldAccError) throw oldAccError

        const oldBalance = Number(oldAccData.balance) || 0
        const oldAmount = Number(tx.amount)
        const revertedBalance = tx.type === 'income'
          ? oldBalance - oldAmount
          : oldBalance + oldAmount

        const { error: revertError } = await supabase
          .from('accounts')
          .update({ balance: revertedBalance })
          .eq('id', tx.account_id)

        if (revertError) throw revertError
      }

      // --- Aplicar o novo valor (se o novo status for 'done' e houver conta) ---
      if (isPaid && accountId) {
        const { data: newAccData, error: newAccError } = await supabase
          .from('accounts')
          .select('balance')
          .eq('id', accountId)
          .single()

        if (newAccError) throw newAccError

        const currentBalance = Number(newAccData.balance) || 0
        const updatedBalance = txType === 'income'
          ? currentBalance + rawAmount
          : currentBalance - rawAmount

        const { error: applyError } = await supabase
          .from('accounts')
          .update({ balance: updatedBalance })
          .eq('id', accountId)

        if (applyError) throw applyError
      }

      // Salvar/atualizar a transação
      if (isNew) {
        const { error } = await supabase.from('transactions').insert([payload])
        if (error) throw error
      } else {
        const { error } = await supabase.from('transactions').update(payload).eq('id', id)
        if (error) throw error
      }

      router.refresh()
      router.back()
    } catch (err: any) {
      console.error('Erro ao salvar:', err)
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return
    setSaving(true)

    if (tx && tx.status === 'done' && tx.account_id) {
      const acc = accounts.find(a => a.id === tx.account_id)
      if (acc) {
        const oldAmount = Number(tx.amount)
        const newBalance = Number(acc.balance) + (tx.type === 'income' ? -oldAmount : oldAmount)
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', tx.account_id)
      }
    }

    await supabase.from('transactions').delete().eq('id', id)

    router.refresh()
    router.back()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  const isIncome = txType === 'income'
  const typeLabel = isIncome ? 'receita' : 'despesa'
  const colorClass = isIncome ? 'text-emerald-600' : 'text-gray-800'
  const toggleBgClass = isPaid ? (isIncome ? 'bg-emerald-600' : 'bg-teal-700') : 'bg-gray-300'

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] font-sans pb-24 relative">
      <div className="flex justify-between items-center p-4">
        <button onClick={() => router.back()} className="text-gray-800 p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold text-[16px] text-gray-800 capitalize">{isNew ? `Nova ${typeLabel}` : `Editar ${typeLabel}`}</h1>
        <div className="flex items-center gap-4 text-teal-700">
          {!isNew && <button><Copy size={20} /></button>}
          {!isNew && <button onClick={handleDelete} className="text-red-500"><Trash2 size={20} /></button>}
        </div>
      </div>

      <div className="px-6 py-4 mb-4">
        <p className="text-gray-500 text-[13px] font-medium mb-2 capitalize">Valor da {typeLabel}</p>
        <div className="flex items-center gap-2">
          <span className="text-3xl text-gray-400 font-light">R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={amountInput}
            onChange={handleAmountChange}
            className={`text-4xl font-light bg-transparent outline-none w-full ${colorClass}`}
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="bg-white rounded-t-[32px] px-6 py-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-5">
          <div className="flex items-center gap-4">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${isPaid ? 'bg-gray-800' : 'bg-gray-300'}`}>
              <Check size={14} />
            </div>
            <span className="font-bold text-[15px] text-gray-800">{isIncome ? 'Recebido' : 'Pago'}</span>
          </div>
          <button onClick={() => setIsPaid(!isPaid)} className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${toggleBgClass}`}>
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${isPaid ? 'right-1' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center gap-4 border-b border-gray-100 pb-5 relative">
          <Calendar size={22} className="text-gray-400" />
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="flex-1 text-[15px] font-bold text-gray-800 outline-none bg-transparent"
          />
        </div>

        <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
          <Edit3 size={22} className="text-gray-400" />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
            className="flex-1 text-[15px] text-gray-800 outline-none bg-transparent placeholder:text-gray-300"
          />
        </div>

        <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
          <Tag size={22} className="text-gray-400" />
          <div className="flex-1 flex flex-col">
            <span className="font-bold text-[14px] text-gray-800">Categoria</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="text-[14px] text-gray-500 outline-none bg-transparent mt-0.5 appearance-none cursor-pointer">
              <option value="">Selecione...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </div>

        <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
          <Wallet size={22} className="text-gray-400" />
          <div className="flex-1 flex flex-col">
            <span className="font-bold text-[14px] text-gray-800">Conta</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="text-[14px] text-gray-500 outline-none bg-transparent mt-0.5 appearance-none cursor-pointer">
              <option value="">Selecione...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </div>

        <div className="flex justify-center pt-2 pb-2">
          <button onClick={() => setShowDetails(!showDetails)} className="text-[14px] font-bold text-teal-700 hover:text-teal-800 transition-colors">
            {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          </button>
        </div>

        {showDetails && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
              <RefreshCw size={22} className="text-gray-400" />
              <div className="flex-1 flex flex-col gap-3">
                <span className="font-bold text-[14px] text-gray-800">Repetição</span>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                  <button className="px-4 py-1.5 rounded-full border border-teal-700 text-teal-700 bg-teal-50 text-[13px] font-medium whitespace-nowrap">Única</button>
                  <button className="px-4 py-1.5 rounded-full bg-gray-50 text-gray-500 text-[13px] font-medium whitespace-nowrap">Parcelar</button>
                  <button className="px-4 py-1.5 rounded-full bg-gray-50 text-gray-500 text-[13px] font-medium whitespace-nowrap">Recorrente</button>
                </div>
              </div>
            </div>

            {!isIncome && (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                  <div className="flex items-center gap-4">
                    <ArrowRightLeft size={22} className="text-gray-400" />
                    <div className="flex flex-col">
                      <span className="font-bold text-[14px] text-gray-800">É uma devolução / estorno</span>
                      <span className="text-[11px] text-gray-400">Abate o gasto da categoria no relatório</span>
                    </div>
                  </div>
                  <button onClick={() => setIsRefund(!isRefund)} className={`w-11 h-6 rounded-full relative transition-colors ${isRefund ? 'bg-teal-700' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isRefund ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                  <div className="flex items-center gap-4">
                    <Building size={22} className="text-gray-400" />
                    <span className="font-bold text-[14px] text-gray-800">Financiamento</span>
                  </div>
                  <button onClick={() => setIsFinancing(!isFinancing)} className={`w-11 h-6 rounded-full relative transition-colors ${isFinancing ? 'bg-teal-700' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isFinancing ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                  <div className="flex items-center gap-4">
                    <HandCoins size={22} className="text-gray-400" />
                    <div className="flex flex-col">
                      <span className="font-bold text-[14px] text-gray-800">Empréstimo a alguém</span>
                      <span className="text-[11px] text-gray-400">Vira saldo a receber em "Quem me deve"</span>
                    </div>
                  </div>
                  <button onClick={() => setIsLoan(!isLoan)} className={`w-11 h-6 rounded-full relative transition-colors ${isLoan ? 'bg-teal-700' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isLoan ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </>
            )}

            <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
              <Edit3 size={22} className="text-gray-400 opacity-50" />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações"
                className="flex-1 text-[14px] text-gray-800 outline-none bg-transparent placeholder:text-gray-300"
              />
            </div>

            <div className="flex items-center gap-4 pb-2">
              <Tag size={22} className="text-gray-400 opacity-50" />
              <div className="flex-1 flex flex-col">
                <span className="font-bold text-[14px] text-gray-800">Tags</span>
                <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="text-[14px] text-gray-500 outline-none bg-transparent mt-0.5 appearance-none cursor-pointer">
                  <option value="">Nenhuma tag</option>
                  {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-6 left-0 w-full flex justify-center pointer-events-none z-50">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-14 h-14 bg-teal-700 rounded-full flex items-center justify-center text-white shadow-xl pointer-events-auto hover:bg-teal-800 transition-colors"
        >
          {saving ? <Loader2 className="animate-spin" size={24} /> : <Check size={28} />}
        </button>
      </div>
    </div>
  )
}