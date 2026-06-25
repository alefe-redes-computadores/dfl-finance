'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import * as Icons from 'lucide-react'
import {
  ChevronLeft, Tag, Wallet, ChevronDown, ChevronUp, Check,
  Camera, Plus, ArrowRightLeft, Building, HandCoins, X,
  QrCode, ChevronRight
} from 'lucide-react'
import { addMonths, addWeeks, format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import ReceiptModal from '@/components/ReceiptModal'
import ComingSoonModal from '@/components/ComingSoonModal'
import CameraCapture from '@/components/CameraCapture'
import QRCodeScanner from '@/components/QRCodeScanner'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import IconPicker from '@/components/IconPicker'
import MoneyInput from '@/components/MoneyInput'

type TxType = 'income' | 'expense' | 'transfer'
type Context = 'dfl' | 'personal'
type Repetition = 'once' | 'installments' | 'recurring'
type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'custom'

const CATEGORY_COLORS = ['#22c55e', '#ef4444', '#f97316', '#06b6d4', '#8b5cf6', '#eab308', '#94a3b8', '#ec4899', '#14b8a6']

const getDynamicIcon = (iconName: string) => {
  if (!iconName) return Icons.Tag
  const formattedName = iconName.charAt(0).toUpperCase() + iconName.slice(1)
  return (Icons as any)[formattedName] || Icons.Tag
}

// Helper para criar data local sem influência do UTC
function createLocalDate(dateString: string): Date {
  // Adiciona T12:00:00 para garantir que a data não desloque para o dia anterior
  return new Date(dateString + 'T12:00:00')
}

function NewTransactionContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [type, setType] = useState<TxType>((searchParams.get('type') as TxType) || 'expense')
  const [context, setContext] = useState<Context>('dfl')
  const [amountNum, setAmountNum] = useState(0)
  const [amountFormatted, setAmountFormatted] = useState('0,00')
  const [isPaid, setIsPaid] = useState(true)
  // Data local sem fuso: yyyy-MM-dd baseada no calendário do usuário
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [desc, setDesc] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<Record<string, any[]>>({})
  const [accounts, setAccounts] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [receipt, setReceipt] = useState<File | null>(null)
  const [installments, setInstallments] = useState(1)
  const [budgets, setBudgets] = useState<any[]>([])
  const [budgetAlert, setBudgetAlert] = useState<{ message: string; type: 'warning' | 'danger' } | null>(null)

  const [repetition, setRepetition] = useState<Repetition>('once')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [isRefund, setIsRefund] = useState(false)

  const [showCustomRecurrenceModal, setShowCustomRecurrenceModal] = useState(false)
  const [customParcels, setCustomParcels] = useState(12)
  const [customInterval, setCustomInterval] = useState(1)

  const [showQRScanner, setShowQRScanner] = useState(false)

  const [showCatModal, setShowCatModal] = useState(false)
  const [showSubCatModal, setShowSubCatModal] = useState(false)
  const [selectedParentCat, setSelectedParentCat] = useState<any>(null)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [showCamera, setShowCamera] = useState(false)

  const [showCreateCatModal, setShowCreateCatModal] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('Utensils')
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

  const { isOnline, saveToQueue } = useOfflineQueue()

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleDateChange = (newDateStr: string) => {
    setDate(newDateStr)
    const selectedDate = createLocalDate(newDateStr)
    const today = new Date()
    today.setHours(12, 0, 0, 0) // meio-dia local
    selectedDate.setHours(12, 0, 0, 0)
    setIsPaid(selectedDate <= today)
  }

  const isIncome = type === 'income'
  const themeColor = isIncome ? 'text-emerald-700' : 'text-red-600'
  const bgColor = isIncome ? 'bg-emerald-700' : 'bg-red-600'
  
  const selectedCat = categories.find(c => c.id === categoryId) || 
    Object.values(subcategories).flat().find((s: any) => s.id === categoryId)
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

    const [{ data: cats }, { data: accs }, { data: tgs }, { data: budgetsData }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id).eq('context', context).eq('type', catType),
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('context', context).order('name'),
      supabase.from('tags').select('*').eq('user_id', user.id).eq('context', context).order('name'),
      supabase.from('budgets').select('*').match({ user_id: user.id, context: context })
    ])

    const allCats = Array.isArray(cats) ? cats : []
    const mainCats = allCats.filter(c => !c.parent_id)
    const subCats = allCats.filter(c => c.parent_id)
    
    const subsMap: Record<string, any[]> = {}
    subCats.forEach(sub => {
      const key = sub.parent_id
      if (!subsMap[key]) subsMap[key] = []
      subsMap[key].push(sub)
    })

    setCategories(mainCats)
    setSubcategories(subsMap)
    setAccounts(Array.isArray(accs) ? accs : [])
    setTags(Array.isArray(tgs) ? tgs : [])
    setBudgets(Array.isArray(budgetsData) ? budgetsData : [])
  }, [user, context, type])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!categoryId || amountNum <= 0 || type !== 'expense') {
      setBudgetAlert(null)
      return
    }

    const budget = budgets.find(b => b.category_id === categoryId)
    if (!budget) {
      setBudgetAlert(null)
      return
    }

    if (!user || !user.id) return

    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    supabase
      .from('transactions')
      .select('amount')
      .match({ user_id: user.id, context: context, category_id: categoryId })
      .eq('status', 'done')
      .gte('date', start)
      .lte('date', end)
      .then(({ data }) => {
        const spent = (data || []).reduce((a: number, t: any) => a + (Number(t.amount) || 0), 0)
        const total = spent + amountNum
        const limit = Number(budget.amount)
        const percent = (total / limit) * 100

        if (total > limit) {
          setBudgetAlert({
            message: `⚠️ Este valor ultrapassa o orçamento de "${budget.name}" (${formatCurrency(limit)}). Já foi gasto ${formatCurrency(spent)}.`,
            type: 'danger'
          })
        } else if (percent >= 80) {
          setBudgetAlert({
            message: `⚠️ Atenção! Com este valor, "${budget.name}" atinge ${percent.toFixed(0)}% do orçamento (${formatCurrency(limit)}).`,
            type: 'warning'
          })
        } else {
          setBudgetAlert(null)
        }
      })
  }, [categoryId, amountNum, type, budgets, user, context])

  const formatAmount = (value: string) => {
    const num = parseFloat(value.replace(/\./g, '').replace(',', '.'))
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

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
          const formatted = formatAmount(extractedAmount)
          setAmountFormatted(formatted)
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

  const handleQRResult = (text: string) => {
    console.log('QR Code lido:', text)
    
    let extractedAmount: string | null = null
    let extractedDesc: string | null = null

    if (text.startsWith('000201')) {
      const amountMatch = text.match(/54(\d{2})(\d+)/)
      if (amountMatch) {
        const amountStr = amountMatch[2]
        const amountNum = parseFloat(amountStr) / 100
        extractedAmount = amountNum.toFixed(2).replace('.', ',')
      }
      
      const nameMatch = text.match(/26(\d{2})([^5]+)/)
      if (nameMatch) {
        extractedDesc = `PIX: ${nameMatch[2].trim()}`
      }
    } else if (text.includes('|') && text.includes('BOLETO')) {
      const parts = text.split('|')
      extractedDesc = parts[0]?.trim()
    } else {
      extractedDesc = text.length > 30 ? text.substring(0, 30) + '...' : text
    }

    if (extractedAmount) {
      const formatted = formatAmount(extractedAmount)
      setAmountFormatted(formatted)
      setAmountNum(parseFloat(extractedAmount.replace(/\./g, '').replace(',', '.')))
    }
    if (extractedDesc) {
      setDesc(extractedDesc)
    }
  }

  const handleSaveCategory = async () => {
    if (!user || !user.id) {
      alert('Sessão expirada. Faça login novamente.')
      return
    }
    if (!newCatName.trim()) return
    setSavingCategory(true)
    try {
      const payload = {
        user_id: user.id,
        name: newCatName.trim(),
        icon: newCatIcon,
        color: newCatColor,
        context: context,
        type: type === 'income' ? 'income' : 'expense'
      }
      console.log('Inserindo categoria:', payload)
      const { data, error } = await supabase.from('categories').insert(payload).select().single()

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
    if (!user || !user.id) {
      alert('Sessão expirada. Faça login novamente.')
      return
    }
    if (!newAccName.trim()) return
    setSavingAccount(true)
    try {
      const payload = {
        user_id: user.id,
        name: newAccName.trim(),
        color: newAccColor,
        context: context
      }
      console.log('Inserindo conta:', payload)
      const { data, error } = await supabase.from('accounts').insert(payload).select().single()

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
    if (!user || !user.id) {
      alert('Sessão expirada. Faça login novamente.')
      return
    }
    if (!newTagName.trim()) return
    setSavingTag(true)
    try {
      const payload = {
        user_id: user.id,
        name: newTagName.trim(),
        color: newTagColor,
        context: context
      }
      console.log('Inserindo tag:', payload)
      const { data, error } = await supabase.from('tags').insert(payload).select().single()

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
    if (isSubmitting) return
    if (!user || !user.id) {
      alert('Sessão expirada. Faça login novamente.')
      return
    }
    const rawAmount = amountNum
    if (rawAmount <= 0) {
      alert('Erro: O valor da transação deve ser maior que R$ 0,00.')
      return
    }
    setIsSubmitting(true)

    if (type === 'expense' && categoryId && budgets.length > 0) {
      const budget = budgets.find(b => b.category_id === categoryId)
      if (budget) {
        const start = format(startOfMonth(new Date(date)), 'yyyy-MM-dd')
        const end = format(endOfMonth(new Date(date)), 'yyyy-MM-dd')
        const { data: existingTxs } = await supabase
          .from('transactions')
          .select('amount')
          .match({ user_id: user.id, context: context, category_id: categoryId })
          .eq('status', 'done')
          .gte('date', start)
          .lte('date', end)
        
        const spent = (existingTxs || []).reduce((a: number, t: any) => a + (Number(t.amount) || 0), 0)
        const total = spent + rawAmount
        const limit = Number(budget.amount)
        
        if (total > limit) {
          const proceed = confirm(
            `⚠️ Alerta de Orçamento!\n\n"${budget.name}" já tem ${formatCurrency(spent)} gasto(s).\n` +
            `Com mais ${formatCurrency(rawAmount)}, o total será ${formatCurrency(total)}.\n` +
            `O orçamento é de ${formatCurrency(limit)}.\n\n` +
            `Deseja continuar mesmo assim?`
          )
          if (!proceed) {
            setIsSubmitting(false)
            return
          }
        }
      }
    }

    const idempotencyKey = crypto.randomUUID()
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
        case 'custom': totalParcels = customParcels; break
        default: totalParcels = 12
      }
    }

    const installmentAmount = totalParcels > 1 && repetition === 'installments' ? rawAmount / totalParcels : rawAmount

    try {
      // Usar a data base local para gerar parcelas consistentes
      const baseDate = createLocalDate(date)

      for (let i = 0; i < totalParcels; i++) {
        let installmentDate: string
        if (repetition === 'recurring') {
          if (frequency === 'weekly') installmentDate = format(addWeeks(baseDate, i), 'yyyy-MM-dd')
          else if (frequency === 'biweekly') installmentDate = format(addWeeks(baseDate, i * 2), 'yyyy-MM-dd')
          else if (frequency === 'monthly') installmentDate = format(addMonths(baseDate, i), 'yyyy-MM-dd')
          else if (frequency === 'bimonthly') installmentDate = format(addMonths(baseDate, i * 2), 'yyyy-MM-dd')
          else if (frequency === 'custom') installmentDate = format(addMonths(baseDate, i * customInterval), 'yyyy-MM-dd')
          else installmentDate = format(addMonths(baseDate, i), 'yyyy-MM-dd')
        } else {
          installmentDate = format(addMonths(baseDate, i), 'yyyy-MM-dd')
        }

        const payload = {
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
          total_installments: totalParcels > 1 ? totalParcels : 1,
          idempotency_key: idempotencyKey,
        }

        console.log('Inserindo transação:', payload)

        if (!isOnline) {
          await saveToQueue(payload)
          if (i === totalParcels - 1) {
            alert('Transação salva localmente. Será enviada quando houver conexão.')
            router.push('/transactions')
          }
          continue
        }

        const { error: insertError } = await supabase.from('transactions').insert(payload)
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
      if (isOnline) {
        router.refresh()
        router.push('/transactions')
      }
    } catch (e: any) {
      alert('ERRO DO BANCO:\n' + (e.message || JSON.stringify(e)))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 font-sans text-gray-800 dark:text-gray-200 overflow-y-auto pb-32 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2 sticky top-0 bg-slate-50 dark:bg-slate-900 z-40">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm">
          <ChevronLeft size={22} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="font-bold text-base text-gray-800 dark:text-gray-100">{isIncome ? 'Nova Receita' : 'Nova Despesa'}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQRScanner(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm">
            <QrCode size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          <button onClick={() => setShowReceiptModal(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm">
            <Camera size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>

      <div className="flex justify-center mt-2 mb-1">
        <div className="flex bg-gray-200 dark:bg-slate-700 p-1 rounded-full">
          {(['dfl', 'personal'] as Context[]).map(c => (
            <button key={c} onClick={() => setContext(c)} className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${context === c ? 'bg-white dark:bg-slate-600 shadow-sm text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      <div className="py-6 text-center px-6">
        <p className="text-gray-400 dark:text-gray-500 text-xs mb-2">Valor {isIncome ? 'da Receita' : 'da Despesa'}</p>
        <div className="flex justify-center items-center gap-1">
          <span className={`text-3xl font-medium ${themeColor} opacity-60`}>R$</span>
          <MoneyInput
            value={amountNum}
            onChange={(num, formatted) => {
              setAmountNum(num)
              setAmountFormatted(formatted)
            }}
            className={`text-5xl font-bold outline-none bg-transparent ${themeColor} w-48 text-center`}
          />
        </div>

        {type === 'expense' && budgetAlert && (
          <div className={`mt-3 mx-6 p-3 rounded-xl text-xs font-bold ${
            budgetAlert.type === 'danger' 
              ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' 
              : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
          }`}>
            {budgetAlert.message}
          </div>
        )}
      </div>

      {/* Card Principal */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl mx-4 shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-50 dark:border-slate-700">
          <span className="font-bold text-sm text-gray-700 dark:text-gray-300">{isIncome ? 'Recebido' : 'Pago'}</span>
          <button onClick={() => setIsPaid(!isPaid)} className={`w-12 h-6 rounded-full transition-colors ${isPaid ? bgColor : 'bg-gray-200 dark:bg-gray-600'}`}>
            <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <button onClick={() => setShowCatModal(true)} className="w-full flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-4">
            <Tag size={20} className="text-gray-400 dark:text-gray-500" />
            <span className={`text-sm font-medium ${selectedCat ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
              {selectedCat ? selectedCat.name : 'Categoria'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedCat && (() => {
              const IconComp = getDynamicIcon(selectedCat.icon)
              return (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${selectedCat.color}20`, color: selectedCat.color }}>
                  <IconComp size={20} />
                </div>
              )
            })()}
            <div onClick={(e) => { e.stopPropagation(); setShowCreateCatModal(true); }} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-full transition-colors">
              <Plus size={20} />
            </div>
          </div>
        </button>

        <button onClick={() => setShowAccModal(true)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-4">
            <Wallet size={20} className="text-gray-400 dark:text-gray-500" />
            <span className={`text-sm font-medium ${selectedAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
              {selectedAcc ? selectedAcc.name : 'Conta'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedAcc && (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: selectedAcc.color }}>{selectedAcc.name.substring(0, 2).toUpperCase()}</div>
            )}
            <div onClick={(e) => { e.stopPropagation(); setShowCreateAccModal(true); }} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-full transition-colors">
              <Plus size={20} />
            </div>
          </div>
        </button>
      </div>

      {/* Detalhes */}
      <div className="mx-4 mt-4">
        <button onClick={() => setShowDetails(!showDetails)} className="text-teal-700 dark:text-teal-400 text-sm font-bold flex items-center gap-1 mx-auto py-2">
          {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDetails && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden mt-2">
            <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-full px-5 py-5 text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-50 dark:border-slate-700 outline-none bg-transparent" />
            <input placeholder="Descrição" value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-5 py-5 text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-50 dark:border-slate-700 outline-none bg-transparent" />

            <div className="px-5 py-5 border-b border-gray-50 dark:border-slate-700">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">Repetição</p>
              <div className="flex gap-2 mb-4">
                {[
                  { key: 'once', label: 'Única' },
                  { key: 'installments', label: 'Parcelar' },
                  { key: 'recurring', label: 'Recorrente' }
                ].map(opt => (
                  <button key={opt.key} onClick={() => setRepetition(opt.key as Repetition)} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${repetition === opt.key ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700 dark:border-teal-500 text-teal-800 dark:text-teal-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {repetition === 'installments' && (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700 p-4 rounded-xl">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Parcelas</span>
                  <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="bg-transparent text-sm font-bold outline-none text-gray-800 dark:text-gray-200">
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (<option key={n} value={n}>{n}x</option>))}
                  </select>
                </div>
              )}

              {repetition === 'recurring' && (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'weekly', label: 'Semanal' }, { key: 'biweekly', label: 'Quinzenal' },
                      { key: 'monthly', label: 'Mensal' }, { key: 'bimonthly', label: 'Bimestral' },
                      { key: 'custom', label: 'Personalizar' }
                    ].map(f => (
                      <button 
                        key={f.key} 
                        onClick={() => {
                          setFrequency(f.key as Frequency)
                          if (f.key === 'custom') setShowCustomRecurrenceModal(true)
                        }} 
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${frequency === f.key ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700 dark:border-teal-500 text-teal-800 dark:text-teal-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {frequency === 'custom' && (
                    <p className="text-xs text-teal-700 dark:text-teal-400 font-medium ml-1 mt-1">
                      Serão geradas {customParcels} parcelas, a cada {customInterval} mês(es).
                    </p>
                  )}
                </div>
              )}
            </div>

            <button onClick={() => setShowTagModal(true)} className="w-full flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              <div className="flex items-center gap-3">
                <Tag size={20} className="text-gray-400 dark:text-gray-500" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {selectedTags.length > 0 
                    ? `${selectedTags.length} tag(ns) selecionada(s)` 
                    : 'Tags'}
                </span>
              </div>
              <Plus size={20} className="text-teal-700 dark:text-teal-400" />
            </button>

            {!isIncome && (
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><ArrowRightLeft size={20} className="text-gray-400 dark:text-gray-500" /><span className="text-sm font-bold text-gray-800 dark:text-gray-200">É uma devolução / estorno</span></div>
                  <button onClick={() => setIsRefund(!isRefund)} className={`w-12 h-6 rounded-full transition-colors ${isRefund ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}><div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${isRefund ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                </div>
                <div className="flex items-center justify-between opacity-50 cursor-pointer" onClick={() => setShowComingSoon(true)}>
                  <div className="flex items-center gap-3"><Building size={20} className="text-gray-400 dark:text-gray-500" /><span className="text-sm font-bold text-gray-800 dark:text-gray-200">Financiamento</span></div>
                  <div className="w-12 h-6 rounded-full bg-gray-200 dark:bg-gray-600"><div className="w-5 h-5 bg-white rounded-full mt-0.5 ml-1" /></div>
                </div>
                <div className="flex items-center justify-between opacity-50 cursor-pointer" onClick={() => setShowComingSoon(true)}>
                  <div className="flex items-center gap-3"><HandCoins size={20} className="text-gray-400 dark:text-gray-500" /><span className="text-sm font-bold text-gray-800 dark:text-gray-200">Empréstimo a alguém</span></div>
                  <div className="w-12 h-6 rounded-full bg-gray-200 dark:bg-gray-600"><div className="w-5 h-5 bg-white rounded-full mt-0.5 ml-1" /></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-8 w-full flex justify-center z-40 pointer-events-none">
        <button onClick={handleSave} disabled={isSubmitting} className={`pointer-events-auto w-16 h-16 ${bgColor} rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform`}>
          {isSubmitting ? <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" /> : <Check size={30} className="text-white" />}
        </button>
      </div>

      {/* MODAL: RECORRência PERSONALIZADA */}
      {showCustomRecurrenceModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowCustomRecurrenceModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 h-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Recorrência Personalizada</h3>
              <button onClick={() => setShowCustomRecurrenceModal(false)} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Número de parcelas</label>
                <input 
                  type="number" 
                  value={customParcels} 
                  onChange={e => setCustomParcels(Number(e.target.value))} 
                  className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200 focus:border-teal-500 transition-colors" 
                  min={1} 
                  max={120} 
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Intervalo (em meses)</label>
                <input 
                  type="number" 
                  value={customInterval} 
                  onChange={e => setCustomInterval(Number(e.target.value))} 
                  className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200 focus:border-teal-500 transition-colors" 
                  min={1} 
                  max={24} 
                />
              </div>
              <button 
                onClick={() => setShowCustomRecurrenceModal(false)} 
                className="w-full bg-[#82a99c] hover:bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lista de Categorias */}
      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Categorias</h3>
              <button onClick={() => { setShowCatModal(false); setShowCreateCatModal(true); }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {categories.map(cat => {
                const IconComp = getDynamicIcon(cat.icon)
                const subCount = subcategories[cat.id]?.length || 0
                const isActive = cat.id === categoryId
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategoryId(cat.id)
                      setSelectedParentCat(cat)
                      if (subCount > 0) {
                        setShowSubCatModal(true)
                      } else {
                        setShowCatModal(false)
                      }
                    }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                      <IconComp size={20} />
                    </div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
                    {subCount > 0 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium mr-2">{subCount}</span>
                    )}
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                    {subCount > 0 && <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />}
                  </button>
                )
              })}
              {categories.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhuma categoria encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Subcategorias */}
      {showSubCatModal && selectedParentCat && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50" onClick={() => setShowSubCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <button onClick={() => setShowSubCatModal(false)} className="p-1 -ml-2">
                <ChevronLeft size={22} className="text-gray-700 dark:text-gray-300" />
              </button>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Subcategorias</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedParentCat.name}</p>
              </div>
            </div>
            <div className="space-y-2">
              {(subcategories[selectedParentCat.id] || []).map((sub: any) => {
                const SubIconComp = getDynamicIcon(sub.icon)
                const isActive = sub.id === categoryId
                return (
                  <button
                    key={sub.id}
                    onClick={() => { setCategoryId(sub.id); setShowSubCatModal(false); setShowCatModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${sub.color}20`, color: sub.color }}>
                      <SubIconComp size={20} />
                    </div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{sub.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              <button
                onClick={() => { setShowSubCatModal(false); setShowCatModal(false) }}
                className="w-full p-3 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors text-gray-500 dark:text-gray-400 font-medium"
              >
                Usar "{selectedParentCat.name}" sem subcategoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lista de Contas */}
      {showAccModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Contas</h3>
              <button onClick={() => { setShowAccModal(false); setShowCreateAccModal(true); }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {accounts.map(acc => {
                const isActive = acc.id === accountId
                return (
                  <button key={acc.id} onClick={() => { setAccountId(acc.id); setShowAccModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: acc.color }}>{acc.name.substring(0, 2).toUpperCase()}</div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {accounts.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhuma conta encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Lista de Tags */}
      {showTagModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Tags</h3>
              <button onClick={() => { setShowTagModal(false); setShowCreateTagModal(true); }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {tags.map(tag => {
                const isActive = selectedTags.includes(tag.id);
                return (
                  <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{tag.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                );
              })}
              {tags.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhuma tag encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Categoria */}
      {showCreateCatModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowCreateCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Nova categoria</h3>
              <button onClick={() => setShowCreateCatModal(false)} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <input 
                type="text" 
                value={newCatName} 
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nome da categoria" 
                className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200 focus:border-teal-500 transition-colors"
              />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-3">Ícone</p>
                <button 
                  onClick={() => setShowIconPicker(true)}
                  className="flex items-center gap-3 bg-gray-100 dark:bg-slate-700 rounded-xl px-4 py-3 w-full text-left"
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center" 
                    style={{ backgroundColor: `${newCatColor}20`, color: newCatColor }}
                  >
                    {(() => {
                      const NewCatIconComp = getDynamicIcon(newCatIcon)
                      return <NewCatIconComp size={18} />
                    })()}
                  </div>
                  <span className="text-sm font-medium text-gray-800 dark:text-white flex-1">{newCatIcon}</span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_COLORS.map(c => (
                    <button 
                      key={c} 
                      onClick={() => setNewCatColor(c)}
                      className={`w-10 h-10 rounded-full transition-transform ${newCatColor === c ? 'scale-125 border-4 border-white dark:border-slate-900 shadow-md' : 'hover:scale-110'}`}
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
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Nova conta</h3>
              <button onClick={() => setShowCreateAccModal(false)} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <input 
                type="text" 
                value={newAccName} 
                onChange={(e) => setNewAccName(e.target.value)}
                placeholder="Nome da conta" 
                className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200 focus:border-teal-500 transition-colors"
              />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_COLORS.map(c => (
                    <button 
                      key={c} 
                      onClick={() => setNewAccColor(c)}
                      className={`w-10 h-10 rounded-full transition-transform ${newAccColor === c ? 'scale-125 border-4 border-white dark:border-slate-900 shadow-md' : 'hover:scale-110'}`}
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
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Nova tag</h3>
              <button onClick={() => setShowCreateTagModal(false)} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <input 
                type="text" 
                value={newTagName} 
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nome da tag" 
                className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200 focus:border-teal-500 transition-colors"
              />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_COLORS.map(c => (
                    <button 
                      key={c} 
                      onClick={() => setNewTagColor(c)}
                      className={`w-10 h-10 rounded-full transition-transform ${newTagColor === c ? 'scale-125 border-4 border-white dark:border-slate-900 shadow-md' : 'hover:scale-110'}`}
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

      {showQRScanner && (
        <QRCodeScanner
          onClose={() => setShowQRScanner(false)}
          onResult={handleQRResult}
        />
      )}

      <IconPicker
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        selectedIcon={newCatIcon}
        onSelect={setNewCatIcon}
      />
    </div>
  )
}

export default function NewTransactionPage() {
  return <Suspense><NewTransactionContent /></Suspense>
}