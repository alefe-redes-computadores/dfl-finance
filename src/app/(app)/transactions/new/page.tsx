'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Tag, Wallet, ChevronDown, ChevronUp, Check,
  Camera, Plus, Hash, ArrowRightLeft, Building, HandCoins, X
} from 'lucide-react'
import { addMonths, addWeeks, format } from 'date-fns'
import ReceiptModal from '@/components/ReceiptModal'
import ComingSoonModal from '@/components/ComingSoonModal'
import CameraCapture from '@/components/CameraCapture'

type TxType = 'income' | 'expense' | 'transfer'
type Context = 'dfl' | 'personal'
type Repetition = 'once' | 'installments' | 'recurring'
type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'custom'

const CATEGORY_ICONS = ['🛒', '🏍️', '💸', '🔧', '📦', '💰', '🛵', '🍔', '🚗', '💖', '🎮', '🏠', '💼', '💻', '📋', '🎯', '⚡', '🎵']
const CATEGORY_COLORS = ['#22c55e', '#ef4444', '#f97316', '#06b6d4', '#8b5cf6', '#eab308', '#94a3b8', '#ec4899', '#14b8a6']

function NewTransactionContent() {
  console.log("DFL – Nova Transação v6.0 - Ícones à direita e Modal de Conta")

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
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [saving, setSaving] = useState(false)

  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [receipt, setReceipt] = useState<File | null>(null)
  const [installments, setInstallments] = useState(1)

  const [repetition, setRepetition] = useState<Repetition>('once')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [isRefund, setIsRefund] = useState(false)

  const [showCatModal, setShowCatModal] = useState(false)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [showCamera, setShowCamera] = useState(false)

  const [showCreateCatModal, setShowCreateCatModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('🍔')
  const [newCatColor, setNewCatColor] = useState('#22c55e')
  const [savingCategory, setSavingCategory] = useState(false)

  const [showCreateAccModal, setShowCreateAccModal] = useState(false)
  const [newAccName, setNewAccName] = useState('')
  const [newAccColor, setNewAccColor] = useState('#14b8a6')
  const [savingAccount, setSavingAccount] = useState(false)

  const [showCreateTagModal, setShowCreateTagModal] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#22c55e')
  const [savingTag, setSavingTag] = useState(false)

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

  const toggleTag = (id: string) => {
    setSelectedTags(prev => {
      if (prev.includes(id)) return prev.filter(t => t !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  const loadData = useCallback(async () => {
    if (!user || !user.id) return
    const catType = type === 'income' ? 'income' : 'expense'

    const [{ data: cats }, { data: accs }, { data: tgs }] = await Promise.all([
      supabase.from('categories').select('*')
        .eq('user_id', user.id)
        .eq('context', context)
        .eq('type', catType),
      supabase.from('accounts').select('*')
        .eq('user_id', user.id)
        .eq('context', context)
        .order('name'),
      supabase.from('tags').select('*')
        .eq('user_id', user.id)
        .eq('context', context)
        .order('name')
    ])

    setCategories(Array.isArray(cats) ? cats : [])
    setAccounts(Array.isArray(accs) ? accs : [])
    setTags(Array.isArray(tgs) ? tgs : [])
  }, [user, context, type])

  useEffect(() => { loadData() }, [loadData])

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setAmount(val)
    const rawValue = val.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(rawValue)
    setAmountNum(isNaN(num) ? 0 : num)
  }

  // Formata valor extraído para exibição
  const formatAmount = (value: string) => {
    const num = parseFloat(value.replace(/\./g, '').replace(',', '.'))
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Processa o comprovante e preenche campos automaticamente
  const processReceipt = async (file: File) => {
    setReceipt(file)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success && result.data) {
        const { amount: extractedAmount, date: extractedDate, description: extractedDesc } = result.data

        if (extractedAmount) {
          setAmount(formatAmount(extractedAmount))
          setAmountNum(parseFloat(extractedAmount.replace(/\./g, '').replace(',', '.')))
        }
        if (extractedDate) {
          const [day, month, year] = extractedDate.split('/')
          setDate(`${year}-${month}-${day}`)
        }
        if (extractedDesc) {
          setDesc(extractedDesc)
        }
      }
    } catch (error) {
      console.log('Leitura automática indisponível, comprovante anexado normalmente')
    }
  }

  const handleReceiptOption = (option: string) => {
    setShowReceiptModal(false)
    if (option === 'camera') {
      setShowCamera(true)
      return
    }
    if (option === 'galeria' || option === 'pdf') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = option === 'pdf' ? 'application/pdf' : 'image/*'
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0]
        if (file) processReceipt(file)
      }
      input.click()
    }
  }

  const handleCameraCapture = (file: File) => {
    processReceipt(file)
    setShowCamera(false)
  }

  const handleSaveCategory = async () => {
    if (!user?.id || !newCatName.trim()) return
    setSavingCategory(true)
    try {
      const { data, error } = await supabase.from('categories').insert({
        user_id: user.id,
        name: newCatName.trim(),
        icon: newCatIcon,
        color: newCatColor,
        context: context
      }).select().single()

      if (error) throw error
      if (data) {
        setCategories(prev => [...prev, data])
        setCategoryId(data.id) 
        setShowCreateCatModal(false)
        setNewCatName('') 
      }
    } catch (error) {
      console.error("Erro ao criar categoria:", error)
      alert("Erro ao criar categoria.")
    } finally {
      setSavingCategory(false)
    }
  }

  const handleSaveAccount = async () => {
    if (!user?.id || !newAccName.trim()) return
    setSavingAccount(true)
    try {
      const { data, error } = await supabase.from('accounts').insert({
        user_id: user.id,
        name: newAccName.trim(),
        color: newAccColor,
        context: context
      }).select().single()

      if (error) throw error
      if (data) {
        setAccounts(prev => [...prev, data])
        setAccountId(data.id) 
        setShowCreateAccModal(false)
        setNewAccName('') 
      }
    } catch (error) {
      console.error("Erro ao criar conta:", error)
      alert("Erro ao criar conta.")
    } finally {
      setSavingAccount(false)
    }
  }

  const handleSaveTag = async () => {
    if (!user?.id || !newTagName.trim()) return
    setSavingTag(true)
    try {
      const { data, error } = await supabase.from('tags').insert({
        user_id: user.id,
        name: newTagName.trim(),
        color: newTagColor,
        context: context
      }).select().single()

      if (error) throw error
      if (data) {
        setTags(prev => [...prev, data])
        setSelectedTags(prev => prev.length < 5 ? [...prev, data.id] : prev)
        setShowCreateTagModal(false)
        setNewTagName('') 
      }
    } catch (error) {
      console.error("Erro ao criar tag:", error)
      alert("Erro ao criar tag.")
    } finally {
      setSavingTag(false)
    }
  }

  const handleSave = async () => {
    if (!user?.id) return
    const rawAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.')) || 0
    if (rawAmount <= 0) {
      alert('Erro: O valor da transação deve ser maior que R$ 0,00.')
      return
    }
    setSaving(true)

    let receiptUrl: string | null = null
    if (receipt) {
      try {
        const ext = receipt.name.split('.').pop() || 'jpg'
        const uniqueName = `${crypto.randomUUID()}.${ext}`
        const path = `${user.id}/${uniqueName}`
        const { data, error: uploadError } = await supabase.storage.from('receipts').upload(path, receipt)
        if (!uploadError && data) {
          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
          receiptUrl = urlData.publicUrl
        }
      } catch (err) {}
    }

    let totalParcels = 1
    let recurringGroupId: string | null = null

    if (repetition === 'installments') {
      totalParcels = installments
      recurringGroupId = crypto.randomUUID()
    } else if (repetition === 'recurring') {
      recurringGroupId = crypto.randomUUID()
      switch (frequency) {
        case 'weekly': totalParcels = 52; break
        case 'biweekly': totalParcels = 24; break
        case 'monthly': totalParcels = 12; break
        case 'bimonthly': totalParcels = 6; break
        case 'custom': totalParcels = 12; break
        default: totalParcels = 12
      }
    }

    const installmentAmount = totalParcels > 1 ? rawAmount / totalParcels : rawAmount

    try {
      for (let i = 0; i < totalParcels; i++) {
        let installmentDate: string
        if (repetition === 'recurring') {
          const baseDate = new Date(date)
          if (frequency === 'weekly') installmentDate = format(addWeeks(baseDate, i), 'yyyy-MM-dd')
          else if (frequency === 'biweekly') installmentDate = format(addWeeks(baseDate, i * 2), 'yyyy-MM-dd')
          else if (frequency === 'monthly') installmentDate = format(addMonths(baseDate, i), 'yyyy-MM-dd')
          else if (frequency === 'bimonthly') installmentDate = format(addMonths(baseDate, i * 2), 'yyyy-MM-dd')
          else installmentDate = format(addMonths(baseDate, i), 'yyyy-MM-dd')
        } else {
          installmentDate = format(addMonths(new Date(date), i), 'yyyy-MM-dd')
        }

        const { error: insertError } = await supabase.from('transactions').insert({
          user_id: user.id,
          type,
          amount: installmentAmount,
          description: desc || null,
          category_id: categoryId || null,
          account_id: accountId || null,
          tag_ids: selectedTags.length > 0 ? selectedTags : null,
          date: installmentDate,
          status: isPaid ? 'done' : 'pending',
          context,
          receipt_url: i === 0 ? receiptUrl : null,
          recurring_group_id: recurringGroupId,
          installment_index: totalParcels > 1 ? i + 1 : 1,
          total_installments: totalParcels > 1 ? totalParcels : 1
        })
        if (insertError) throw insertError

        if (isPaid && accountId && i === 0) {
          const { data: acc } = await supabase.from('accounts').select('balance').eq('id', accountId).single()
          if (acc) {
            const currentBalance = Number(acc.balance) || 0
            const newBalance = type === 'income' ? currentBalance + installmentAmount : currentBalance - installmentAmount
            await supabase.from('accounts').update({ balance: newBalance }).eq('id', accountId)
          }
        }
      }
      router.refresh()
      router.push('/transactions')
    } catch (e) {
      alert('Erro ao salvar transação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-black font-sans text-gray-800 overflow-y-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2 sticky top-0 bg-slate-50 dark:bg-black z-40">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm">
          <ChevronLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-base">{isIncome ? 'Nova Receita' : 'Nova Despesa'}</h1>
        <button onClick={() => setShowReceiptModal(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm">
          <Camera size={20} className="text-gray-700" />
        </button>
      </div>

      <div className="flex justify-center mt-2 mb-1">
        <div className="flex bg-gray-200 p-1 rounded-full">
          {(['dfl', 'personal'] as Context[]).map(c => (
            <button key={c} onClick={() => setContext(c)} className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${context === c ? 'bg-white shadow-sm' : 'text-gray-500'}`}>
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      <div className="py-6 text-center px-6">
        <p className="text-gray-400 text-xs mb-2">Valor {isIncome ? 'da Receita' : 'da Despesa'}</p>
        <div className="flex justify-center items-center gap-1">
          <span className={`text-3xl font-medium ${themeColor} opacity-60`}>R$</span>
          <input type="text" inputMode="numeric" value={amount} onChange={handleAmount} className={`text-5xl font-bold outline-none bg-transparent ${themeColor} w-48 text-center`} />
        </div>
      </div>

      {/* Card Principal - Categoria e Conta */}
      <div className="bg-white rounded-3xl mx-4 shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-50">
          <span className="font-bold text-sm text-gray-700">{isIncome ? 'Recebido' : 'Pago'}</span>
          <button onClick={() => setIsPaid(!isPaid)} className={`w-12 h-6 rounded-full transition-colors ${isPaid ? bgColor : 'bg-gray-200'}`}>
            <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* --- SELETOR DE CATEGORIA (Ícone selecionado grudado no + da direita) --- */}
        <button onClick={() => setShowCatModal(true)} className="w-full flex items-center justify-between p-5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-4">
            <Tag size={20} className="text-gray-400" />
            <span className={`text-sm font-medium ${selectedCat ? 'text-gray-800' : 'text-gray-400'}`}>
              {selectedCat ? selectedCat.name : 'Categoria'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedCat && (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${selectedCat.color}20` }}>{selectedCat.icon}</div>
            )}
            <div onClick={(e) => { e.stopPropagation(); setShowCreateCatModal(true); }} className="p-2 -mr-2 text-teal-700 hover:bg-teal-50 rounded-full transition-colors">
              <Plus size={20} />
            </div>
          </div>
        </button>

        {/* --- SELETOR DE CONTA (Ícone selecionado grudado no + da direita) --- */}
        <button onClick={() => setShowAccModal(true)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-4">
            <Wallet size={20} className="text-gray-400" />
            <span className={`text-sm font-medium ${selectedAcc ? 'text-gray-800' : 'text-gray-400'}`}>
              {selectedAcc ? selectedAcc.name : 'Conta'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedAcc && (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: selectedAcc.color }}>{selectedAcc.name.substring(0, 2).toUpperCase()}</div>
            )}
            <div onClick={(e) => { e.stopPropagation(); setShowCreateAccModal(true); }} className="p-2 -mr-2 text-teal-700 hover:bg-teal-50 rounded-full transition-colors">
              <Plus size={20} />
            </div>
          </div>
        </button>
      </div>

      {/* Detalhes */}
      <div className="mx-4 mt-4">
        <button onClick={() => setShowDetails(!showDetails)} className="text-teal-700 text-sm font-bold flex items-center gap-1 mx-auto py-2">
          {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDetails && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mt-2">
            <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-full px-5 py-5 text-sm font-medium text-gray-700 border-b border-gray-50 outline-none" />
            <input placeholder="Descrição" value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-5 py-5 text-sm font-medium text-gray-700 border-b border-gray-50 outline-none" />

            <div className="px-5 py-5 border-b border-gray-50">
              <p className="text-sm font-bold text-gray-800 mb-4">Repetição</p>
              <div className="flex gap-2 mb-4">
                {[
                  { key: 'once', label: 'Única' },
                  { key: 'installments', label: 'Parcelar' },
                  { key: 'recurring', label: 'Recorrente' }
                ].map(opt => (
                  <button key={opt.key} onClick={() => setRepetition(opt.key as Repetition)} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${repetition === opt.key ? 'bg-teal-50 border border-teal-700 text-teal-800' : 'bg-gray-50 text-gray-600'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {repetition === 'installments' && (
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">Parcelas</span>
                  <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="bg-transparent text-sm font-bold outline-none">
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (<option key={n} value={n}>{n}x</option>))}
                  </select>
                </div>
              )}

              {repetition === 'recurring' && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { key: 'weekly', label: 'Semanal' }, { key: 'biweekly', label: 'Quinzenal' },
                    { key: 'monthly', label: 'Mensal' }, { key: 'bimonthly', label: 'Bimestral' },
                    { key: 'custom', label: 'Personalizar' }
                  ].map(f => (
                    <button key={f.key} onClick={() => f.key === 'custom' ? setShowComingSoon(true) : setFrequency(f.key as Frequency)} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${frequency === f.key ? 'bg-teal-50 border border-teal-700 text-teal-800' : 'bg-gray-50 text-gray-600'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setShowTagModal(true)} className="w-full flex items-center justify-between p-5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Tag size={20} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-800">
                  {selectedTags.length > 0 
                    ? `${selectedTags.length} tag(ns) selecionada(s)` 
                    : 'Tags'}
                </span>
              </div>
              <Plus size={20} className="text-teal-700" />
            </button>

            {!isIncome && (
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><ArrowRightLeft size={20} className="text-gray-400" /><span className="text-sm font-bold text-gray-800">É uma devolução / estorno</span></div>
                  <button onClick={() => setIsRefund(!isRefund)} className={`w-12 h-6 rounded-full transition-colors ${isRefund ? 'bg-teal-700' : 'bg-gray-200'}`}><div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${isRefund ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                </div>
                <div className="flex items-center justify-between opacity-50 cursor-pointer" onClick={() => setShowComingSoon(true)}>
                  <div className="flex items-center gap-3"><Building size={20} className="text-gray-400" /><span className="text-sm font-bold text-gray-800">Financiamento</span></div>
                  <div className="w-12 h-6 rounded-full bg-gray-200"><div className="w-5 h-5 bg-white rounded-full mt-0.5 ml-1" /></div>
                </div>
                <div className="flex items-center justify-between opacity-50 cursor-pointer" onClick={() => setShowComingSoon(true)}>
                  <div className="flex items-center gap-3"><HandCoins size={20} className="text-gray-400" /><span className="text-sm font-bold text-gray-800">Empréstimo a alguém</span></div>
                  <div className="w-12 h-6 rounded-full bg-gray-200"><div className="w-5 h-5 bg-white rounded-full mt-0.5 ml-1" /></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-8 w-full flex justify-center z-40 pointer-events-none">
        <button onClick={handleSave} disabled={saving} className={`pointer-events-auto w-16 h-16 ${bgColor} rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform`}>
          {saving ? <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" /> : <Check size={30} className="text-white" />}
        </button>
      </div>

      {/* Modal Lista de Categorias */}
      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white py-2">
              <h3 className="font-bold text-lg">Categorias</h3>
              <button onClick={() => { setShowCatModal(false); setShowCreateCatModal(true); }} className="text-teal-700 bg-teal-50 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => { setCategoryId(cat.id); setShowCatModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${cat.id === categoryId ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${cat.color}20` }}>{cat.icon}</div>
                  <span className="flex-1 text-left font-medium text-gray-800">{cat.name}</span>
                  {cat.id === categoryId && <Check size={20} className="text-teal-700" />}
                </button>
              ))}
              {categories.length === 0 && <p className="text-center text-gray-400 mt-10">Nenhuma categoria encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Lista de Contas */}
      {showAccModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white py-2">
              <h3 className="font-bold text-lg">Contas</h3>
              <button onClick={() => { setShowAccModal(false); setShowCreateAccModal(true); }} className="text-teal-700 bg-teal-50 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {accounts.map(acc => (
                <button key={acc.id} onClick={() => { setAccountId(acc.id); setShowAccModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${acc.id === accountId ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: acc.color }}>{acc.name.substring(0, 2).toUpperCase()}</div>
                  <span className="flex-1 text-left font-medium text-gray-800">{acc.name}</span>
                  {acc.id === accountId && <Check size={20} className="text-teal-700" />}
                </button>
              ))}
              {accounts.length === 0 && <p className="text-center text-gray-400 mt-10">Nenhuma conta encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Lista de Tags */}
      {showTagModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white py-2">
              <h3 className="font-bold text-lg">Tags</h3>
              <button onClick={() => { setShowTagModal(false); setShowCreateTagModal(true); }} className="text-teal-700 bg-teal-50 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {tags.map(tag => {
                const isActive = selectedTags.includes(tag.id);
                return (
                  <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="flex-1 text-left font-medium text-gray-800">{tag.name}</span>
                    {isActive && <Check size={20} className="text-teal-700" />}
                  </button>
                );
              })}
              {tags.length === 0 && <p className="text-center text-gray-400 mt-10">Nenhuma tag encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Categoria */}
      {showCreateCatModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowCreateCatModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800">Nova categoria</h3>
              <button onClick={() => setShowCreateCatModal(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <input 
                type="text" 
                value={newCatName} 
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nome da categoria" 
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-medium text-gray-800 focus:border-teal-500 transition-colors"
              />
              <div>
                <p className="text-sm text-gray-500 font-medium mb-3">Ícone</p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_ICONS.map(i => (
                    <button 
                      key={i} 
                      onClick={() => setNewCatIcon(i)}
                      className={`w-12 h-12 flex items-center justify-center text-2xl rounded-2xl transition-all ${newCatIcon === i ? 'bg-teal-700 scale-110 shadow-md' : 'bg-gray-50 hover:bg-gray-100'}`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_COLORS.map(c => (
                    <button 
                      key={c} 
                      onClick={() => setNewCatColor(c)}
                      className={`w-10 h-10 rounded-full transition-transform ${newCatColor === c ? 'scale-125 border-4 border-white shadow-md' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button 
                onClick={handleSaveCategory} 
                disabled={savingCategory || !newCatName.trim()}
                className="w-full bg-[#82a99c] hover:bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4 transition-colors disabled:opacity-50 flex justify-center items-center"
              >
                {savingCategory ? <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" /> : 'Salvar categoria'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Conta */}
      {showCreateAccModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowCreateAccModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800">Nova conta</h3>
              <button onClick={() => setShowCreateAccModal(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <input 
                type="text" 
                value={newAccName} 
                onChange={(e) => setNewAccName(e.target.value)}
                placeholder="Nome da conta" 
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-medium text-gray-800 focus:border-teal-500 transition-colors"
              />
              <div>
                <p className="text-sm text-gray-500 font-medium mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_COLORS.map(c => (
                    <button 
                      key={c} 
                      onClick={() => setNewAccColor(c)}
                      className={`w-10 h-10 rounded-full transition-transform ${newAccColor === c ? 'scale-125 border-4 border-white shadow-md' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button 
                onClick={handleSaveAccount} 
                disabled={savingAccount || !newAccName.trim()}
                className="w-full bg-[#82a99c] hover:bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4 transition-colors disabled:opacity-50 flex justify-center items-center"
              >
                {savingAccount ? <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" /> : 'Salvar conta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Tag */}
      {showCreateTagModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowCreateTagModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800">Nova tag</h3>
              <button onClick={() => setShowCreateTagModal(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <input 
                type="text" 
                value={newTagName} 
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nome da tag" 
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-medium text-gray-800 focus:border-teal-500 transition-colors"
              />
              <div>
                <p className="text-sm text-gray-500 font-medium mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_COLORS.map(c => (
                    <button 
                      key={c} 
                      onClick={() => setNewTagColor(c)}
                      className={`w-10 h-10 rounded-full transition-transform ${newTagColor === c ? 'scale-125 border-4 border-white shadow-md' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button 
                onClick={handleSaveTag} 
                disabled={savingTag || !newTagName.trim()}
                className="w-full bg-[#82a99c] hover:bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4 transition-colors disabled:opacity-50 flex justify-center items-center"
              >
                {savingTag ? <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" /> : 'Salvar tag'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} onOptionSelect={handleReceiptOption} />
      <CameraCapture isOpen={showCamera} onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />
      <ComingSoonModal isOpen={showComingSoon} onClose={() => setShowComingSoon(false)} />
    </div>
  )
}

export default function NewTransactionPage() {
  return <Suspense><NewTransactionContent /></Suspense>
}