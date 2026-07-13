'use client'

import { useState, useCallback, useEffect, useRef, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import * as Icons from 'lucide-react'
import {
  ChevronLeft, Tag, Wallet, ChevronDown, ChevronUp, Check,
  Camera, Plus, ArrowRightLeft, Building, HandCoins, X,
  QrCode, ChevronRight, Trash2, Loader2, Paperclip,
  Image as ImageIcon, CreditCard, Calendar, RefreshCw, Users,
  Edit3, FileText, Layers
} from 'lucide-react'
import { addMonths, addWeeks, format, startOfMonth, endOfMonth } from 'date-fns'
import ReceiptModal from '@/components/ReceiptModal'
import CameraCapture from '@/components/CameraCapture'
import QRCodeScanner from '@/components/QRCodeScanner'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import IconPicker from '@/components/IconPicker'
import MoneyInput from '@/components/MoneyInput'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'
import ModalFinancing from '@/components/ModalFinancing'
import ModalEmprestimo from '@/components/ModalEmprestimo'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { db } from '@/lib/db'

type TxType = 'income' | 'expense' | 'transfer'
type Context = 'dfl' | 'personal'
type Repetition = 'once' | 'installments' | 'recurring'
type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'custom'

const CATEGORY_COLORS = [
  '#22c55e', '#ef4444', '#f97316', '#06b6d4',
  '#8b5cf6', '#eab308', '#94a3b8', '#ec4899', '#14b8a6',
]

function createLocalDate(dateString: string): Date {
  return new Date(dateString + 'T12:00:00')
}

const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

function NewTransactionContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { vibrate, success, error: hapticError } = useHapticFeedback()
  const { safeAdd, safeUpdate, safeDelete } = useSafeDb()

  const { context: globalContext, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : globalContext
  const [context, setContext] = useState<Context>(effectiveContext as Context)

  const [loadingPulse, setLoadingPulse] = useState(false)

  const galeriaInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<TxType>((searchParams.get('type') as TxType) || 'expense')
  const [amountNum, setAmountNum] = useState(0)
  const [amountFormatted, setAmountFormatted] = useState('0,00')
  const [isPaid, setIsPaid] = useState(true)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [desc, setDesc] = useState('')
  const [notes, setNotes] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [creditCardId, setCreditCardId] = useState('')
  const [contactId, setContactId] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptName, setReceiptName] = useState<string>('')
  const [receiptType, setReceiptType] = useState<'image' | 'pdf' | null>(null)
  const [uploading, setUploading] = useState(false)

  const [installments, setInstallments] = useState(2)
  const [budgetAlert, setBudgetAlert] = useState<{ message: string; type: 'warning' | 'danger' } | null>(null)

  const [repetition, setRepetition] = useState<Repetition>('once')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [isRefund, setIsRefund] = useState(false)
  const [isReimbursable, setIsReimbursable] = useState(false)

  const [financingId, setFinancingId] = useState<string | null>(null)
  const [debtId, setDebtId] = useState<string | null>(null)
  
  const [showFinancingModal, setShowFinancingModal] = useState(false)
  const [showLoanModal, setShowLoanModal] = useState(false)
  const [showCustomRecurrenceModal, setShowCustomRecurrenceModal] = useState(false)
  const [customParcels, setCustomParcels] = useState(12)
  const [customInterval, setCustomInterval] = useState(1)

  const [showQRScanner, setShowQRScanner] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [showSubCatModal, setShowSubCatModal] = useState(false)
  const [selectedParentCat, setSelectedParentCat] = useState<any>(null)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showCardModal, setShowCardModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
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

  const { isOnline } = useOfflineQueue()

  const { data: accounts } = useLocalData({ table: 'accounts' as any, filters: { context: effectiveContext } })
  const { data: localCategories } = useLocalData({ table: 'categories' as any, filters: { context: effectiveContext, type: type === 'income' ? 'income' : 'expense' } })
  const { data: tags } = useLocalData({ table: 'tags' as any, filters: { context: effectiveContext } })
  const { data: creditCards } = useLocalData({ table: 'credit_cards' as any, filters: { context: effectiveContext, is_archived: false } })
  const { data: contacts } = useLocalData({ table: 'contacts' as any, filters: { context: effectiveContext } })
  const { data: budgets } = useLocalData({ table: 'budgets' as any, filters: { context: effectiveContext } })

  const mainCategories = useMemo(() => {
    return (localCategories || [])
      .filter((c: any) => !c.parent_id)
      .sort((a: any, b: any) => {
        const orderA = a.order_index ?? 9999
        const orderB = b.order_index ?? 9999
        if (orderA !== orderB) return orderA - orderB
        return (a.name || '').localeCompare(b.name || '')
      })
  }, [localCategories])

  const subcategories = useMemo(() => {
    const subCats = (localCategories || []).filter((c: any) => c.parent_id)
    const subsMap: Record<string, any[]> = {}
    subCats.forEach((sub: any) => {
      if (!subsMap[sub.parent_id]) subsMap[sub.parent_id] = []
      subsMap[sub.parent_id].push(sub)
    })
    return subsMap
  }, [localCategories])

  const allCategoriesFlat = useMemo(() => localCategories || [], [localCategories])

  useEffect(() => {
    setContext(effectiveContext as Context)
    setAccountId('')
    setCategoryId('')
    setCreditCardId('')
    setContactId('')
    setSelectedTags([])
  }, [effectiveContext])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleDateChange = (newDateStr: string) => {
    vibrate([5])
    setDate(newDateStr)
    const selected = createLocalDate(newDateStr)
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    selected.setHours(12, 0, 0, 0)
    setIsPaid(selected <= today)
  }

  const isIncome = type === 'income'
  const themeColor = isIncome ? 'text-emerald-500' : 'text-red-500'
  const headerGradient = isIncome
    ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
    : 'bg-red-50/50 dark:bg-red-950/20'
  const toggleBgClass = isPaid ? (isIncome ? 'bg-emerald-500' : 'bg-teal-600') : 'bg-gray-200 dark:bg-slate-700'
  const toggleTracks = isPaid ? 'translate-x-7' : 'translate-x-1'

  const selectedCat = allCategoriesFlat.find((c: any) => c.id === categoryId)
  const selectedAcc = (accounts || []).find((a: any) => a.id === accountId)
  const selectedCard = (creditCards || []).find((c: any) => c.id === creditCardId)
  const selectedContact = (contacts || []).find((c: any) => c.id === contactId)

  const toggleTag = useCallback((id: string) => {
    vibrate([10])
    setSelectedTags((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }, [vibrate])

  const budgetAlertMemo = useMemo(() => {
    if (!categoryId || amountNum <= 0 || type !== 'expense') return null
    const budget = (budgets || []).find((b: any) => b.category_id === categoryId)
    if (!budget) return null
    return budget
  }, [categoryId, amountNum, type, budgets])

  useEffect(() => {
    if (!budgetAlertMemo || !user?.id) {
      setBudgetAlert(null)
      return
    }

    const budget = budgetAlertMemo
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    supabase
      .from('transactions')
      .select('amount')
      .match({ user_id: user.id, context: effectiveContext, category_id: categoryId })
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
            message: `⚠️ Ultrapassa o orçamento de "${budget.name}". Gasto: ${formatCurrency(spent)}.`,
            type: 'danger',
          })
        } else if (percent >= 80) {
          setBudgetAlert({
            message: `⚠️ Atenção! Atingirá ${percent.toFixed(0)}% do orçamento (${formatCurrency(limit)}).`,
            type: 'warning',
          })
        } else {
          setBudgetAlert(null)
        }
      })
  }, [budgetAlertMemo, categoryId, amountNum, user, effectiveContext])

  const uploadFile = async (file: File) => {
    if (!user) return
    setUploading(true)
    setReceiptName(file.name)

    const isImage = file.type.startsWith('image/')
    setReceiptType(isImage ? 'image' : 'pdf')

    if (isImage) {
      const reader = new FileReader()
      reader.onload = (e) => setReceiptPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setReceiptPreview(null)
    }

    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const uniqueName = `${crypto.randomUUID()}.${ext}`
      const path = `${user.id}/${uniqueName}`

      const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file, { upsert: false })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
      if (receiptUrl) {
        const oldPath = receiptUrl.split('/').slice(-2).join('/')
        await supabase.storage.from('receipts').remove([oldPath])
      }

      setReceiptUrl(urlData.publicUrl)
      success()
      showToast('✅ Comprovante anexado!', 'success')

      if (isImage) {
        try {
          const ocrResponse = await fetch('/api/ocr-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: urlData.publicUrl }),
          })
          const ocrData = await ocrResponse.json()
          if (ocrData.success && ocrData.data) {
            if (ocrData.data.amount > 0) {
              setAmountNum(ocrData.data.amount)
              setAmountFormatted(ocrData.data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
            }
            if (ocrData.data.date) setDate(ocrData.data.date)
            if (ocrData.data.description) setDesc(ocrData.data.description)
            vibrate([50, 100, 50])
            showToast('✅ Dados extraídos da imagem!', 'success')
          }
        } catch (ocrError) {
          console.error('Erro OCR:', ocrError)
        }
      }
    } catch (err: any) {
      hapticError()
      showToast(`❌ Erro ao anexar: ${err.message}`, 'error')
      setReceiptPreview(null)
      setReceiptName('')
      setReceiptType(null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveReceipt = async () => {
    vibrate([10])
    if (receiptUrl) {
      const path = receiptUrl.split('/').slice(-2).join('/')
      await supabase.storage.from('receipts').remove([path])
    }
    setReceiptUrl(null)
    setReceiptPreview(null)
    setReceiptName('')
    setReceiptType(null)
    showToast('🗑️ Comprovante removido.', 'success')
  }

  const handleReceiptOption = (option: string) => {
    vibrate([5])
    if (option === 'camera') {
      setShowReceiptModal(false)
      setTimeout(() => setShowCamera(true), 150)
      return
    }
    if (option === 'galeria') {
      galeriaInputRef.current?.click()
      setTimeout(() => setShowReceiptModal(false), 200)
      return
    }
    if (option === 'pdf') {
      pdfInputRef.current?.click()
      setTimeout(() => setShowReceiptModal(false), 200)
      return
    }
  }

  const handleCameraCapture = (file: File) => {
    uploadFile(file)
    setShowCamera(false)
  }

  const handleQRResult = (text: string) => {
    let extractedAmount: string | null = null
    let extractedDesc: string | null = null

    if (text.startsWith('000201')) {
      const amountMatch = text.match(/54(\d{2})(\d+)/)
      if (amountMatch) {
        const num = parseFloat(amountMatch[2]) / 100
        extractedAmount = num.toFixed(2).replace('.', ',')
      }
      const nameMatch = text.match(/26(\d{2})([^5]+)/)
      if (nameMatch) extractedDesc = `PIX: ${nameMatch[2].trim()}`
    } else if (text.includes('|') && text.includes('BOLETO')) {
      extractedDesc = text.split('|')[0]?.trim()
    } else {
      extractedDesc = text.length > 30 ? text.substring(0, 30) + '...' : text
    }

    if (extractedAmount) {
      setAmountFormatted(extractedAmount.replace('.', ','))
      setAmountNum(parseFloat(extractedAmount.replace(',', '.')))
    }
    if (extractedDesc) setDesc(extractedDesc)
    vibrate([10, 50])
  }

  const handleSaveCategory = async () => {
    if (!user?.id || !newCatName.trim()) return
    setSavingCategory(true)
    try {
      const id = crypto.randomUUID()
      const newOrderIndex = mainCategories.length > 0 ? Math.max(...mainCategories.map((c: any) => c.order_index || 0)) + 1 : 0
      const payload = {
        id, user_id: user.id, name: newCatName.trim(), icon: newCatIcon, color: newCatColor,
        context: effectiveContext, type: type === 'income' ? 'income' : 'expense', order_index: newOrderIndex,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: 'pending', sync_attempts: 0,
      }

      const res = await safeAdd('categories', payload)
      if (!res.success) throw new Error(res.error)

      setCategoryId(id)
      setShowCreateCatModal(false)
      setNewCatName('')
      success()
      showToast('✅ Categoria criada!', 'success')
    } catch (err: any) {
      hapticError()
      showToast(`❌ Erro ao criar categoria: ${err.message}`, 'error')
    } finally {
      setSavingCategory(false)
    }
  }

  const handleSaveAccount = async () => {
    if (!user?.id || !newAccName.trim()) return
    setSavingAccount(true)
    try {
      const id = crypto.randomUUID()
      const payload = {
        id, user_id: user.id, name: newAccName.trim(), color: newAccColor, context: effectiveContext,
        balance: 0, is_archived: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        sync_status: 'pending', sync_attempts: 0,
      }

      const res = await safeAdd('accounts', payload)
      if (!res.success) throw new Error(res.error)

      setAccountId(id)
      setShowCreateAccModal(false)
      setNewAccName('')
      success()
      showToast('✅ Conta criada!', 'success')
    } catch (err: any) {
      hapticError()
      showToast(`❌ Erro ao criar conta: ${err.message}`, 'error')
    } finally {
      setSavingAccount(false)
    }
  }

  const handleSaveTag = async () => {
    if (!user?.id || !newTagName.trim()) return
    setSavingTag(true)
    try {
      const id = crypto.randomUUID()
      const payload = {
        id, user_id: user.id, name: newTagName.trim(), color: newTagColor, context: effectiveContext,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: 'pending', sync_attempts: 0,
      }

      const res = await safeAdd('tags', payload)
      if (!res.success) throw new Error(res.error)

      setSelectedTags((prev) => (prev.length < 5 ? [...prev, id] : prev))
      setShowCreateTagModal(false)
      setNewTagName('')
      success()
      showToast('✅ Tag criada!', 'success')
    } catch (err: any) {
      hapticError()
      showToast(`❌ Erro ao criar tag: ${err.message}`, 'error')
    } finally {
      setSavingTag(false)
    }
  }

  const handleSave = useCallback(async () => {
    if (isSubmitting) return
    if (!user?.id) { showToast('❌ Sessão expirada.', 'error'); return }
    if (amountNum <= 0) { hapticError(); showToast('⚠️ Valor deve ser maior que zero.', 'warning'); return }

    setIsSubmitting(true)
    const finalDescription = desc.trim() || selectedCat?.name || 'Transação sem nome'

    let finalNotes = notes
    if (type === 'expense') {
      const flags = []
      if (isRefund) flags.push('[Devolução/Estorno]')
      if (financingId) flags.push('[Financiamento]')
      if (debtId) flags.push('[Empréstimo]')
      if (flags.length > 0) finalNotes = `${flags.join(' ')} ${finalNotes}`.trim()
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

    const installmentAmount = totalParcels > 1 && repetition === 'installments' ? amountNum / totalParcels : amountNum

    try {
      const baseDate = createLocalDate(date)
      
      await db.transaction('rw', db.accounts, db.transactions, db.syncQueue, async () => {
        for (let i = 0; i < totalParcels; i++) {
          let installmentDate: string

          if (repetition === 'recurring') {
            if (frequency === 'weekly') installmentDate = format(addWeeks(baseDate, i), 'yyyy-MM-dd')
            else if (frequency === 'biweekly') installmentDate = format(addWeeks(baseDate, i * 2), 'yyyy-MM-dd')
            else if (frequency === 'monthly') installmentDate = format(addMonths(baseDate, i), 'yyyy-MM-dd')
            else if (frequency === 'bimonthly') installmentDate = format(addMonths(baseDate, i * 2), 'yyyy-MM-dd')
            else installmentDate = format(addMonths(baseDate, i * customInterval), 'yyyy-MM-dd')
          } else {
            installmentDate = format(addMonths(baseDate, i), 'yyyy-MM-dd')
          }

          const txId = crypto.randomUUID()
          const payload: any = {
            id: txId,
            user_id: user.id,
            type,
            amount: installmentAmount,
            description: finalDescription,
            category_id: categoryId || null,
            account_id: creditCardId ? null : (accountId || null),
            credit_card_id: creditCardId || null,
            contact_id: contactId || null,
            tag_ids: selectedTags.length > 0 ? selectedTags : null,
            date: installmentDate,
            status: creditCardId ? 'done' : (isPaid ? 'done' : 'pending'),
            context: effectiveContext,
            receipt_url: i === 0 ? receiptUrl : null,
            notes: notes || null,
            recurring_group_id: recurringGroupId,
            installment_index: totalParcels > 1 ? i + 1 : 1,
            total_installments: totalParcels > 1 ? totalParcels : 1,
            financing_id: financingId,
            debt_id: debtId,
            is_reimbursable: isReimbursable,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sync_status: 'pending',
            sync_attempts: 0,
          }

          const res = await safeAdd('transactions', payload)
          if (!res.success) throw new Error(res.error)

          if (accountId && !creditCardId && isPaid) {
            const acc = (accounts || []).find((a: any) => a.id === accountId)
            if (acc) {
               const newBal = type === 'income' ? safeNum(acc.balance) + installmentAmount : safeNum(acc.balance) - installmentAmount
               await safeUpdate('accounts', accountId, { balance: newBal })
            }
          }

          if (isReimbursable && i === 0) { // Cria reembolso apenas pra primeira no caso de loop
             const otherContext = effectiveContext === 'dfl' ? 'personal' : 'dfl'
             const reimbTxId = crypto.randomUUID()
             await safeAdd('transactions', {
               id: reimbTxId, user_id: user.id, type: type === 'expense' ? 'income' : 'expense', amount: installmentAmount,
               description: `Reembolso: ${finalDescription}`, date: installmentDate, status: 'pending', context: otherContext,
               category_id: null, linked_transaction_id: txId, is_reimbursable: true,
               created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: 'pending', sync_attempts: 0,
             })
             await safeUpdate('transactions', txId, { linked_transaction_id: reimbTxId })
          }
        }
      })

      vibrate([10, 50])
      showToast(isOnline ? '✅ Transação salva com sucesso!' : '☁️ Salvo localmente para sincronizar depois.', 'success')
      router.push('/transactions')
    } catch (e: any) {
      hapticError()
      showToast(`❌ Erro ao salvar: ${e.message}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, user, amountNum, type, categoryId, desc, repetition, installments, frequency, creditCardId, isRefund, isPaid, accountId, contactId, selectedTags, receiptUrl, notes, financingId, debtId, isReimbursable, isOnline, router, showToast, effectiveContext, customInterval, customParcels, vibrate, hapticError, accounts, safeAdd, safeUpdate, date, selectedCat])

  const AttachmentIcon = useMemo(() => {
    if (uploading) return <Loader2 size={20} className="animate-spin text-teal-600" />
    if (receiptUrl) {
      if (receiptType === 'pdf') return <Paperclip size={20} className="text-teal-600 dark:text-teal-400" />
      return <ImageIcon size={20} className="text-teal-600 dark:text-teal-400" />
    }
    return <Camera size={20} className="text-gray-700 dark:text-gray-300" />
  }, [uploading, receiptUrl, receiptType])

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-slate-900 font-sans text-gray-800 dark:text-gray-200 overflow-y-auto pb-32 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      <input ref={galeriaInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = '' }} />
      <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = '' }} />

      {/* Header Camaleão Fixo */}
      <div className={`sticky top-0 z-40 ${headerGradient} backdrop-blur-xl px-4 pt-6 pb-4 border-b border-gray-100 dark:border-slate-800 transition-all duration-300`}>
        <div className="flex items-center justify-between">
          <button onClick={() => { vibrate([5]); router.back(); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm active:scale-[0.95] transition-transform">
            <ChevronLeft size={22} className="text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="font-bold text-[18px] text-gray-800 dark:text-gray-100 capitalize">
              {isIncome ? 'Nova Receita' : 'Nova Despesa'}
            </h1>
            <ContextToggle />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setShowQRScanner(true); vibrate([10]) }} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm active:scale-[0.95] transition-transform">
              <QrCode size={18} className="text-gray-700 dark:text-gray-300" />
            </button>
            <button onClick={() => { !receiptUrl && setShowReceiptModal(true); vibrate([10]) }} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm active:scale-[0.95] transition-transform">
              {AttachmentIcon}
            </button>
          </div>
        </div>
      </div>

      <div className="py-8 text-center px-4 animate-in fade-in slide-in-from-top-4 duration-300">
        <p className="text-gray-400 dark:text-gray-500 text-[11px] font-bold uppercase tracking-widest mb-2">
          Valor {isIncome ? 'da Receita' : 'da Despesa'}
        </p>
        <div className="flex justify-center items-center gap-1.5">
          <span className={`text-2xl font-bold opacity-50 ${themeColor}`}>R$</span>
          <MoneyInput
            value={amountNum}
            onChange={(num, formatted) => { setAmountNum(num); setAmountFormatted(formatted) }}
            className={`text-[44px] font-black tracking-tight outline-none bg-transparent ${themeColor} w-64 text-center placeholder:text-gray-300 dark:placeholder:text-gray-700`}
            placeholder="0,00"
            autoFocus
          />
        </div>

        {type === 'expense' && budgetAlert && (
          <div className={`mt-4 max-w-sm mx-auto p-4 rounded-[20px] text-[12px] font-bold shadow-sm ${budgetAlert.type === 'danger' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800'}`}>
            {budgetAlert.message}
          </div>
        )}
      </div>

      {uploading ? (
        <div className="mx-4 mb-4 bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-teal-700" />
          <span className="text-[13px] font-bold text-gray-600 dark:text-gray-300">Enviando comprovante...</span>
        </div>
      ) : receiptUrl ? (
        <div className="mx-4 mb-4 bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {receiptPreview ? (
              <div className="w-12 h-12 rounded-[16px] overflow-hidden bg-gray-200 dark:bg-slate-600 shrink-0 border border-gray-200 dark:border-slate-600">
                <img src={receiptPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 ${receiptType === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                {receiptType === 'pdf' ? <Paperclip size={22} /> : <ImageIcon size={22} />}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate">{receiptName}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Comprovante anexado</p>
            </div>
          </div>
          <button onClick={handleRemoveReceipt} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-slate-700/50 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors active:scale-[0.95]">
            <Trash2 size={16} />
          </button>
        </div>
      ) : null}

      <div className="bg-white dark:bg-slate-800 rounded-[32px] mx-4 shadow-sm border border-gray-50 dark:border-slate-700 overflow-hidden animate-in fade-in duration-300">
        
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-50 dark:border-slate-700/50">
          <Edit3 size={20} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={selectedCat ? selectedCat.name : 'Nome ou Descrição'}
            className="flex-1 text-[15px] font-bold bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-50 dark:border-slate-700/50">
          <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">
            {isIncome ? 'Recebido' : creditCardId ? 'Lançado na fatura' : 'Pago'}
          </span>
          {!creditCardId && (
            <button onClick={() => { vibrate([5]); setIsPaid(!isPaid); }} className={`w-14 h-8 rounded-full relative transition-all duration-300 shadow-inner ${toggleBgClass} active:scale-95`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-sm ${toggleTracks}`} />
            </button>
          )}
        </div>

        <button onClick={() => { vibrate([5]); setShowCatModal(true); }} className="w-full flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]">
          <div className="flex items-center gap-4">
            {selectedCat ? (() => {
              const IconComp = getDynamicIcon(selectedCat.icon)
              return (
                <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${selectedCat.color}20`, color: selectedCat.color }}>
                  <IconComp size={18} />
                </div>
              )
            })() : (
              <div className="w-10 h-10 rounded-[14px] bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400"><Tag size={18} /></div>
            )}
            <div className="text-left">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Categoria</span>
              <span className={`text-[15px] font-bold ${selectedCat ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                {selectedCat ? selectedCat.name : 'Selecionar'}
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </button>

        {!isIncome && (creditCards || []).length > 0 && (
          <button onClick={() => { vibrate([5]); setShowCardModal(true); }} className="w-full flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm ${selectedCard ? 'text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`} style={selectedCard ? { backgroundColor: selectedCard.color || '#f97316' } : {}}>
                <CreditCard size={18} />
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Cartão de Crédito</span>
                <span className={`text-[15px] font-bold ${selectedCard ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                  {selectedCard ? selectedCard.name : 'Nenhum'}
                </span>
              </div>
            </div>
            {selectedCard ? (
              <div onClick={(e) => { e.stopPropagation(); vibrate([10]); setCreditCardId(''); }} className="p-2 -mr-2 bg-gray-50 dark:bg-slate-700 rounded-full text-gray-400 hover:text-red-500"><X size={14} /></div>
            ) : <ChevronRight size={18} className="text-gray-300" />}
          </button>
        )}

        {!creditCardId && (
          <button onClick={() => { vibrate([5]); setShowAccModal(true); }} className="w-full flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-[14px] bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400 shrink-0"><Wallet size={18} /></div>
              <div className="text-left flex-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Conta</span>
                <span className={`text-[15px] font-bold ${selectedAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                  {selectedAcc ? selectedAcc.name : 'Selecionar'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedAcc && <BankLogo color={selectedAcc.color} name={selectedAcc.name} size="sm" />}
              <ChevronRight size={18} className="text-gray-300" />
            </div>
          </button>
        )}

        {(contacts || []).length > 0 && (
          <button onClick={() => { vibrate([5]); setShowContactModal(true); }} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-[14px] bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400 shrink-0"><Users size={18} /></div>
              <div className="text-left flex-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Fornecedor / Cliente</span>
                <span className={`text-[15px] font-bold ${selectedContact ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                  {selectedContact ? selectedContact.name : 'Nenhum'}
                </span>
              </div>
            </div>
            {selectedContact ? (
              <div onClick={(e) => { e.stopPropagation(); vibrate([10]); setContactId(''); }} className="p-2 -mr-2 bg-gray-50 dark:bg-slate-700 rounded-full text-gray-400 hover:text-red-500"><X size={14} /></div>
            ) : <ChevronRight size={18} className="text-gray-300" />}
          </button>
        )}
      </div>

      <div className="mx-4 mt-6">
        <button onClick={() => { vibrate([5]); setShowDetails(!showDetails); }} className="text-teal-600 dark:text-teal-400 text-[13px] font-bold flex items-center justify-center gap-1.5 mx-auto py-3 px-6 bg-teal-50 dark:bg-teal-900/10 rounded-full active:scale-95 transition-transform">
          {showDetails ? 'Ocultar opções avançadas' : 'Mais opções (Tags, Repetição...)'}
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showDetails ? 'max-h-[1000px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
          <div className="space-y-4">
            
            <div className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center gap-4">
              <Calendar size={20} className="text-gray-400 shrink-0" />
              <input type="date" value={date} onChange={(e) => { vibrate([5]); handleDateChange(e.target.value); }} className="flex-1 text-[15px] font-bold bg-transparent outline-none text-gray-800 dark:text-gray-200" />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 flex items-start gap-4">
              <FileText size={20} className="text-gray-400 shrink-0 mt-0.5" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais..."
                rows={2}
                className="flex-1 text-[14px] font-medium bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 resize-none py-1"
              />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
              <p className="text-[12px] font-bold text-gray-800 dark:text-gray-100 mb-4">Repetição da Transação</p>
              <div className="flex gap-2 mb-4 bg-gray-50 dark:bg-slate-700/50 p-1.5 rounded-[20px]">
                {[{ key: 'once', label: 'Única' }, { key: 'installments', label: 'Parcelar' }, { key: 'recurring', label: 'Recorrente' }].map((opt) => (
                  <button key={opt.key} onClick={() => { vibrate([5]); setRepetition(opt.key as Repetition); }} className={`flex-1 py-2.5 rounded-[14px] text-[12px] font-bold transition-all active:scale-[0.95] ${repetition === opt.key ? 'bg-white dark:bg-slate-800 shadow-sm text-teal-600 dark:text-teal-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              
              {repetition === 'installments' && (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/30 p-4 rounded-[20px]">
                  <span className="text-[13px] font-bold text-gray-700 dark:text-gray-300">Quantidade de Parcelas</span>
                  <select value={installments} onChange={(e) => { vibrate([5]); setInstallments(Number(e.target.value)); }} className="bg-transparent text-[15px] font-black outline-none text-gray-800 dark:text-gray-200 cursor-pointer">
                    {[2,3,4,5,6,7,8,9,10,11,12,24,36,48,60].map((n) => (<option key={n} value={n}>{n}x</option>))}
                  </select>
                </div>
              )}
              
              {repetition === 'recurring' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {[{ key: 'weekly', label: 'Semanal' }, { key: 'biweekly', label: 'Quinzenal' }, { key: 'monthly', label: 'Mensal' }, { key: 'bimonthly', label: 'Bimestral' }, { key: 'custom', label: 'Personalizar' }].map((f) => (
                      <button key={f.key} onClick={() => { vibrate([5]); setFrequency(f.key as Frequency); if (f.key === 'custom') setShowCustomRecurrenceModal(true) }} className={`px-4 py-2.5 rounded-[14px] text-[12px] font-bold transition-all active:scale-[0.95] ${frequency === f.key ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-400' : 'bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-400 border border-transparent'}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {frequency === 'custom' && (
                    <div className="bg-teal-50 dark:bg-teal-900/10 p-3 rounded-[16px] text-center">
                      <p className="text-[12px] font-bold text-teal-700 dark:text-teal-400">
                        {customParcels} parcelas, a cada {customInterval} mês(es).
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={() => { vibrate([5]); setShowTagModal(true); }} className="w-full bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-4">
                <Tag size={20} className="text-gray-400" />
                <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">
                  {selectedTags.length > 0 ? `${selectedTags.length} tag(ns) selecionada(s)` : 'Tags'}
                </span>
              </div>
              <Plus size={20} className="text-teal-600 dark:text-teal-400" />
            </button>

            {!isIncome && (
              <div className="bg-white dark:bg-slate-800 rounded-[28px] p-2 shadow-sm border border-gray-50 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-700/50">
                
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <RefreshCw size={14} className="text-orange-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">É um reembolso</span>
                      <span className="text-[10px] font-medium text-gray-400">Pago com recurso PF/PJ</span>
                    </div>
                  </div>
                  <button onClick={() => { vibrate([5]); setIsReimbursable(!isReimbursable); }} className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${isReimbursable ? 'bg-orange-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${isReimbursable ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <ArrowRightLeft size={14} className="text-blue-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Estorno / Devolução</span>
                      <span className="text-[10px] font-medium text-gray-400">Despesa anulada</span>
                    </div>
                  </div>
                  <button onClick={() => { vibrate([5]); setIsRefund(!isRefund); }} className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${isRefund ? 'bg-blue-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${isRefund ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 cursor-pointer active:bg-gray-50 dark:active:bg-slate-700/50 transition-colors" onClick={() => { vibrate([5]); setShowFinancingModal(true); }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                      <Building size={14} className="text-purple-500" />
                    </div>
                    <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Vincular Financiamento</span>
                  </div>
                  <button className={`w-12 h-6 rounded-full transition-all duration-300 shadow-inner ${financingId ? 'bg-purple-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mt-1 shadow-sm ${financingId ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 cursor-pointer active:bg-gray-50 dark:active:bg-slate-700/50 transition-colors" onClick={() => { vibrate([5]); setShowLoanModal(true); }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <HandCoins size={14} className="text-amber-500" />
                    </div>
                    <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Vincular Empréstimo</span>
                  </div>
                  <button className={`w-12 h-6 rounded-full transition-all duration-300 shadow-inner ${debtId ? 'bg-amber-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mt-1 shadow-sm ${debtId ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[80px] flex justify-center z-40 pointer-events-none">
        <button
          onClick={() => { vibrate([10, 50]); handleSave(); }}
          disabled={isSubmitting}
          className={`pointer-events-auto w-[68px] h-[68px] rounded-full flex items-center justify-center text-white shadow-[0_8px_30px_rgba(0,0,0,0.2)] transition-all duration-300 active:scale-90 ${
            isIncome ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/40' : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/40'
          }`}
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" size={30} />
          ) : (
            <Check size={32} />
          )}
        </button>
      </div>

      {/* Modal Categorias (Bottom Sheet) */}
      {showCatModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowCatModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Selecionar Categoria</h3>
              <button onClick={() => { setShowCatModal(false); setShowCreateCatModal(true); vibrate([10]) }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2.5 rounded-full active:scale-[0.95] transition-transform"><Plus size={20} /></button>
            </div>
            <div className="space-y-2 pb-10">
              {mainCategories.map((cat: any) => {
                const IconComp = getDynamicIcon(cat.icon)
                const subCount = subcategories[cat.id]?.length || 0
                const isActive = cat.id === categoryId
                return (
                  <button key={cat.id} onClick={() => { vibrate([5]); setCategoryId(cat.id); setSelectedParentCat(cat); subCount > 0 ? setShowSubCatModal(true) : setShowCatModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}><IconComp size={22} /></div>
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
                    {subCount > 0 && <span className="text-[12px] text-gray-400 font-bold mr-2">{subCount}</span>}
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                    {subCount > 0 && <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Subcategorias */}
      {showSubCatModal && selectedParentCat && (
        <div className="fixed inset-0 z-[610] flex items-end justify-center" onClick={() => setShowSubCatModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-right-8 duration-300 h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center gap-3 mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <button onClick={() => { vibrate([5]); setShowSubCatModal(false); }} className="p-2.5 -ml-2 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-95 transition-transform"><ChevronLeft size={20} /></button>
              <div>
                <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Subcategorias</h3>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{selectedParentCat.name}</p>
              </div>
            </div>
            <div className="space-y-2 pb-6">
              {(subcategories[selectedParentCat.id] || []).map((sub: any) => {
                const SubIcon = getDynamicIcon(sub.icon)
                const isActive = sub.id === categoryId
                return (
                  <button key={sub.id} onClick={() => { vibrate([5]); setCategoryId(sub.id); setShowSubCatModal(false); setShowCatModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100'}`}>
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${sub.color}20`, color: sub.color }}><SubIcon size={22} /></div>
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{sub.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              <button onClick={() => { vibrate([5]); setShowSubCatModal(false); setShowCatModal(false); }} className="w-full p-4 mt-2 flex items-center justify-center gap-2 rounded-[20px] bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 font-bold active:scale-[0.98] transition-transform border border-teal-100 dark:border-teal-800/50 shadow-sm">
                Usar categoria principal "{selectedParentCat.name}"
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Contas */}
      {showAccModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowAccModal(false)}>
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
           <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
                <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Contas</h3>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAccModal(false); setShowCreateAccModal(true); vibrate([10]) }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2.5 rounded-full active:scale-[0.95] transition-transform"><Plus size={20} /></button>
                  <button onClick={() => setShowAccModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2.5 rounded-full active:scale-95"><X size={20} /></button>
                </div>
              </div>
              <div className="space-y-2 pb-10">
                {(accounts || []).map(acc => {
                  const isActive = acc.id === accountId
                  return (
                    <button key={acc.id} onClick={() => { vibrate([5]); setAccountId(acc.id); setShowAccModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100'}`}>
                      <BankLogo color={acc.color} name={acc.name} size="md" />
                      <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                      {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                    </button>
                  )
                })}
              </div>
           </div>
        </div>
      )}

      {/* Modal Cartões */}
      {showCardModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowCardModal(false)}>
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
           <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
                <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Cartão de Crédito</h3>
                <button onClick={() => setShowCardModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2.5 rounded-full active:scale-95"><X size={20} /></button>
              </div>
              <div className="space-y-2 pb-6">
                {(creditCards || []).map(card => {
                  const isActive = card.id === creditCardId
                  return (
                    <button key={card.id} onClick={() => { vibrate([5]); setCreditCardId(card.id); setAccountId(''); setShowCardModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100'}`}>
                      <div className="w-12 h-12 rounded-[16px] flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: card.color || '#f97316' }}><CreditCard size={22} /></div>
                      <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{card.name}</span>
                      {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                    </button>
                  )
                })}
              </div>
           </div>
        </div>
      )}

      {/* Modal Contatos */}
      {showContactModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowContactModal(false)}>
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
           <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
                <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Contatos</h3>
                <button onClick={() => setShowContactModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2.5 rounded-full active:scale-95"><X size={20} /></button>
              </div>
              <div className="space-y-2 pb-6">
                {(contacts || []).map((contact) => {
                  const isActive = contact.id === contactId
                  const IconComp = getDynamicIcon(contact.icon || 'user')
                  return (
                    <button key={contact.id} onClick={() => { vibrate([5]); setContactId(contact.id); setShowContactModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100'}`}>
                      <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${contact.color}20`, color: contact.color }}><IconComp size={22} /></div>
                      <div className="flex-1 text-left">
                         <p className={`text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{contact.name}</p>
                         <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">{contact.type === 'supplier' ? 'Fornecedor' : contact.type === 'customer' ? 'Cliente' : 'Ambos'}</p>
                      </div>
                      {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                    </button>
                  )
                })}
              </div>
           </div>
        </div>
      )}

      {/* Modal Tags */}
      {showTagModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowTagModal(false)}>
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
           <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
                <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Tags</h3>
                <div className="flex gap-2">
                  <button onClick={() => { setShowTagModal(false); setShowCreateTagModal(true); vibrate([10]) }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2.5 rounded-full active:scale-[0.95] transition-transform"><Plus size={20} /></button>
                  <button onClick={() => setShowTagModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2.5 rounded-full active:scale-95"><X size={20} /></button>
                </div>
              </div>
              <div className="space-y-2 pb-6">
                {(tags || []).map((tag) => {
                  const isActive = selectedTags.includes(tag.id)
                  return (
                    <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100'}`}>
                      <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
                      <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{tag.name}</span>
                      {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                    </button>
                  )
                })}
              </div>
           </div>
        </div>
      )}

      {/* Recorrência Customizada, Receipt, QRCode, Camera, Categorias/Contas/Tags New mantidos mas simplificados no CSS onde possível. */}
      {showReceiptModal && <ReceiptModal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} onOptionSelect={handleReceiptOption} />}
      {showCamera && <CameraCapture isOpen={showCamera} onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />}
      {showQRScanner && <QRCodeScanner onClose={() => setShowQRScanner(false)} onResult={handleQRResult} />}
      {showFinancingModal && <ModalFinancing isOpen={showFinancingModal} onClose={() => setShowFinancingModal(false)} onSave={(id) => setFinancingId(id)} />}
      {showLoanModal && <ModalEmprestimo isOpen={showLoanModal} onClose={() => setShowLoanModal(false)} onSave={(id) => setDebtId(id)} />}
      <IconPicker isOpen={showIconPicker} onClose={() => setShowIconPicker(false)} selectedIcon={newCatIcon} onSelect={setNewCatIcon} />

      {/* Modal Criar Categoria */}
      {showCreateCatModal && (
        <div className="fixed inset-0 z-[700] flex items-end justify-center" onClick={() => setShowCreateCatModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Nova Categoria</h3>
              <button onClick={() => setShowCreateCatModal(false)} className="text-gray-400 p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-[0.95] transition-transform"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nome da categoria" className="w-full p-4 bg-gray-50 dark:bg-slate-700/50 rounded-[20px] outline-none font-bold text-[16px] text-gray-800 dark:text-gray-200" />
              <button onClick={() => setShowIconPicker(true)} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/50 rounded-[20px] p-4 w-full text-left active:scale-[0.98] transition-transform">
                <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${newCatColor}20`, color: newCatColor }}>{(() => { const I = getDynamicIcon(newCatIcon); return <I size={24} /> })()}</div>
                <span className="text-[15px] font-bold text-gray-800 dark:text-white flex-1">{newCatIcon}</span>
                <ChevronDown size={20} className="text-gray-400" />
              </button>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-[20px] p-4">
                <p className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">{CATEGORY_COLORS.map((c) => (<button key={c} onClick={() => { setNewCatColor(c); vibrate([10]) }} className={`w-10 h-10 rounded-full transition-transform active:scale-90 ${newCatColor === c ? 'scale-125 border-4 border-white dark:border-slate-800 shadow-md' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />))}</div>
              </div>
              <button onClick={handleSaveCategory} disabled={savingCategory || !newCatName.trim()} className="w-full bg-teal-600 text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg shadow-teal-600/30 disabled:opacity-50 flex justify-center items-center active:scale-[0.98] transition-transform mt-6">
                {savingCategory ? <Loader2 size={24} className="animate-spin" /> : 'Salvar Categoria'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Conta */}
      {showCreateAccModal && (
        <div className="fixed inset-0 z-[700] flex items-end justify-center" onClick={() => setShowCreateAccModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Nova Conta</h3>
              <button onClick={() => setShowCreateAccModal(false)} className="text-gray-400 p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-[0.95] transition-transform"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={newAccName} onChange={(e) => setNewAccName(e.target.value)} placeholder="Nome da conta" className="w-full p-4 bg-gray-50 dark:bg-slate-700/50 rounded-[20px] outline-none font-bold text-[16px] text-gray-800 dark:text-gray-200" />
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-[20px] p-4">
                <p className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">{CATEGORY_COLORS.map((c) => (<button key={c} onClick={() => { setNewAccColor(c); vibrate([10]) }} className={`w-10 h-10 rounded-full transition-transform active:scale-90 ${newAccColor === c ? 'scale-125 border-4 border-white dark:border-slate-800 shadow-md' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />))}</div>
              </div>
              <button onClick={handleSaveAccount} disabled={savingAccount || !newAccName.trim()} className="w-full bg-teal-600 text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg shadow-teal-600/30 disabled:opacity-50 flex justify-center items-center active:scale-[0.98] transition-transform mt-6">
                {savingAccount ? <Loader2 size={24} className="animate-spin" /> : 'Salvar Conta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Tag */}
      {showCreateTagModal && (
        <div className="fixed inset-0 z-[700] flex items-end justify-center" onClick={() => setShowCreateTagModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Nova Tag</h3>
              <button onClick={() => setShowCreateTagModal(false)} className="text-gray-400 p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-[0.95] transition-transform"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Nome da tag" className="w-full p-4 bg-gray-50 dark:bg-slate-700/50 rounded-[20px] outline-none font-bold text-[16px] text-gray-800 dark:text-gray-200" />
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-[20px] p-4">
                <p className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">{CATEGORY_COLORS.map((c) => (<button key={c} onClick={() => { setNewTagColor(c); vibrate([10]) }} className={`w-10 h-10 rounded-full transition-transform active:scale-90 ${newTagColor === c ? 'scale-125 border-4 border-white dark:border-slate-800 shadow-md' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />))}</div>
              </div>
              <button onClick={handleSaveTag} disabled={savingTag || !newTagName.trim()} className="w-full bg-teal-600 text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg shadow-teal-600/30 disabled:opacity-50 flex justify-center items-center active:scale-[0.98] transition-transform mt-6">
                {savingTag ? <Loader2 size={24} className="animate-spin" /> : 'Salvar Tag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Recorrência Customizada */}
      {showCustomRecurrenceModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowCustomRecurrenceModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 animate-in slide-in-from-bottom-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Recorrência</h3>
              <button onClick={() => setShowCustomRecurrenceModal(false)} className="text-gray-400 p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-[0.95] transition-transform"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-[20px]">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Número de parcelas</label>
                <input type="number" value={customParcels} onChange={(e) => setCustomParcels(Number(e.target.value))} className="w-full bg-transparent outline-none font-bold text-[18px] text-gray-800 dark:text-gray-200" min={1} max={120} />
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-[20px]">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Intervalo (meses)</label>
                <input type="number" value={customInterval} onChange={(e) => setCustomInterval(Number(e.target.value))} className="w-full bg-transparent outline-none font-bold text-[18px] text-gray-800 dark:text-gray-200" min={1} max={24} />
              </div>
              <button onClick={() => { setShowCustomRecurrenceModal(false); vibrate([10]) }} className="w-full bg-teal-600 text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg shadow-teal-600/30 mt-4 active:scale-[0.98] transition-transform">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default function EditTransactionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900 transition-colors">
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
        </div>
        <TransactionSkeleton />
      </div>
    }>
      <EditTransactionContent />
    </Suspense>
  )
}
