'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Copy, Trash2, Calendar, Edit3, Tag, Wallet, CreditCard, RefreshCw, Check, Loader2, ChevronRight, ArrowLeftRight } from 'lucide-react'
import { format } from 'date-fns'

export default function EditTransactionPage() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tx, setTx] = useState<any>(null)
  
  // Listas para os selects
  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  // Campos do formulário
  const [amountInput, setAmountInput] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [notes, setNotes] = useState('')

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)

    // 1. Busca a transação
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (txData) {
      setTx(txData)
      setIsPaid(txData.status === 'done')
      setDate(txData.date)
      setDescription(txData.description || '')
      setCategoryId(txData.category_id || '')
      setAccountId(txData.account_id || '')
      setNotes(txData.notes || '')
      
      // Formata o valor inicial para exibir
      setAmountInput(Number(txData.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    }

    // 2. Busca contas e categorias para os selects
    const { data: accData } = await supabase.from('accounts').select('id, name').order('name')
    if (accData) setAccounts(accData)

    const { data: catData } = await supabase.from('categories').select('id, name, color, icon').order('name')
    if (catData) setCategories(catData)

    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    setAmountInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    setSaving(true)
    const rawAmount = parseFloat(amountInput.replace(/\./g, '').replace(',', '.'))
    
    await supabase
      .from('transactions')
      .update({
        amount: rawAmount,
        status: isPaid ? 'done' : 'pending',
        date,
        description,
        category_id: categoryId || null,
        account_id: accountId || null,
        notes
      })
      .eq('id', id)
      
    setSaving(false)
    router.back()
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return
    setSaving(true)
    await supabase.from('transactions').delete().eq('id', id)
    router.back()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <Loader2 className="animate-spin text-teal-700" size={40} />
    </div>
  )

  if (!tx) return <div className="p-6 text-center text-gray-500">Transação não encontrada.</div>

  const isIncome = tx.type === 'income'
  const typeLabel = isIncome ? 'receita' : 'despesa'
  const colorClass = isIncome ? 'text-emerald-600' : 'text-gray-800' // Base color for value
  const toggleBgClass = isPaid 
    ? (isIncome ? 'bg-emerald-600' : 'bg-red-500') 
    : 'bg-gray-300'

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] font-sans pb-24 relative">
      
      {/* Header */}
      <div className="flex justify-between items-center p-4">
        <button onClick={() => router.back()} className="text-gray-800 p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold text-[16px] text-gray-800 capitalize">Editar {typeLabel}</h1>
        <div className="flex items-center gap-4 text-teal-700">
          <button><Copy size={20} /></button>
          <button onClick={handleDelete} className="text-red-500"><Trash2 size={20} /></button>
        </div>
      </div>

      {/* Valor Header */}
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
          />
        </div>
      </div>

      {/* Card Principal de Opções */}
      <div className="bg-white rounded-t-[32px] px-6 py-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] space-y-6">
        
        {/* Toggle Pago/Recebido */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-5">
          <div className="flex items-center gap-4">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${isPaid ? 'bg-gray-800' : 'bg-gray-300'}`}>
              <Check size={14} />
            </div>
            <span className="font-bold text-[15px] text-gray-800">{isIncome ? 'Recebido' : 'Pago'}</span>
          </div>
          <button 
            onClick={() => setIsPaid(!isPaid)} 
            className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${toggleBgClass}`}
          >
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${isPaid ? 'right-1' : 'left-1'}`} />
          </button>
        </div>

        {/* Data */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-5 relative">
          <Calendar size={22} className="text-gray-400" />
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 text-[15px] font-bold text-gray-800 outline-none bg-transparent"
          />
          <div className="flex items-center gap-2 text-gray-400">
            <ChevronLeft size={18} />
            <ChevronRight size={18} />
          </div>
        </div>

        {/* Descrição */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
          <Edit3 size={22} className="text-gray-400" />
          <input 
            type="text" 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (ex: Corte de Cabelo)"
            className="flex-1 text-[15px] text-gray-800 outline-none bg-transparent placeholder:text-gray-300"
          />
        </div>

        {/* Categoria */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
          <Tag size={22} className="text-gray-400" />
          <div className="flex-1 flex flex-col">
            <span className="font-bold text-[14px] text-gray-800">Categoria</span>
            <select 
              value={categoryId} 
              onChange={(e) => setCategoryId(e.target.value)}
              className="text-[13px] text-gray-500 outline-none bg-transparent mt-0.5 appearance-none"
            >
              <option value="">Selecione uma categoria...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </div>

        {/* Conta */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
          <Wallet size={22} className="text-gray-400" />
          <div className="flex-1 flex flex-col">
            <span className="font-bold text-[14px] text-gray-800">Conta</span>
            <select 
              value={accountId} 
              onChange={(e) => setAccountId(e.target.value)}
              className="text-[13px] text-gray-500 outline-none bg-transparent mt-0.5 appearance-none"
            >
              <option value="">Selecione uma conta...</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </div>

        {/* Repetição */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
          <RefreshCw size={22} className="text-gray-400" />
          <div className="flex-1 flex flex-col gap-2">
            <span className="font-bold text-[14px] text-gray-800">Repetição</span>
            <div className="flex items-center gap-2">
              <button className="px-4 py-1.5 rounded-full border border-teal-700 text-teal-700 bg-teal-50 text-[13px] font-medium">Única</button>
              <button className="px-4 py-1.5 rounded-full bg-gray-100 text-gray-500 text-[13px] font-medium">Parcelar</button>
              <button className="px-4 py-1.5 rounded-full bg-gray-100 text-gray-500 text-[13px] font-medium">Recorrente</button>
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="flex items-center gap-4 pb-5">
          <Edit3 size={22} className="text-gray-400 opacity-50" />
          <input 
            type="text" 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações"
            className="flex-1 text-[14px] text-gray-800 outline-none bg-transparent placeholder:text-gray-300"
          />
        </div>

      </div>

      {/* Botão de Salvar Flutuante */}
      <div className="fixed bottom-6 left-0 w-full flex justify-center pointer-events-none">
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
