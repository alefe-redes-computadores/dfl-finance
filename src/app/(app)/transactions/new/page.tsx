// src/app/(app)/transactions/new/page.tsx
'use client'

import { useState, useCallback, useEffect, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Tag, Wallet, ChevronDown, ChevronUp, Check,
  Camera, Plus, ArrowRightLeft, Building, HandCoins, X,
  QrCode, ChevronRight, Trash2, Loader2, Paperclip,
  Image as ImageIcon, CreditCard, Calendar, RefreshCw, Users,
  Edit3, FileText, ArrowUp, ArrowDown, Minus
} from 'lucide-react'
import { addMonths, addWeeks, format, startOfMonth, endOfMonth } from 'date-fns'
import ReceiptModal from '@/components/ReceiptModal'
import CameraCapture from '@/components/CameraCapture'
import QRCodeScanner from '@/components/QRCodeScanner'
import { useLocalSync } from '@/hooks/useLocalSync'
import IconPicker from '@/components/IconPicker'
import MoneyInput from '@/components/MoneyInput'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'
import ModalFinancing from '@/components/ModalFinancing'
import ModalEmprestimo from '@/components/ModalEmprestimo'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon, normalizeIconName } from '@/lib/iconUtils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { useTransactionsList } from '@/hooks/useTransactionsList'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useSmartSearch, SmartSearchSuggestion } from '@/hooks/useSmartSearch'
import { db } from '@/lib/db'
import { createPortal } from 'react-dom'
import DatePickerSheet, { formatDateLabel } from '@/components/DatePickerSheet'

type TxType = 'income' | 'expense' | 'transfer'
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
  const { safeAdd, safeUpdate } = useSafeDb()

  const { context: globalContext, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : globalContext
  const [type, setType] = useState<TxType>((searchParams.get('type') as TxType) || 'expense')
  const [amountNum, setAmountNum] = useState(0)
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

  // ✅ NOVO: busca inteligente
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = useSmartSearch(desc, effectiveContext as 'dfl' | 'personal', type === 'income' ? 'income' : 'expense')

  const applySuggestion = (s: SmartSearchSuggestion) => {
    vibrate([10])
    setDesc(s.description)

    if (s.category_id) {
      const categoryIsValid = (localCategories || []).some(
        (category: any) =>
          category.id === s.category_id &&
          category.type === (type === 'income' ? 'income' : 'expense')
      )

      setCategoryId(categoryIsValid ? s.category_id : '')
    }

    if (s.credit_card_id && type === 'expense') {
      setCreditCardId(s.credit_card_id)
      setAccountId('')
    } else if (s.account_id) {
      setAccountId(s.account_id)
      setCreditCardId('')
    }

    setShowSuggestions(false)
  }

  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptName, setReceiptName] = useState<string>('')
  const [receiptType, setReceiptType] = useState<'image' | 'pdf' | null>(null)
  const [uploading, setUploading] = useState(false)

  const [installments, setInstallments] = useState(2)

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
  const [showDatePicker, setShowDatePicker] = useState(false)

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

  const { isOnline } = useLocalSync()

  // ✅ DADOS AUXILIARES (useLocalData mantido para joins)
  const { data: accounts } = useLocalData({ table: 'accounts' as any, filters: { context: effectiveContext } })
  const { data: localCategories } = useLocalData({ table: 'categories' as any, filters: { context: effectiveContext, type: type === 'income' ? 'income' : 'expense' } })
  const { data: tags } = useLocalData({ table: 'tags' as any, filters: { context: effectiveContext } })
  const { data: creditCards } = useLocalData({ table: 'credit_cards' as any, filters: { context: effectiveContext, is_archived: false } })
  const { data: contacts } = useLocalData({ table: 'contacts' as any, filters: { context: effectiveContext } })
  const { data: budgets } = useLocalData({ table: 'budgets' as any, filters: { context: effectiveContext } })

  const validCategories = useMemo(() => {
    const expectedType = type === 'income' ? 'income' : 'expense'

    return (localCategories || []).filter(
      (category: any) => category.type === expectedType
    )
  }, [localCategories, type])

  const mainCategories = useMemo(() => {
    return validCategories
      .filter((c: any) => !c.parent_id)
      .sort((a: any, b: any) => {
        const orderA = a.order_index ?? 9999
        const orderB = b.order_index ?? 9999
        if (orderA !== orderB) return orderA - orderB
        return (a.name || '').localeCompare(b.name || '')
      })
  }, [validCategories])

  const subcategories = useMemo(() => {
    const subCats = validCategories.filter((c: any) => c.parent_id)
    const subsMap: Record<string, any[]> = {}
    subCats.forEach((sub: any) => {
      if (!subsMap[sub.parent_id]) subsMap[sub.parent_id] = []
      subsMap[sub.parent_id].push(sub)
    })
    return subsMap
  }, [validCategories])

  const allCategoriesFlat = useMemo(
    () => validCategories,
    [validCategories]
  )

  useEffect(() => {
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

  const handleTypeChange = useCallback((nextType: 'income' | 'expense') => {
    if (type === nextType) return

    vibrate([10])

    setType(nextType)

    // Categoria é vinculada semanticamente ao tipo da transação.
    // Nunca preservamos uma categoria de Receita em Despesa ou vice-versa.
    setCategoryId('')
    setShowCatModal(false)
    setSelectedParentCat(null)
    setShowSuggestions(false)

    // Campos exclusivamente de despesa não podem sobreviver
    // quando o usuário transforma o lançamento em Receita.
    if (nextType === 'income') {
      setCreditCardId('')
      setFinancingId(null)
      setDebtId(null)
      setIsRefund(false)
    }
  }, [type, vibrate])

  const themeColor = isIncome ? 'text-emerald-500' : 'text-red-500'
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

  const budgetMonthStart = useMemo(
    () => format(startOfMonth(createLocalDate(date)), 'yyyy-MM-dd'),
    [date]
  )
  const budgetMonthEnd = useMemo(
    () => format(endOfMonth(createLocalDate(date)), 'yyyy-MM-dd'),
    [date]
  )

  const { data: budgetTransactions } = useTransactionsList(
    effectiveContext as 'dfl' | 'personal',
    categoryId
      ? { category_id: categoryId, status: 'done', type: 'expense' }
      : undefined,
    budgetMonthStart,
    budgetMonthEnd
  )

  const budgetAlert = useMemo(() => {
    if (!categoryId || amountNum <= 0 || type !== 'expense') return null

    const budget = (budgets || []).find((item: any) => item.category_id === categoryId)
    if (!budget) return null

    const spent = (budgetTransactions || []).reduce(
      (total: number, tx: any) => total + safeNum(tx.amount),
      0
    )
    const limit = safeNum(budget.amount)
    if (limit <= 0) return null

    const projected = spent + amountNum
    const percent = (projected / limit) * 100

    if (projected > limit) {
      return {
        message: `Este lançamento ultrapassa o orçamento “${budget.name}”. Já realizado: ${formatCurrency(spent)}.`,
        type: 'danger' as const,
      }
    }

    if (percent >= 80) {
      return {
        message: `Este lançamento leva o orçamento a ${percent.toFixed(0)}% de ${formatCurrency(limit)}.`,
        type: 'warning' as const,
      }
    }

    return null
  }, [categoryId, amountNum, type, budgets, budgetTransactions])

  const uploadFile = async (file: File) => {
    if (!user) return

    const isSupported = file.type.startsWith('image/') || file.type === 'application/pdf'
    if (!isSupported) {
      hapticError()
      showToast('Use uma imagem ou um arquivo PDF.', 'warning')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      hapticError()
      showToast('O comprovante deve ter no máximo 10 MB.', 'warning')
      return
    }

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
      showToast('Comprovante anexado.', 'success')

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
            }
            if (ocrData.data.date) setDate(ocrData.data.date)
            if (ocrData.data.description) setDesc(ocrData.data.description)
            vibrate([50, 100, 50])
            showToast('Dados extraídos da imagem.', 'success')
          }
        } catch (ocrError) {
          console.error('Erro OCR:', ocrError)
        }
      }
    } catch (err: any) {
      hapticError()
      showToast(`Erro ao anexar comprovante: ${err.message}`, 'error')
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
    showToast('Comprovante removido.', 'success')
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
      setAmountNum(parseFloat(extractedAmount.replace(',', '.')))
    }
    if (extractedDesc) setDesc(extractedDesc)
    vibrate([10, 50])
  }

  const handleSaveCategory = async () => {
    if (!user?.id || !newCatName.trim()) return

    const cleanName = newCatName.trim()
    const duplicate = validCategories.some((category: any) =>
      String(category.name || '').trim().toLowerCase() === cleanName.toLowerCase()
    )

    if (duplicate) {
      hapticError()
      showToast('Já existe uma categoria com este nome.', 'warning')
      return
    }

    setSavingCategory(true)
    try {
      const id = crypto.randomUUID()
      const newOrderIndex = mainCategories.length > 0 ? Math.max(...mainCategories.map((c: any) => c.order_index || 0)) + 1 : 0
      const payload = {
        id, user_id: user.id, name: cleanName, icon: normalizeIconName(newCatIcon) || 'Tag', color: newCatColor,
        context: effectiveContext, type: type === 'income' ? 'income' : 'expense', order_index: newOrderIndex,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: 'pending', sync_attempts: 0,
      }

      const res = await safeAdd('categories', payload)
      if (!res.success) throw new Error(res.error)

      setCategoryId(id)
      setShowCreateCatModal(false)
      setNewCatName('')
      success()
      showToast('Categoria criada e selecionada.', 'success')
    } catch (err: any) {
      hapticError()
      showToast(`Erro ao criar categoria: ${err.message}`, 'error')
    } finally {
      setSavingCategory(false)
    }
  }

  const handleSaveAccount = async () => {
    if (!user?.id || !newAccName.trim()) return

    const cleanName = newAccName.trim()
    setSavingAccount(true)
    try {
      const id = crypto.randomUUID()
      const payload = {
        id, user_id: user.id, name: cleanName, color: newAccColor, context: effectiveContext,
        balance: 0, is_archived: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        sync_status: 'pending', sync_attempts: 0,
      }

      const res = await safeAdd('accounts', payload)
      if (!res.success) throw new Error(res.error)

      setAccountId(id)
      setShowCreateAccModal(false)
      setNewAccName('')
      success()
      showToast('Conta criada e selecionada.', 'success')
    } catch (err: any) {
      hapticError()
      showToast(`Erro ao criar conta: ${err.message}`, 'error')
    } finally {
      setSavingAccount(false)
    }
  }

  const handleSaveTag = async () => {
    if (!user?.id || !newTagName.trim()) return

    const cleanName = newTagName.trim()
    const duplicate = (tags || []).some((tag: any) =>
      String(tag.name || '').trim().toLowerCase() === cleanName.toLowerCase()
    )

    if (duplicate) {
      hapticError()
      showToast('Já existe uma tag com este nome.', 'warning')
      return
    }

    setSavingTag(true)
    try {
      const id = crypto.randomUUID()
      const payload = {
        id, user_id: user.id, name: cleanName, color: newTagColor, context: effectiveContext,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: 'pending', sync_attempts: 0,
      }

      const res = await safeAdd('tags', payload)
      if (!res.success) throw new Error(res.error)

      setSelectedTags((prev) => (prev.length < 5 ? [...prev, id] : prev))
      setShowCreateTagModal(false)
      setNewTagName('')
      success()
      showToast('Tag criada.', 'success')
    } catch (err: any) {
      hapticError()
      showToast(`Erro ao criar tag: ${err.message}`, 'error')
    } finally {
      setSavingTag(false)
    }
  }

  // ✅ FUNÇÃO HANDLE SAVE CORRIGIDA (COM VALIDAÇÃO DE CONTA OBRIGATÓRIA)
  const handleSave = useCallback(async () => {
    if (isSubmitting) return
    if (!user?.id) { showToast('Sessão expirada. Entre novamente.', 'error'); return }
    if (amountNum <= 0) { hapticError(); showToast('Informe um valor maior que zero.', 'warning'); return }

    // ✅ VALIDAÇÃO: obriga conta se não houver cartão
    if (!creditCardId && !accountId) {
      hapticError()
      showToast('Selecione uma conta ou cartão de crédito.', 'warning')
      return
    }

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
            notes: finalNotes || null,
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
            const freshAccount = await db.accounts.get(accountId)
            if (!freshAccount) {
              throw new Error('Conta selecionada não encontrada')
            }

            const currentBalance = safeNum(freshAccount.balance)
            const newBal =
              type === 'income'
                ? currentBalance + installmentAmount
                : currentBalance - installmentAmount

            const balanceResult = await safeUpdate('accounts', accountId, { balance: newBal })
            if (!balanceResult.success) {
              throw new Error(balanceResult.error || 'Erro ao atualizar saldo da conta')
            }
          }

          if (isReimbursable && i === 0) {
             const otherContext = effectiveContext === 'dfl' ? 'personal' : 'dfl'
             const reimbTxId = crypto.randomUUID()

             const reimbResult = await safeAdd('transactions', {
               id: reimbTxId, user_id: user.id, type: type === 'expense' ? 'income' : 'expense', amount: installmentAmount,
               description: `Reembolso: ${finalDescription}`, date: installmentDate, status: 'pending', context: otherContext,
               category_id: null, linked_transaction_id: txId, is_reimbursable: true,
               created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: 'pending', sync_attempts: 0,
             })
             if (!reimbResult.success) throw new Error(reimbResult.error || 'Erro ao criar reembolso vinculado')

             const linkResult = await safeUpdate('transactions', txId, { linked_transaction_id: reimbTxId })
             if (!linkResult.success) throw new Error(linkResult.error || 'Erro ao vincular reembolso')
          }
        }
      })

      success()
      const transactionLabel = type === 'income' ? 'Receita' : 'Despesa'
      showToast(
        isOnline
          ? `${transactionLabel} adicionada.`
          : `${transactionLabel} salva no dispositivo e aguardando sincronização.`,
        'success'
      )
      router.push('/transactions')
    } catch (e: any) {
      hapticError()
      showToast(`Erro ao salvar transação: ${e.message}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, user, amountNum, type, categoryId, desc, repetition, installments, frequency, creditCardId, isRefund, isPaid, accountId, contactId, selectedTags, receiptUrl, notes, financingId, debtId, isReimbursable, isOnline, router, showToast, effectiveContext, customInterval, customParcels, vibrate, success, hapticError, accounts, safeAdd, safeUpdate, date, selectedCat])

  const AttachmentIcon = useMemo(() => {
    if (uploading) return <Loader2 size={20} className="animate-spin text-teal-600" />
    if (receiptUrl) {
      if (receiptType === 'pdf') return <Paperclip size={20} className="text-teal-600 dark:text-teal-400" />
      return <ImageIcon size={20} className="text-teal-600 dark:text-teal-400" />
    }
    return <Camera size={20} className="text-gray-700 dark:text-gray-300" />
  }, [uploading, receiptUrl, receiptType])

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#f8f9fa] dark:bg-slate-900">
      
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={() => { vibrate([5]); router.back(); }}
              className="h-10 w-10 flex items-center justify-center rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 active:scale-[0.98] transition-transform shrink-0"
            >
              <ChevronLeft size={20} className="text-gray-700 dark:text-gray-300" />
            </button>

            <div className="flex-1 min-w-0 text-center">
              <h1 className="font-semibold text-[18px] text-gray-900 dark:text-gray-100 capitalize">
                {isIncome ? 'Nova receita' : 'Nova despesa'}
              </h1>
              <div className="mt-2 flex justify-center">
                <ContextToggle />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setShowQRScanner(true); vibrate([10]) }}
                className="h-10 w-10 flex items-center justify-center rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 active:scale-[0.98] transition-transform"
              >
                <QrCode size={18} className="text-gray-700 dark:text-gray-300" />
              </button>

              <button
                onClick={() => { !receiptUrl && setShowReceiptModal(true); vibrate([10]) }}
                className="h-10 w-10 flex items-center justify-center rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 active:scale-[0.98] transition-transform"
              >
                {AttachmentIcon}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CORPO DO FORMULÁRIO - COM pb-40 PARA O BOTÃO FICAR VISÍVEL */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-40">
        <div className="space-y-4">
          
          {/* TIPO DA TRANSAÇÃO */}
          <div className="rounded-[20px] border border-gray-200/70 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                aria-pressed={type === 'expense'}
                className={`flex h-11 items-center justify-center gap-2 rounded-[15px] text-[13px] font-bold transition-all active:scale-[0.98] ${
                  type === 'expense'
                    ? 'bg-red-50 text-red-600 shadow-sm ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20'
                    : 'text-gray-400 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-slate-700/50'
                }`}
              >
                <ArrowDown size={17} />
                Despesa
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                aria-pressed={type === 'income'}
                className={`flex h-11 items-center justify-center gap-2 rounded-[15px] text-[13px] font-bold transition-all active:scale-[0.98] ${
                  type === 'income'
                    ? 'bg-emerald-50 text-emerald-600 shadow-sm ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20'
                    : 'text-gray-400 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-slate-700/50'
                }`}
              >
                <ArrowUp size={17} />
                Receita
              </button>
            </div>
          </div>

          {/* VALOR */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 text-center">
            <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-2">
              Valor {isIncome ? 'da receita' : 'da despesa'}
            </p>

            <div className="flex justify-center items-center gap-1.5">
              <span className={`text-2xl font-bold opacity-50 ${themeColor}`}>R$</span>
              <MoneyInput
                value={amountNum}
                onChange={(num) => setAmountNum(num)}
                className={`text-[42px] font-black tracking-tight outline-none bg-transparent ${themeColor} w-64 text-center placeholder:text-gray-300 dark:placeholder:text-gray-700`}
                placeholder="0,00"
                autoFocus
              />
            </div>

            {type === 'expense' && budgetAlert && (
              <div
                className={`mt-4 max-w-sm mx-auto rounded-[16px] p-4 text-[12px] font-semibold ${
                  budgetAlert.type === 'danger'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50'
                    : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50'
                }`}
              >
                {budgetAlert.message}
              </div>
            )}
          </div>

          {/* COMPROVANTE */}
          {uploading ? (
            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
              <Loader2 size={20} className="animate-spin text-teal-700" />
              <span className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">
                Enviando comprovante...
              </span>
            </div>
          ) : receiptUrl ? (
            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {receiptPreview ? (
                  <div className="w-12 h-12 rounded-[16px] overflow-hidden bg-gray-200 dark:bg-slate-600 shrink-0 border border-gray-200 dark:border-slate-600">
                    <img src={receiptPreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 ${receiptType === 'pdf' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'}`}>
                    {receiptType === 'pdf' ? <Paperclip size={22} /> : <ImageIcon size={22} />}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {receiptName}
                  </p>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Comprovante anexado
                  </p>
                </div>
              </div>

              <button
                onClick={handleRemoveReceipt}
                className="h-9 w-9 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-slate-700/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-[0.98]"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : null}

          {/* FORMULÁRIO PRINCIPAL */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 space-y-4">
            {/* Descrição */}
            <div>
              <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                Descrição
              </label>
              <div className="rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3 focus-within:ring-2 focus-within:ring-teal-500/20 relative">
                <Edit3 size={18} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => { setDesc(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder={selectedCat ? selectedCat.name : 'Nome ou descrição'}
                  className="flex-1 bg-transparent text-[15px] font-semibold outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-[16px] shadow-lg overflow-hidden z-20">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={() => applySuggestion(s)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700 last:border-0"
                      >
                        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {s.description}
                        </span>
                        <span className="text-[12px] font-bold text-gray-400 shrink-0 ml-2">
                          R$ {s.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                {isIncome ? 'Recebido' : creditCardId ? 'Lançado na fatura' : 'Pago'}
              </span>
              {!creditCardId && (
                <button
                  onClick={() => { vibrate([5]); setIsPaid(!isPaid); }}
                  className={`w-14 h-8 rounded-full relative transition-all duration-300 shadow-inner ${toggleBgClass} active:scale-[0.98]`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-sm ${toggleTracks}`} />
                </button>
              )}
            </div>

            {/* Categoria */}
            <div>
              <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                Categoria
              </label>
              <button
                onClick={() => { vibrate([5]); setShowCatModal(true); }}
                className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {selectedCat ? (() => {
                    const IconComp = getDynamicIcon(selectedCat.icon)
                    return (
                      <div
                        className="w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: `${selectedCat.color}20`, color: selectedCat.color }}
                      >
                        <IconComp size={18} />
                      </div>
                    )
                  })() : (
                    <div className="w-10 h-10 rounded-[14px] bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400">
                      <Tag size={18} />
                    </div>
                  )}

                  <div className="text-left min-w-0">
                    <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 block">
                      Categoria
                    </span>
                    <span className={`text-[14px] font-semibold ${selectedCat ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                      {selectedCat ? selectedCat.name : 'Selecionar'}
                    </span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </button>
            </div>

            {/* Cartão de crédito */}
            {!isIncome && (creditCards || []).length > 0 && (
              <div>
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                  Cartão de crédito
                </label>
                <button
                  onClick={() => { vibrate([5]); setShowCardModal(true); }}
                  className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm ${selectedCard ? 'text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}
                      style={selectedCard ? { backgroundColor: selectedCard.color || '#f97316' } : {}}
                    >
                      <CreditCard size={18} />
                    </div>

                    <div className="text-left min-w-0">
                      <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 block">
                        Cartão de crédito
                      </span>
                      <span className={`text-[14px] font-semibold ${selectedCard ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                        {selectedCard ? selectedCard.name : 'Nenhum'}
                      </span>
                    </div>
                  </div>

                  {selectedCard ? (
                    <div
                      onClick={(e) => { e.stopPropagation(); vibrate([10]); setCreditCardId('') }}
                      className="h-8 w-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 text-gray-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </div>
                  ) : (
                    <ChevronRight size={18} className="text-gray-300" />
                  )}
                </button>
              </div>
            )}

            {/* Conta */}
            {!creditCardId && (
              <div>
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                  Conta
                </label>
                <button
                  onClick={() => { vibrate([5]); setShowAccModal(true); }}
                  className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[14px] bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400 shrink-0">
                      <Wallet size={18} />
                    </div>

                    <div className="text-left min-w-0">
                      <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 block">
                        Conta
                      </span>
                      <span className={`text-[14px] font-semibold ${selectedAcc ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                        {selectedAcc ? selectedAcc.name : 'Selecionar'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedAcc && <BankLogo color={selectedAcc.color} name={selectedAcc.name} size="sm" />}
                    <ChevronRight size={18} className="text-gray-300" />
                  </div>
                </button>
              </div>
            )}

            {/* Fornecedor / Cliente */}
            {(contacts || []).length > 0 && (
              <div>
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                  Fornecedor / Cliente
                </label>
                <button
                  onClick={() => { vibrate([5]); setShowContactModal(true); }}
                  className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[14px] bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400 shrink-0">
                      <Users size={18} />
                    </div>

                    <div className="text-left min-w-0">
                      <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 block">
                        Fornecedor / Cliente
                      </span>
                      <span className={`text-[14px] font-semibold ${selectedContact ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                        {selectedContact ? selectedContact.name : 'Nenhum'}
                      </span>
                    </div>
                  </div>

                  {selectedContact ? (
                    <div
                      onClick={(e) => { e.stopPropagation(); vibrate([10]); setContactId('') }}
                      className="h-8 w-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 text-gray-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </div>
                  ) : (
                    <ChevronRight size={18} className="text-gray-300" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* MAIS OPÇÕES */}
          <div>
            <button
              onClick={() => { vibrate([5]); setShowDetails(!showDetails) }}
              className="w-full rounded-[20px] bg-white dark:bg-slate-800 border border-gray-200/70 dark:border-slate-700 shadow-sm px-4 py-3 text-[13px] font-bold text-teal-600 dark:text-teal-400 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              {showDetails ? 'Ocultar opções avançadas' : 'Mais opções'}
              {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showDetails ? 'max-h-[1400px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 space-y-4">
                  {/* Data */}
                  <div>
                    <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                      Data
                    </label>
                    <button
                      type="button"
                      onClick={() => { vibrate([5]); setShowDatePicker(true) }}
                      className="flex w-full items-center gap-3 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 text-left active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900"
                    >
                      <Calendar size={18} className="shrink-0 text-gray-400" />
                      <span className="flex-1 text-[14px] font-semibold text-gray-800 dark:text-gray-200">{formatDateLabel(date)}</span>
                      <ChevronRight size={17} className="text-gray-300 dark:text-slate-600" />
                    </button>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                      Observações
                    </label>
                    <div className="rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-start gap-3 focus-within:ring-2 focus-within:ring-teal-500/20">
                      <FileText size={18} className="text-gray-400 shrink-0 mt-0.5" />
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Observações adicionais..."
                        rows={2}
                        className="flex-1 bg-transparent text-[14px] font-medium outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 resize-none"
                      />
                    </div>
                  </div>

                  {/* Repetição */}
                  <div>
                    <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                      Repetição da transação
                    </label>
                    <div className="rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-1.5">
                      <div className="flex gap-1.5 mb-4">
                        {[{ key: 'once', label: 'Única' }, { key: 'installments', label: 'Parcelar' }, { key: 'recurring', label: 'Recorrente' }].map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => { vibrate([5]); setRepetition(opt.key as Repetition) }}
                            className={`flex-1 h-10 rounded-[14px] text-[12px] font-bold transition-all active:scale-[0.98] ${
                              repetition === opt.key
                                ? 'bg-white dark:bg-slate-800 shadow-sm text-teal-600 dark:text-teal-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {repetition === 'installments' && (
                        <div className="rounded-[16px] border border-gray-200/70 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">Quantidade de parcelas</span>
                              <p className="mt-0.5 text-[11px] text-gray-400">{formatCurrency(amountNum / Math.max(installments, 1))} por parcela</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => { vibrate([5]); setInstallments((value) => Math.max(2, value - 1)) }} className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-gray-100 text-gray-600 active:scale-[0.95] dark:bg-slate-700 dark:text-gray-300"><Minus size={16} /></button>
                              <span className="min-w-[44px] text-center text-[15px] font-black text-gray-900 dark:text-gray-100">{installments}x</span>
                              <button type="button" onClick={() => { vibrate([5]); setInstallments((value) => Math.min(60, value + 1)) }} className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-teal-50 text-teal-700 active:scale-[0.95] dark:bg-teal-900/25 dark:text-teal-400"><Plus size={16} /></button>
                            </div>
                          </div>
                        </div>
                      )}

                      {repetition === 'recurring' && (
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap gap-2">
                            {[{ key: 'weekly', label: 'Semanal' }, { key: 'biweekly', label: 'Quinzenal' }, { key: 'monthly', label: 'Mensal' }, { key: 'bimonthly', label: 'Bimestral' }, { key: 'custom', label: 'Personalizar' }].map((f) => (
                              <button
                                key={f.key}
                                onClick={() => {
                                  vibrate([5])
                                  setFrequency(f.key as Frequency)
                                  if (f.key === 'custom') setShowCustomRecurrenceModal(true)
                                }}
                                className={`px-4 py-2.5 rounded-[14px] text-[12px] font-bold transition-all active:scale-[0.98] ${
                                  frequency === f.key
                                    ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-400'
                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-200/70 dark:border-slate-700'
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>

                          {frequency === 'custom' && (
                            <div className="bg-teal-50 dark:bg-teal-900/10 p-3 rounded-[16px] text-center">
                              <p className="text-[12px] font-semibold text-teal-700 dark:text-teal-400">
                                {customParcels} parcelas, a cada {customInterval} mês(es).
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <button
                  onClick={() => { vibrate([5]); setShowTagModal(true) }}
                  className="w-full bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 flex items-center justify-between active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-4">
                    <Tag size={18} className="text-gray-400" />
                    <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                      {selectedTags.length > 0 ? `${selectedTags.length} tag(ns) selecionada(s)` : 'Tags'}
                    </span>
                  </div>
                  <Plus size={18} className="text-teal-600 dark:text-teal-400" />
                </button>

                {/* Opções de despesa */}
                {!isIncome && (
                  <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2 space-y-2">
                    <div className="rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                          <RefreshCw size={14} className="text-orange-500" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">É um reembolso</span>
                          <span className="text-[12px] text-gray-400">Pago com recurso PF/PJ</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { vibrate([5]); setIsReimbursable(!isReimbursable) }}
                        className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${isReimbursable ? 'bg-orange-500' : 'bg-gray-200 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${isReimbursable ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                          <ArrowRightLeft size={14} className="text-blue-500" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Estorno / Devolução</span>
                          <span className="text-[12px] text-gray-400">Despesa anulada</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { vibrate([5]); setIsRefund(!isRefund) }}
                        className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${isRefund ? 'bg-blue-500' : 'bg-gray-200 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${isRefund ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div
                      className="rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between cursor-pointer active:bg-gray-100 dark:active:bg-slate-800 transition-colors"
                      onClick={() => { vibrate([5]); setShowFinancingModal(true) }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                          <Building size={14} className="text-purple-500" />
                        </div>
                        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Vincular financiamento</span>
                      </div>
                      <button className={`w-12 h-6 rounded-full transition-all duration-300 shadow-inner ${financingId ? 'bg-purple-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform mt-1 shadow-sm ${financingId ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div
                      className="rounded-[18px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between cursor-pointer active:bg-gray-100 dark:active:bg-slate-800 transition-colors"
                      onClick={() => { vibrate([5]); setShowLoanModal(true) }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                          <HandCoins size={14} className="text-amber-500" />
                        </div>
                        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Vincular empréstimo</span>
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
        </div>
      </div>

      {/* CTA FIXO INFERIOR - COM Z-INDEX MAIOR */}
      <div className="sticky bottom-0 z-50 bg-gradient-to-t from-[#f8f9fa] dark:from-slate-900 via-[#f8f9fa]/90 dark:via-slate-900/90 to-transparent px-4 py-5">
        <button
          onClick={() => { vibrate([10, 50]); handleSave() }}
          disabled={isSubmitting}
          className={`w-full h-14 rounded-[20px] flex items-center justify-center gap-2 text-white font-bold text-[15px] shadow-lg transition-all active:scale-[0.98] ${
            isIncome
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Salvando...
            </>
          ) : (
            <>
              <Check size={20} />
              {isIncome ? 'Adicionar receita' : 'Adicionar despesa'}
            </>
          )}
        </button>
      </div>

      {/* ============================================================
          TODOS OS MODAIS COM PORTAL E Z-INDEX CORRETO
          ============================================================ */}
      
      {/* MODAL CATEGORIA */}
      {showCatModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCatModal(false)}>
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Selecionar categoria</h3>
              <div className="flex gap-2">
                <button onClick={() => { setShowCatModal(false); setShowCreateCatModal(true); vibrate([10]) }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2.5 rounded-full active:scale-[0.95] transition-transform"><Plus size={20} /></button>
                <button onClick={() => setShowCatModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2.5 rounded-full active:scale-95"><X size={20} /></button>
              </div>
            </div>
            <div className="space-y-2 pb-10">
              {mainCategories.map((cat: any) => {
                const IconComp = getDynamicIcon(cat.icon)
                const subCount = subcategories[cat.id]?.length || 0
                const isActive = cat.id === categoryId
                return (
                  <button key={cat.id} onClick={() => { vibrate([5]); setCategoryId(cat.id); setSelectedParentCat(cat); subCount > 0 ? setShowSubCatModal(true) : setShowCatModal(false) }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
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
        </div>,
        document.body
      )}

      {/* MODAL SUBCATEGORIA */}
      {showSubCatModal && selectedParentCat && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSubCatModal(false)}>
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-right-8 duration-300 h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center gap-3 mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <button onClick={() => { vibrate([5]); setShowSubCatModal(false) }} className="p-2.5 -ml-2 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-95 transition-transform"><ChevronLeft size={20} /></button>
              <div>
                <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Subcategorias</h3>
                <p className="text-[12px] text-gray-400">{selectedParentCat.name}</p>
              </div>
              <button onClick={() => setShowSubCatModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>
            <div className="space-y-2 pb-6">
              {(subcategories[selectedParentCat.id] || []).map((sub: any) => {
                const SubIcon = getDynamicIcon(sub.icon)
                const isActive = sub.id === categoryId
                return (
                  <button key={sub.id} onClick={() => { vibrate([5]); setCategoryId(sub.id); setShowSubCatModal(false); setShowCatModal(false) }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${sub.color}20`, color: sub.color }}><SubIcon size={22} /></div>
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{sub.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              <button onClick={() => { vibrate([5]); setShowSubCatModal(false); setShowCatModal(false) }} className="w-full p-4 mt-2 flex items-center justify-center gap-2 rounded-[20px] bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 font-bold active:scale-[0.98] transition-transform border border-teal-100 dark:border-teal-800/50 shadow-sm">
                Usar categoria principal "{selectedParentCat.name}"
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL CONTA */}
      {showAccModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAccModal(false)}>
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
                  <button key={acc.id} onClick={() => { vibrate([5]); setAccountId(acc.id); setShowAccModal(false) }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                    <BankLogo color={acc.color} name={acc.name} size="md" />
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL CARTÃO */}
      {showCardModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCardModal(false)}>
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Cartão de crédito</h3>
              <button onClick={() => setShowCardModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2.5 rounded-full active:scale-95"><X size={20} /></button>
            </div>
            <div className="space-y-2 pb-6">
              {(creditCards || []).map(card => {
                const isActive = card.id === creditCardId
                return (
                  <button key={card.id} onClick={() => { vibrate([5]); setCreditCardId(card.id); setAccountId(''); setShowCardModal(false) }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: card.color || '#f97316' }}><CreditCard size={22} /></div>
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{card.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL CONTATO */}
      {showContactModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowContactModal(false)}>
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
                  <button key={contact.id} onClick={() => { vibrate([5]); setContactId(contact.id); setShowContactModal(false) }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${contact.color}20`, color: contact.color }}><IconComp size={22} /></div>
                    <div className="flex-1 text-left">
                      <p className={`text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{contact.name}</p>
                      <p className="text-[12px] text-gray-400 mt-0.5">{contact.type === 'supplier' ? 'Fornecedor' : contact.type === 'customer' ? 'Cliente' : 'Ambos'}</p>
                    </div>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL TAGS */}
      {showTagModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTagModal(false)}>
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
                  <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                    <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{tag.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAIS EXTERNOS */}
      {showReceiptModal && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          onCamera={() => setShowCamera(true)}
          onFileSelect={uploadFile}
        />
      )}
      {showCamera && <CameraCapture isOpen={showCamera} onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />}
      <DatePickerSheet
        isOpen={showDatePicker}
        value={date}
        onChange={handleDateChange}
        onClose={() => setShowDatePicker(false)}
        title="Data da transação"
      />
      {showQRScanner && <QRCodeScanner onClose={() => setShowQRScanner(false)} onResult={handleQRResult} />}
      {showFinancingModal && <ModalFinancing isOpen={showFinancingModal} onClose={() => setShowFinancingModal(false)} onSave={(id) => setFinancingId(id)} />}
      {showLoanModal && <ModalEmprestimo isOpen={showLoanModal} onClose={() => setShowLoanModal(false)} onSave={(id) => setDebtId(id)} />}
      <IconPicker isOpen={showIconPicker} onClose={() => setShowIconPicker(false)} selectedIcon={newCatIcon} onSelect={setNewCatIcon} />

      {/* MODAIS DE CRIAÇÃO */}
      {showCreateCatModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateCatModal(false)}>
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Nova Categoria</h3>
              <button onClick={() => setShowCreateCatModal(false)} className="text-gray-400 p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-[0.95] transition-transform"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nome da categoria" className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 text-[14px] font-semibold outline-none text-gray-800 dark:text-gray-200" />
              <button onClick={() => setShowIconPicker(true)} className="flex items-center gap-3 rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 w-full text-left active:scale-[0.98] transition-transform">
                <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${newCatColor}20`, color: newCatColor }}>{(() => { const I = getDynamicIcon(newCatIcon); return <I size={24} /> })()}</div>
                <span className="text-[15px] font-bold text-gray-800 dark:text-white flex-1">{newCatIcon}</span>
                <ChevronDown size={20} className="text-gray-400" />
              </button>
              <div className="rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">{CATEGORY_COLORS.map((c) => (<button key={c} onClick={() => { setNewCatColor(c); vibrate([10]) }} className={`w-10 h-10 rounded-full transition-transform active:scale-90 ${newCatColor === c ? 'scale-125 border-4 border-white dark:border-slate-800 shadow-md' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />))}</div>
              </div>
              <button onClick={handleSaveCategory} disabled={savingCategory || !newCatName.trim()} className="w-full bg-teal-600 text-white py-4 rounded-[20px] font-bold text-[16px] shadow-lg shadow-teal-600/30 disabled:opacity-50 flex justify-center items-center active:scale-[0.98] transition-transform mt-6">
                {savingCategory ? <Loader2 size={24} className="animate-spin" /> : 'Salvar Categoria'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCreateAccModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateAccModal(false)}>
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Nova Conta</h3>
              <button onClick={() => setShowCreateAccModal(false)} className="text-gray-400 p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-[0.95] transition-transform"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={newAccName} onChange={(e) => setNewAccName(e.target.value)} placeholder="Nome da conta" className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 text-[14px] font-semibold outline-none text-gray-800 dark:text-gray-200" />
              <div className="rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">{CATEGORY_COLORS.map((c) => (<button key={c} onClick={() => { setNewAccColor(c); vibrate([10]) }} className={`w-10 h-10 rounded-full transition-transform active:scale-90 ${newAccColor === c ? 'scale-125 border-4 border-white dark:border-slate-800 shadow-md' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />))}</div>
              </div>
              <button onClick={handleSaveAccount} disabled={savingAccount || !newAccName.trim()} className="w-full bg-teal-600 text-white py-4 rounded-[20px] font-bold text-[16px] shadow-lg shadow-teal-600/30 disabled:opacity-50 flex justify-center items-center active:scale-[0.98] transition-transform mt-6">
                {savingAccount ? <Loader2 size={24} className="animate-spin" /> : 'Salvar Conta'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCreateTagModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateTagModal(false)}>
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Nova Tag</h3>
              <button onClick={() => setShowCreateTagModal(false)} className="text-gray-400 p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-[0.95] transition-transform"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Nome da tag" className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 text-[14px] font-semibold outline-none text-gray-800 dark:text-gray-200" />
              <div className="rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">{CATEGORY_COLORS.map((c) => (<button key={c} onClick={() => { setNewTagColor(c); vibrate([10]) }} className={`w-10 h-10 rounded-full transition-transform active:scale-90 ${newTagColor === c ? 'scale-125 border-4 border-white dark:border-slate-800 shadow-md' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />))}</div>
              </div>
              <button onClick={handleSaveTag} disabled={savingTag || !newTagName.trim()} className="w-full bg-teal-600 text-white py-4 rounded-[20px] font-bold text-[16px] shadow-lg shadow-teal-600/30 disabled:opacity-50 flex justify-center items-center active:scale-[0.98] transition-transform mt-6">
                {savingTag ? <Loader2 size={24} className="animate-spin" /> : 'Salvar Tag'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCustomRecurrenceModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCustomRecurrenceModal(false)}>
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 animate-in slide-in-from-bottom-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Recorrência</h3>
              <button onClick={() => setShowCustomRecurrenceModal(false)} className="text-gray-400 p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-[0.95] transition-transform"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="rounded-[18px] border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">Lançamentos</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">Quantas vezes criar</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setCustomParcels((value) => Math.max(1, value - 1))} className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-white text-gray-600 shadow-sm active:scale-[0.95] dark:bg-slate-800 dark:text-gray-300"><Minus size={16} /></button>
                    <span className="min-w-[42px] text-center text-[15px] font-black text-gray-900 dark:text-gray-100">{customParcels}</span>
                    <button type="button" onClick={() => setCustomParcels((value) => Math.min(120, value + 1))} className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-teal-50 text-teal-700 active:scale-[0.95] dark:bg-teal-900/25 dark:text-teal-400"><Plus size={16} /></button>
                  </div>
                </div>
              </div>
              <div className="rounded-[18px] border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">Intervalo</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">Meses entre lançamentos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setCustomInterval((value) => Math.max(1, value - 1))} className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-white text-gray-600 shadow-sm active:scale-[0.95] dark:bg-slate-800 dark:text-gray-300"><Minus size={16} /></button>
                    <span className="min-w-[42px] text-center text-[15px] font-black text-gray-900 dark:text-gray-100">{customInterval}</span>
                    <button type="button" onClick={() => setCustomInterval((value) => Math.min(24, value + 1))} className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-teal-50 text-teal-700 active:scale-[0.95] dark:bg-teal-900/25 dark:text-teal-400"><Plus size={16} /></button>
                  </div>
                </div>
              </div>
              <button onClick={() => { setShowCustomRecurrenceModal(false); vibrate([10]) }} className="w-full bg-teal-600 text-white py-4 rounded-[20px] font-bold text-[16px] shadow-lg shadow-teal-600/30 mt-4 active:scale-[0.98] transition-transform">
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}

// EXPORTAÇÃO CORRETA
export default function NewTransactionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NewTransactionContent />
    </Suspense>
  )
}