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
  const [isNew, setIsNew] = useState(false) // Flag para saber se é criação ou edição
  
  // Listas para os selects
  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  // Campos do formulário
  const [amountInput, setAmountInput] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [notes, setNotes] = useState('')
  // Adicionando um state default de type para Novas Transações. (Se for editar, ele será sobrescrito)
  const [txType, setTxType] = useState<'income' | 'expense'>('expense') 

  const loadData = useCallback(async () => {
    // Se o ID for 'new', estamos criando uma transação
    if (id === 'new') {
      setIsNew(true)
    }

    setLoading(true)

    try {
      // 1. Busca contas e categorias (sem filtro de user_id, já que RLS tá off e precisamos ver se carrega)
      const { data: accData, error: accError } = await supabase.from('accounts').select('id, name').order('name')
      if (accError) console.error("Erro Contas:", accError)
      else setAccounts(accData || [])

      const { data: catData, error: catError } = await supabase.from('categories').select('id, name, color, icon').order('name')
      if (catError) console.error("Erro Categorias:", catError)
      else setCategories(catData || [])

      // 2. Se for edição, busca a transação existente
      if (id && id !== 'new') {
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', id)
          .single()

        if (txError) {
          console.error("Erro Supabase (Transação):", txError)
          alert("Erro ao buscar transação: " + txError.message)
        } else if (txData) {
          setTx(txData)
          setTxType(txData.type)
          setIsPaid(txData.status === 'done')
          setDate(txData.date)
          setDescription(txData.description || '')
          setCategoryId(txData.category_id || '')
          setAccountId(txData.account_id || '')
          setNotes(txData.notes || '')
          // Proteção contra NaN
          const amountSafe = Number(txData.amount) || 0;
          setAmountInput(amountSafe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
        }
      }
    } catch (err) {
      console.error("Erro inesperado no loadData:", err)
    } finally {
      setLoading(false)
    }
  }, [id])


  useEffect(() => { loadData() }, [loadData])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    setAmountInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    setSaving(true)
    
    // Proteção contra valores vazios no salvamento
    const rawAmount = parseFloat(amountInput.replace(/\./g, '').replace(',', '.')) || 0;
    
    const payload = {
      amount: rawAmount,
      status: isPaid ? 'done' : 'pending',
      date,
      description: description || null,
      category_id: categoryId || null,
      account_id: accountId || null,
      notes: notes || null,
      type: txType,
      context: 'dfl' // Hardcoded para testar a inserção, deve vir do context global depois
    }

    try {
      if (isNew) {
         // Temporariamente removendo user_id do payload para ver se o insert passa
         const { error } = await supabase.from('transactions').insert([payload])
         if (error) {
            console.error("Erro ao inserir:", error)
            alert("Erro ao salvar: " + error.message)
         } else {
            router.back()
         }
      } else {
         const { error } = await supabase.from('transactions').update(payload).eq('id', id)
         if (error) {
            console.error("Erro ao atualizar:", error)
            alert("Erro ao atualizar: " + error.message)
         } else {
            router.back()
         }
      }
    } catch (err) {
       console.error("Catch save:", err)
       alert("Ocorreu um erro no código ao tentar salvar.")
    } finally {
      setSaving(false)
    }
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

  if (!isNew && !tx) return <div className="p-6 text-center text-gray-500">Transação não encontrada.</div>

  const isIncome = txType === 'income'
  const typeLabel = isIncome ? 'receita' : 'despesa'
  const colorClass = isIncome ? 'text-emerald-600' : 'text-gray-800'
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
        <h1 className="font-bold text-[16px] text-gray-800 capitalize">{isNew ? `Nova ${typeLabel}` : `Editar ${typeLabel}`}</h1>
        <div className="flex items-center gap-4 text-teal-700">
          {!isNew && <button><Copy size={20} /></button>}
          {!isNew && <button onClick={handleDelete} className="text-red-500"><Trash2 size={20} /></button>}
        </div>
      </div>

      {/* Tipo Toggle (Apenas se for Novo) */}
      {isNew && (
        <div className="px-6 mb-2">
           <div className="flex bg-gray-200 rounded-full p-1">
             <button onClick={() => setTxType('expense')} className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${txType === 'expense' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>Despesa</button>
             <button onClick={() => setTxType('income')} className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${txType === 'income' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>Receita</button>
           </div>
        </div>
      )}

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
            placeholder="0,00"
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
              className="text-[13px] text-gray-500 outline-none bg-transparent mt-0.5 appearance-none cursor-pointer"
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
              className="text-[13px] text-gray-500 outline-none bg-transparent mt-0.5 appearance-none cursor-pointer"
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
