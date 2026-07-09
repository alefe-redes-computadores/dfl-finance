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
  Edit3, FileText,
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
import { db, addToSyncQueue } from '@/lib/db'

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
  const { context: globalContext, appMode } = useContext_()
  const { vibrate, success } = useHapticFeedback()

  const effectiveContext = appMode === 'personal_only' ? 'personal' : globalContext
  const [loadingPulse, setLoadingPulse] = useState(false)

  const galeriaInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<TxType>(
    (searchParams.get('type') as TxType) || 'expense'
  )
  const [context, setContext] = useState<Context>(() => {
    return effectiveContext
  })
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

  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<Record<string, any[]>>({})
  const [accounts, setAccounts] = useState<any[]>([])
  const [creditCards, setCreditCards] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])

  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptName, setReceiptName] = useState<string>('')
  const [receiptType, setReceiptType] = useState<'image' | 'pdf' | null>(null)
  const [uploading, setUploading] = useState(false)

  const [installments, setInstallments] = useState(1)
  const [budgets, setBudgets] = useState<any[]>([])
  const [budgetAlert, setBudgetAlert] = useState<{
    message: string; type: 'warning' | 'danger'
  } | null>(null)

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

  const { data: localAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context: effectiveContext },
  })

  const { data: localCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext, type: type === 'income' ? 'income' : 'expense' },
  })

  const { data: localTags } = useLocalData({
    table: 'tags' as any,
    filters: { context: effectiveContext },
  })

  const { data: localCreditCards } = useLocalData({
    table: 'credit_cards' as any,
    filters: { context: effectiveContext, is_archived: false },
  })

  const { data: localContacts } = useLocalData({
    table: 'contacts' as any,
    filters: { context: effectiveContext },
  })

  const { data: localBudgets } = useLocalData({
    table: 'budgets' as any,
    filters: { context: effectiveContext },
  })

  useEffect(() => {
    if (localAccounts) setAccounts(localAccounts)
  }, [localAccounts])

  useEffect(() => {
    if (localCategories) {
      const mainCats = localCategories.filter((c: any) => !c.parent_id)
      const subCats = localCategories.filter((c: any) => c.parent_id)
      const subsMap: Record<string, any[]> = {}
      subCats.forEach((sub: any) => {
        if (!subsMap[sub.parent_id]) subsMap[sub.parent_id] = []
        subsMap[sub.parent_id].push(sub)
      })
      setCategories(mainCats)
      setSubcategories(subsMap)
    }
  }, [localCategories])

  useEffect(() => {
    if (localTags) setTags(localTags)
  }, [localTags])

  useEffect(() => {
    if (localCreditCards) setCreditCards(localCreditCards)
  }, [localCreditCards])

  useEffect(() => {
    if (localContacts) setContacts(localContacts)
  }, [localContacts])

  useEffect(() => {
    if (localBudgets) setBudgets(localBudgets)
  }, [localBudgets])

  useEffect(() => {
    setContext(effectiveContext)
    setAccountId('')
    setCategoryId('')
    setCreditCardId('')
    setContactId('')
    setSelectedTags([])
  }, [effectiveContext])

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const handleDateChange = (newDateStr: string) => {
    setDate(newDateStr)
    const selected = createLocalDate(newDateStr)
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    selected.setHours(12, 0, 0, 0)
    setIsPaid(selected <= today)
  }

  const isIncome = type === 'income'
  const themeColor = isIncome ? 'text-emerald-700' : 'text-red-600'
  const bgColor = isIncome ? 'bg-emerald-700' : 'bg-red-600'

  const selectedCat =
    categories.find((c) => c.id === categoryId) ||
    Object.values(subcategories)
      .flat()
      .find((s: any) => s.id === categoryId)
  const selectedAcc = accounts.find((a) => a.id === accountId)
  const selectedCard = creditCards.find((c) => c.id === creditCardId)
  const selectedContact = contacts.find((c) => c.id === contactId)

  const toggleTag = useCallback((id: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }, [])

  const budgetAlertMemo = useMemo(() => {
    if (!categoryId || amountNum <= 0 || type !== 'expense') {
      return null
    }
    const budget = budgets.find((b) => b.category_id === categoryId)
    if (!budget) return null
    return budget
  }, [categoryId, amountNum, type, budgets])

  // Este alerta é só informativo (não grava nada), então manter a leitura
  // via Supabase aqui é aceitável — não é o mesmo risco de um cálculo que
  // será escrito no banco.
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
        const spent = (data || []).reduce(
          (a: number, t: any) => a + (Number(t.amount) || 0), 0
        )
        const total = spent + amountNum
        const limit = Number(budget.amount)
        const percent = (total / limit) * 100

        if (total > limit) {
          setBudgetAlert({
            message: `⚠️ Este valor ultrapassa o orçamento de "${budget.name}" (${formatCurrency(limit)}). Já foi gasto ${formatCurrency(spent)}.`,
            type: 'danger',
          })
        } else if (percent >= 80) {
          setBudgetAlert({
            message: `⚠️ Atenção! Com este valor, "${budget.name}" atinge ${percent.toFixed(0)}% do orçamento (${formatCurrency(limit)}).`,
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

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file, { upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(path)

      if (receiptUrl) {
        const oldPath = receiptUrl.split('/').slice(-2).join('/')
        await supabase.storage.from('receipts').remove([oldPath])
      }

      setReceiptUrl(urlData.publicUrl)
      showToast('Comprovante anexado!', 'success')

      if (isImage) {
        try {
          const ocrResponse = await fetch('/api/ocr-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: urlData.publicUrl }),
          })
          const ocrData = await ocrResponse.json()
          if (ocrData.success && ocrData.data) {
            if (ocrData.data.amount > 0 && ocrData.data.date) {
              const { data: similarTxs } = await supabase
                .from('transactions')
                .select('id, description, amount, date')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .eq('type', 'expense')
                .gte('amount', ocrData.data.amount - 1)
                .lte('amount', ocrData.data.amount + 1)
                .gte('date', ocrData.data.date)
                .lte('date', ocrData.data.date)
                .limit(3)

              if (similarTxs && similarTxs.length > 0) {
                const tx = similarTxs[0]
                const confirmed = confirm(
                  `🔍 Conciliação Inteligente\n\n` +
                  `Encontramos uma despesa similar:\n` +
                  `"${tx.description}" — ${formatCurrency(tx.amount)} em ${format(new Date(tx.date), "dd/MM")}\n\n` +
                  `Deseja anexar este comprovante a essa transação existente?`
                )
                if (confirmed) {
                  await supabase
                    .from('transactions')
                    .update({ receipt_url: urlData.publicUrl })
                    .eq('id', tx.id)
                  showToast('Comprovante vinculado à transação existente!', 'success')
                  vibrate([50])
                  return
                }
              }
            }

            if (ocrData.data.amount > 0) {
              setAmountNum(ocrData.data.amount)
              setAmountFormatted(ocrData.data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
            }
            if (ocrData.data.date) setDate(ocrData.data.date)
            if (ocrData.data.description) setDesc(ocrData.data.description)
            if (ocrData.data.suggested_category) {
              const matchedCat = categories.find((c: any) => c.name.toLowerCase() === ocrData.data.suggested_category.toLowerCase())
              if (matchedCat) setCategoryId(matchedCat.id)
            }
            vibrate([50, 100, 50])
            showToast('Dados do comprovante extraídos! Revise antes de salvar.', 'success')
          }
        } catch (ocrError) {
          console.error('Erro ao extrair dados do comprovante:', ocrError)
        }
      }
    } catch (err: any) {
      console.error('Erro upload:', err)
      showToast(`Erro ao anexar: ${err.message}`, 'error')
      setReceiptPreview(null)
      setReceiptName('')
      setReceiptType(null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveReceipt = async () => {
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

  const handleReceiptOption = (option: string) => {
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
  }

  const handleSaveCategory = async () => {
    if (!user?.id || !newCatName.trim()) return
    setSavingCategory(true)
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
          name: newCatName.trim(),
          icon: newCatIcon,
          color: newCatColor,
          context: effectiveContext,
          type: type === 'income' ? 'income' : 'expense',
        })
        .select()
        .single()
      if (error) throw error
      setCategories((prev) => [...prev, data])
      setCategoryId(data.id)
      setShowCreateCatModal(false)
      setNewCatName('')
      showToast('Categoria criada!', 'success')
    } catch (err: any) {
      console.error(err)
      showToast(`Erro ao criar categoria: ${err.message || 'Erro desconhecido'}`, 'error')
    } finally {
      setSavingCategory(false)
    }
  }

  const handleSaveAccount = async () => {
    if (!user?.id || !newAccName.trim()) return
    setSavingAccount(true)
    try {
      const { data, error } = await supabase
        .from('accounts')
        .insert({ 
          user_id: user.id, 
          name: newAccName.trim(), 
          color: newAccColor, 
          context: effectiveContext,
          balance: 0,
          is_archived: false,
        })
        .select()
        .single()
      if (error) throw error
      setAccounts((prev) => [...prev, data])
      setAccountId(data.id)
      setShowCreateAccModal(false)
      setNewAccName('')
      showToast('Conta criada!', 'success')
    } catch (err: any) {
      console.error(err)
      showToast(`Erro ao criar conta: ${err.message || 'Erro desconhecido'}`, 'error')
    } finally {
      setSavingAccount(false)
    }
  }

  const handleSaveTag = async () => {
    if (!user?.id || !newTagName.trim()) return
    setSavingTag(true)
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ 
          user_id: user.id, 
          name: newTagName.trim(), 
          color: newTagColor, 
          context: effectiveContext 
        })
        .select()
        .single()
      if (error) throw error
      setTags((prev) => [...prev, data])
      setSelectedTags((prev) => (prev.length < 5 ? [...prev, data.id] : prev))
      setShowCreateTagModal(false)
      setNewTagName('')
      showToast('Tag criada!', 'success')
    } catch (err: any) {
      console.error(err)
      showToast(`Erro ao criar tag: ${err.message || 'Erro desconhecido'}`, 'error')
    } finally {
      setSavingTag(false)
    }
  }

  // Salva a transação (ou as N parcelas). Fatura de cartão, saldo da conta
  // e todas as transações da série são gravadas dentro da MESMA
  // db.transaction — atômico de ponta a ponta. As leituras que alimentam
  // esses cálculos (saldo atual, dados do cartão, fatura aberta) agora
  // vêm sempre do banco local (Dexie), nunca do Supabase — funciona
  // offline e fica consistente com o que a tela está mostrando. A escrita
  // no Dexie acontece sempre, online ou offline; a sincronização com o
  // Supabase é responsabilidade do useOfflineQueue, que roda em segundo
  // plano quando a conexão volta.
  const handleSave = useCallback(async () => {
    if (isSubmitting) return
    if (!user?.id) { showToast('Sessão expirada.', 'error'); return }
    if (amountNum <= 0) { showToast('Valor deve ser maior que zero.', 'warning'); return }

    setIsSubmitting(true)

    if (type === 'expense' && categoryId && budgets.length > 0) {
      const budget = budgets.find((b) => b.category_id === categoryId)
      if (budget) {
        const start = format(startOfMonth(new Date(date)), 'yyyy-MM-dd')
        const end = format(endOfMonth(new Date(date)), 'yyyy-MM-dd')
        const { data: existingTxs } = await supabase
          .from('transactions')
          .select('amount')
          .match({ user_id: user.id, context: effectiveContext, category_id: categoryId })
          .eq('status', 'done')
          .gte('date', start)
          .lte('date', end)

        const spent = (existingTxs || []).reduce(
          (a: number, t: any) => a + (Number(t.amount) || 0), 0
        )
        const total = spent + amountNum
        const limit = Number(budget.amount)

        if (total > limit) {
          const proceed = confirm(
            `⚠️ Alerta de Orçamento!\n\n"${budget.name}" já tem ${formatCurrency(spent)} gasto(s).\n` +
            `Com mais ${formatCurrency(amountNum)}, o total será ${formatCurrency(total)}.\n` +
            `O orçamento é de ${formatCurrency(limit)}.\n\nDeseja continuar mesmo assim?`
          )
          if (!proceed) { setIsSubmitting(false); return }
        }
      }
    }

    const finalDescription = desc.trim() || selectedCat?.name || 'Transação sem nome'

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

    const installmentAmount =
      totalParcels > 1 && repetition === 'installments'
        ? amountNum / totalParcels
        : amountNum

    try {
      const baseDate = createLocalDate(date)
      let invoiceId: string | null = null

      await db.transaction('rw', db.accounts, db.transactions, db.credit_invoices, db.syncQueue, async () => {
        // ------------------------------------------------------------
        // Fatura do cartão (se aplicável) — tudo lido/gravado local
        // ------------------------------------------------------------
        if (type === 'expense' && creditCardId && !isRefund) {
          const txDate = new Date(date)
          const cardData = await db.table('credit_cards').get(creditCardId)

          if (cardData) {
            let closingDate = new Date(txDate.getFullYear(), txDate.getMonth(), cardData.closing_day)
            if (txDate > closingDate) {
              closingDate = new Date(txDate.getFullYear(), txDate.getMonth() + 1, cardData.closing_day)
            }

            const startDate = new Date(closingDate)
            startDate.setMonth(startDate.getMonth() - 1)
            startDate.setDate(cardData.closing_day + 1)

            const dueDate = new Date(closingDate)
            dueDate.setDate(cardData.due_day)
            if (dueDate <= closingDate) {
              dueDate.setMonth(dueDate.getMonth() + 1)
            }

            const dateStr = format(txDate, 'yyyy-MM-dd')
            const allInvoices = await db.table('credit_invoices')
              .where('credit_card_id').equals(creditCardId)
              .toArray()
            const existingInvoice = allInvoices.find((inv: any) =>
              inv.status === 'open' && inv.start_date <= dateStr && inv.end_date >= dateStr
            )

            if (existingInvoice) {
              invoiceId = existingInvoice.id
            } else {
              const newInvoiceId = crypto.randomUUID()
              const invoicePayload = {
                id: newInvoiceId,
                user_id: user.id,
                credit_card_id: creditCardId,
                closing_date: closingDate.toISOString().split('T')[0],
                due_date: dueDate.toISOString().split('T')[0],
                start_date: startDate.toISOString().split('T')[0],
                end_date: closingDate.toISOString().split('T')[0],
                total_amount: 0,
                paid_amount: 0,
                status: 'open',
                context: effectiveContext,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: 'pending',
                sync_attempts: 0,
              }
              await db.table('credit_invoices').add(invoicePayload)
              await addToSyncQueue(user.id, 'credit_invoices', 'create', newInvoiceId, invoicePayload)
              invoiceId = newInvoiceId
            }

            if (invoiceId) {
              const currentInvoice = await db.table('credit_invoices').get(invoiceId)
              const newTotal = safeNum(currentInvoice?.total_amount) + installmentAmount
              const updateData = {
                total_amount: newTotal,
                updated_at: new Date().toISOString(),
              }
              const updated = await db.table('credit_invoices').update(invoiceId, updateData)
              if (!updated) throw new Error('Falha ao atualizar fatura do cartão')
              await addToSyncQueue(user.id, 'credit_invoices', 'update', invoiceId, updateData)
            }
          }
        }

        // ------------------------------------------------------------
        // Saldo da conta (se pago e não for no cartão) — lido local
        // ------------------------------------------------------------
        if (isPaid && accountId && type !== 'transfer' && !creditCardId) {
          const acc = await db.table('accounts').get(accountId)

          if (acc) {
            const currentBalance = safeNum(acc.balance)
            const newBalance =
              type === 'income'
                ? currentBalance + installmentAmount
                : currentBalance - installmentAmount

            if (type === 'expense' && newBalance < 0 && !acc.allow_negative) {
              const proceed = confirm(
                `⚠️ Saldo Insuficiente!\n\nSaldo atual: ${formatCurrency(currentBalance)}\n` +
                `Valor: ${formatCurrency(installmentAmount)}\nResultante: ${formatCurrency(newBalance)}\n\n` +
                `Deseja continuar mesmo assim?`
              )
              if (!proceed) throw new Error('__CANCELLED_BY_USER__')
            }

            const accUpdated = await db.table('accounts').update(accountId, { balance: newBalance })
            if (!accUpdated) throw new Error('Falha ao atualizar saldo da conta')
            await addToSyncQueue(user.id, 'accounts', 'update', accountId, { balance: newBalance })
          }
        }

        // ------------------------------------------------------------
        // Transação(ões) — sempre grava local, mesmo offline. A
        // sincronização com o Supabase é feita depois, em segundo
        // plano, pelo useOfflineQueue.
        // ------------------------------------------------------------
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
            invoice_id: invoiceId,
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

          await db.table('transactions').add(payload)
          await addToSyncQueue(user.id, 'transactions', 'create', txId, payload)

          if (i === 0 && isReimbursable) {
            const otherContext = effectiveContext === 'dfl' ? 'personal' : 'dfl'
            const reimbursementDesc = `Reembolso: ${finalDescription}`
            const reimbTxId = crypto.randomUUID()
            const reimbPayload = {
              id: reimbTxId,
              user_id: user.id,
              type: type === 'expense' ? 'income' : 'expense',
              amount: installmentAmount,
              description: reimbursementDesc,
              date: installmentDate,
              status: 'pending',
              context: otherContext,
              category_id: null,
              linked_transaction_id: txId,
              is_reimbursable: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              sync_status: 'pending',
              sync_attempts: 0,
            }
            await db.table('transactions').add(reimbPayload)
            await addToSyncQueue(user.id, 'transactions', 'create', reimbTxId, reimbPayload)

            await db.table('transactions').update(txId, { linked_transaction_id: reimbTxId })
            await addToSyncQueue(user.id, 'transactions', 'update', txId, { linked_transaction_id: reimbTxId })
          }
        }
      })

      showToast(
        isOnline ? 'Transação salva com sucesso!' : 'Salvo localmente. Será sincronizado quando houver conexão.',
        isOnline ? 'success' : 'info'
      )
      success()
      router.refresh()
      router.push('/transactions')
    } catch (e: any) {
      if (e?.message === '__CANCELLED_BY_USER__') {
        // Usuário cancelou no aviso de saldo insuficiente — não é erro.
      } else {
        console.error('Erro ao salvar:', e)
        showToast(`Erro ao salvar transação: ${e.message || 'Verifique sua conexão'}`, 'error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, user, amountNum, type, categoryId, budgets, date, desc, selectedCat, repetition, installments, frequency, creditCardId, isRefund, isPaid, accountId, contactId, selectedTags, receiptUrl, notes, financingId, debtId, isReimbursable, isOnline, router, showToast, effectiveContext, customInterval, customParcels, vibrate, success])

  const AttachmentIcon = useMemo(() => {
    if (uploading) return <Loader2 size={20} className="animate-spin text-teal-600" />
    if (receiptUrl) {
      if (receiptType === 'pdf') return <Paperclip size={20} className="text-teal-600 dark:text-teal-400" />
      return <ImageIcon size={20} className="text-teal-600 dark:text-teal-400" />
    }
    return <Camera size={20} className="text-gray-700 dark:text-gray-300" />
  }, [uploading, receiptUrl, receiptType])

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 font-sans text-gray-800 dark:text-gray-200 overflow-y-auto pb-32 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      <input
        ref={galeriaInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadFile(file)
          e.target.value = ''
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadFile(file)
          e.target.value = ''
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2 sticky top-0 bg-slate-50 dark:bg-slate-900 z-40">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm">
          <ChevronLeft size={22} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="font-bold text-base text-gray-800 dark:text-gray-100">
          {isIncome ? 'Nova Receita' : creditCardId ? 'Nova Compra no Cartão' : 'Nova Despesa'}
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQRScanner(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm">
            <QrCode size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          <button onClick={() => !receiptUrl && setShowReceiptModal(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm">
            {AttachmentIcon}
          </button>
        </div>
      </div>

      <ContextToggle />

      {/* Valor */}
      <div className="py-6 text-center px-6">
        <p className="text-gray-400 dark:text-gray-500 text-xs mb-2">
          Valor {isIncome ? 'da Receita' : creditCardId ? 'da Compra' : 'da Despesa'}
        </p>
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
          <div className={`mt-3 mx-6 p-3 rounded-xl text-xs font-bold ${budgetAlert.type === 'danger' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800'}`}>
            {budgetAlert.message}
          </div>
        )}
      </div>

      {/* Preview do comprovante */}
      {uploading ? (
        <div className="mx-4 mb-4 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-teal-700" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Enviando comprovante...</span>
        </div>
      ) : receiptUrl ? (
        <div className="mx-4 mb-4 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            {receiptPreview ? (
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-200 dark:bg-slate-600 flex-shrink-0">
                <img src={receiptPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                {receiptType === 'pdf' ? <Paperclip size={22} className="text-teal-600 dark:text-teal-400" /> : <ImageIcon size={22} className="text-teal-600 dark:text-teal-400" />}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{receiptName}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Comprovante anexado</p>
            </div>
            <button onClick={handleRemoveReceipt} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
          </div>
        </div>
      ) : null}

      {/* Campos principais */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl mx-4 shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-50 dark:border-slate-700">
          <Edit3 size={20} className="text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={selectedCat ? selectedCat.name : 'Nome da transação'}
            className="flex-1 text-sm font-medium bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-50 dark:border-slate-700">
          <span className="font-bold text-sm text-gray-700 dark:text-gray-300">
            {isIncome ? 'Recebido' : creditCardId ? 'Compra no cartão' : 'Pago'}
          </span>
          {!creditCardId && (
            <button onClick={() => setIsPaid(!isPaid)} className={`w-12 h-6 rounded-full transition-colors ${isPaid ? bgColor : 'bg-gray-200 dark:bg-gray-600'}`}>
              <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          )}
        </div>

        {!isIncome && creditCards.length > 0 && (
          <button onClick={() => setShowCardModal(true)} className="w-full flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            <div className="flex items-center gap-4">
              <CreditCard size={20} className="text-gray-400 dark:text-gray-500" />
              <span className={`text-sm font-medium ${selectedCard ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                {selectedCard ? selectedCard.name : 'Cartão de crédito (opcional)'}
              </span>
            </div>
            {selectedCard && (
              <div onClick={(e) => { e.stopPropagation(); setCreditCardId('') }} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors"><X size={16} /></div>
            )}
          </button>
        )}

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
            <div onClick={(e) => { e.stopPropagation(); setShowCreateCatModal(true) }} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-full transition-colors"><Plus size={20} /></div>
          </div>
        </button>

        {!creditCardId && (
          <button onClick={() => setShowAccModal(true)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            <div className="flex items-center gap-4">
              <Wallet size={20} className="text-gray-400 dark:text-gray-500" />
              <span className={`text-sm font-medium ${selectedAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                {selectedAcc ? selectedAcc.name : 'Conta'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedAcc && <BankLogo color={selectedAcc.color} name={selectedAcc.name} size="sm" />}
              <div onClick={(e) => { e.stopPropagation(); setShowCreateAccModal(true) }} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-full transition-colors"><Plus size={20} /></div>
            </div>
          </button>
        )}

        {contacts.length > 0 && (
          <button onClick={() => setShowContactModal(true)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors border-t border-gray-50 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <Users size={20} className="text-gray-400 dark:text-gray-500" />
              <span className={`text-sm font-medium ${selectedContact ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                {selectedContact ? selectedContact.name : 'Fornecedor / Cliente (opcional)'}
              </span>
            </div>
            {selectedContact && (
              <div onClick={(e) => { e.stopPropagation(); setContactId('') }} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors"><X size={16} /></div>
            )}
          </button>
        )}
      </div>

      {/* Mais detalhes */}
      <div className="mx-4 mt-4">
        <button onClick={() => setShowDetails(!showDetails)} className="text-teal-700 dark:text-teal-400 text-sm font-bold flex items-center gap-1 mx-auto py-2">
          {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDetails && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden mt-2">
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-5 py-5 text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-50 dark:border-slate-700 outline-none bg-transparent"
            />

            <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-50 dark:border-slate-700">
              <FileText size={20} className="text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações (opcional)"
                className="flex-1 text-sm font-medium bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>

            <div className="px-5 py-5 border-b border-gray-50 dark:border-slate-700">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">Repetição</p>
              <div className="flex gap-2 mb-4">
                {[{ key: 'once', label: 'Única' }, { key: 'installments', label: 'Parcelar' }, { key: 'recurring', label: 'Recorrente' }].map((opt) => (
                  <button key={opt.key} onClick={() => setRepetition(opt.key as Repetition)} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${repetition === opt.key ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700 dark:border-teal-500 text-teal-800 dark:text-teal-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {repetition === 'installments' && (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700 p-4 rounded-xl">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Parcelas</span>
                  <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="bg-transparent text-sm font-bold outline-none text-gray-800 dark:text-gray-200">
                    {[2,3,4,5,6,7,8,9,10,11,12].map((n) => (<option key={n} value={n}>{n}x</option>))}
                  </select>
                </div>
              )}
              {repetition === 'recurring' && (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex flex-wrap gap-2">
                    {[{ key: 'weekly', label: 'Semanal' }, { key: 'biweekly', label: 'Quinzenal' }, { key: 'monthly', label: 'Mensal' }, { key: 'bimonthly', label: 'Bimestral' }, { key: 'custom', label: 'Personalizar' }].map((f) => (
                      <button key={f.key} onClick={() => { setFrequency(f.key as Frequency); if (f.key === 'custom') setShowCustomRecurrenceModal(true) }} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${frequency === f.key ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700 dark:border-teal-500 text-teal-800 dark:text-teal-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'}`}>
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
                  {selectedTags.length > 0 ? `${selectedTags.length} tag(ns) selecionada(s)` : 'Tags'}
                </span>
              </div>
              <Plus size={20} className="text-teal-700 dark:text-teal-400" />
            </button>

            {!isIncome && (
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RefreshCw size={20} className="text-gray-400 dark:text-gray-500" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">É um reembolso</span>
                      <span className="text-[11px] text-gray-400">Pago com recurso do outro contexto (PF/PJ)</span>
                    </div>
                  </div>
                  <button onClick={() => setIsReimbursable(!isReimbursable)} className={`w-12 h-6 rounded-full transition-colors ${isReimbursable ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${isReimbursable ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ArrowRightLeft size={20} className="text-gray-400 dark:text-gray-500" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">É uma devolução / estorno</span>
                  </div>
                  <button onClick={() => setIsRefund(!isRefund)} className={`w-12 h-6 rounded-full transition-colors ${isRefund ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${isRefund ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowFinancingModal(true)}>
                  <div className="flex items-center gap-3"><Building size={20} className="text-gray-400 dark:text-gray-500" /><span className="text-sm font-bold text-gray-800 dark:text-gray-200">Financiamento</span></div>
                  <button className={`w-12 h-6 rounded-full transition-colors ${financingId ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${financingId ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowLoanModal(true)}>
                  <div className="flex items-center gap-3"><HandCoins size={20} className="text-gray-400 dark:text-gray-500" /><span className="text-sm font-bold text-gray-800 dark:text-gray-200">Empréstimo a alguém</span></div>
                  <button className={`w-12 h-6 rounded-full transition-colors ${debtId ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${debtId ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botão salvar */}
      <div className="fixed bottom-8 w-full flex justify-center z-40 pointer-events-none">
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          className={`pointer-events-auto w-16 h-16 ${bgColor} rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform disabled:opacity-50`}
        >
          {isSubmitting ? (
            <Loader2 size={30} className="text-white animate-spin" />
          ) : (
            <Check size={30} className="text-white" />
          )}
        </button>
      </div>

      {showReceiptModal && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          onOptionSelect={handleReceiptOption}
        />
      )}
      {showCamera && (
        <CameraCapture
          isOpen={showCamera}
          onClose={() => setShowCamera(false)}
          onCapture={handleCameraCapture}
        />
      )}
      {showQRScanner && (
        <QRCodeScanner
          onClose={() => setShowQRScanner(false)}
          onResult={handleQRResult}
        />
      )}
      {showFinancingModal && (
        <ModalFinancing
          isOpen={showFinancingModal}
          onClose={() => setShowFinancingModal(false)}
          onSave={(id) => setFinancingId(id)}
        />
      )}
      {showLoanModal && (
        <ModalEmprestimo
          isOpen={showLoanModal}
          onClose={() => setShowLoanModal(false)}
          onSave={(id) => setDebtId(id)}
        />
      )}
      <IconPicker
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        selectedIcon={newCatIcon}
        onSelect={setNewCatIcon}
      />

      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Categorias</h3>
              <button onClick={() => { setShowCatModal(false); setShowCreateCatModal(true) }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {categories.map((cat) => {
                const IconComp = getDynamicIcon(cat.icon)
                const subCount = subcategories[cat.id]?.length || 0
                const isActive = cat.id === categoryId
                return (
                  <button key={cat.id} onClick={() => { setCategoryId(cat.id); setSelectedParentCat(cat); subCount > 0 ? setShowSubCatModal(true) : setShowCatModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}><IconComp size={20} /></div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
                    {subCount > 0 && <span className="text-xs text-gray-400 font-medium mr-2">{subCount}</span>}
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                    {subCount > 0 && <ChevronRight size={18} className="text-gray-300" />}
                  </button>
                )
              })}
              {categories.length === 0 && <p className="text-center text-gray-400 mt-10">Nenhuma categoria encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {showSubCatModal && selectedParentCat && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50" onClick={() => setShowSubCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <button onClick={() => setShowSubCatModal(false)} className="p-1 -ml-2"><ChevronLeft size={22} className="text-gray-700 dark:text-gray-300" /></button>
              <div><h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Subcategorias</h3><p className="text-xs text-gray-500">{selectedParentCat.name}</p></div>
            </div>
            <div className="space-y-2">
              {(subcategories[selectedParentCat.id] || []).map((sub: any) => {
                const SubIcon = getDynamicIcon(sub.icon)
                const isActive = sub.id === categoryId
                return (
                  <button key={sub.id} onClick={() => { setCategoryId(sub.id); setShowSubCatModal(false); setShowCatModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${sub.color}20`, color: sub.color }}><SubIcon size={20} /></div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{sub.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              <button onClick={() => { setShowSubCatModal(false); setShowCatModal(false) }} className="w-full p-3 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 dark:bg-slate-700 text-gray-500 font-medium">
                Usar "{selectedParentCat.name}" sem subcategoria
              </button>
            </div>
          </div>
        </div>
      )}

      {showAccModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Contas</h3>
              <button onClick={() => { setShowAccModal(false); setShowCreateAccModal(true) }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {accounts.map((acc) => {
                const isActive = acc.id === accountId
                return (
                  <button key={acc.id} onClick={() => { setAccountId(acc.id); setShowAccModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <BankLogo color={acc.color} name={acc.name} size="md" />
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {accounts.length === 0 && <p className="text-center text-gray-400 mt-10">Nenhuma conta encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {showCardModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCardModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Cartões de Crédito</h3>
              <button onClick={() => setShowCardModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {creditCards.map((card) => {
                const isActive = card.id === creditCardId
                return (
                  <button key={card.id} onClick={() => { setCreditCardId(card.id); setShowCardModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: card.color || '#f97316' }}><CreditCard size={20} /></div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{card.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {creditCards.length === 0 && <p className="text-center text-gray-400 mt-10">Nenhum cartão cadastrado.</p>}
            </div>
          </div>
        </div>
      )}

      {showContactModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowContactModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Contatos</h3>
              <button onClick={() => setShowContactModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {contacts.map((contact) => {
                const isActive = contact.id === contactId
                const IconComp = getDynamicIcon(contact.icon || 'user')
                return (
                  <button key={contact.id} onClick={() => { setContactId(contact.id); setShowContactModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${contact.color}20`, color: contact.color }}>
                      <IconComp size={20} />
                    </div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{contact.name}</span>
                    <span className="text-xs text-gray-400">{contact.type === 'supplier' ? 'Fornecedor' : contact.type === 'customer' ? 'Cliente' : 'Ambos'}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {contacts.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">Nenhum contato cadastrado.</p>
                  <button onClick={() => { setShowContactModal(false); router.push('/contacts/new') }} className="text-teal-600 text-sm font-bold mt-2">Criar contato</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Tags</h3>
              <button onClick={() => { setShowTagModal(false); setShowCreateTagModal(true) }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {tags.map((tag) => {
                const isActive = selectedTags.includes(tag.id)
                return (
                  <button key={tag.id} onClick={() => toggleTag(tag.id)}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{tag.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {tags.length === 0 && <p className="text-center text-gray-400 mt-10">Nenhuma tag encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {showCreateCatModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowCreateCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Nova categoria</h3>
              <button onClick={() => setShowCreateCatModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nome da categoria" className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200" />
              <div><p className="text-sm text-gray-500 font-medium mb-3">Ícone</p><button onClick={() => setShowIconPicker(true)} className="flex items-center gap-3 bg-gray-100 dark:bg-slate-700 rounded-xl px-4 py-3 w-full text-left"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${newCatColor}20`, color: newCatColor }}>{(() => { const I = getDynamicIcon(newCatIcon); return <I size={18} /> })()}</div><span className="text-sm font-medium text-gray-800 dark:text-white flex-1">{newCatIcon}</span><ChevronDown size={16} className="text-gray-400" /></button></div>
              <div><p className="text-sm text-gray-500 font-medium mb-3">Cor</p><div className="flex flex-wrap gap-3">{CATEGORY_COLORS.map((c) => (<button key={c} onClick={() => setNewCatColor(c)} className={`w-10 h-10 rounded-full transition-transform ${newCatColor === c ? 'scale-125 border-4 border-white dark:border-slate-900 shadow-md' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />))}</div></div>
              <button onClick={handleSaveCategory} disabled={savingCategory || !newCatName.trim()} className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4 disabled:opacity-50 flex justify-center items-center">
                {savingCategory ? <Loader2 size={24} className="animate-spin" /> : 'Salvar categoria'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateAccModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowCreateAccModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Nova conta</h3>
              <button onClick={() => setShowCreateAccModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <input type="text" value={newAccName} onChange={(e) => setNewAccName(e.target.value)} placeholder="Nome da conta" className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200" />
              <div><p className="text-sm text-gray-500 font-medium mb-3">Cor</p><div className="flex flex-wrap gap-3">{CATEGORY_COLORS.map((c) => (<button key={c} onClick={() => setNewAccColor(c)} className={`w-10 h-10 rounded-full transition-transform ${newAccColor === c ? 'scale-125 border-4 border-white dark:border-slate-900 shadow-md' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />))}</div></div>
              <button onClick={handleSaveAccount} disabled={savingAccount || !newAccName.trim()} className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4 disabled:opacity-50 flex justify-center items-center">
                {savingAccount ? <Loader2 size={24} className="animate-spin" /> : 'Salvar conta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateTagModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowCreateTagModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Nova tag</h3>
              <button onClick={() => setShowCreateTagModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Nome da tag" className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200" />
              <div><p className="text-sm text-gray-500 font-medium mb-3">Cor</p><div className="flex flex-wrap gap-3">{CATEGORY_COLORS.map((c) => (<button key={c} onClick={() => setNewTagColor(c)} className={`w-10 h-10 rounded-full transition-transform ${newTagColor === c ? 'scale-125 border-4 border-white dark:border-slate-900 shadow-md' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />))}</div></div>
              <button onClick={handleSaveTag} disabled={savingTag || !newTagName.trim()} className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4 disabled:opacity-50 flex justify-center items-center">
                {savingTag ? <Loader2 size={24} className="animate-spin" /> : 'Salvar tag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustomRecurrenceModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowCustomRecurrenceModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Recorrência Personalizada</h3>
              <button onClick={() => setShowCustomRecurrenceModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Número de parcelas</label><input type="number" value={customParcels} onChange={(e) => setCustomParcels(Number(e.target.value))} className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200" min={1} max={120} /></div>
              <div><label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Intervalo (em meses)</label><input type="number" value={customInterval} onChange={(e) => setCustomInterval(Number(e.target.value))} className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200" min={1} max={24} /></div>
              <button onClick={() => setShowCustomRecurrenceModal(false)} className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewTransactionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-teal-700" size={40} /></div>}>
      <NewTransactionContent />
    </Suspense>
  )
}
