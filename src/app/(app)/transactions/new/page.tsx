'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import * as Icons from 'lucide-react'
import {
  ChevronLeft, Tag, Wallet, ChevronDown, ChevronUp, Check,
  Camera, Plus, ArrowRightLeft, Building, HandCoins, X,
  QrCode, ChevronRight, Trash2, Loader2, Paperclip,
  Image as ImageIcon, CreditCard, Calendar,
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

type TxType = 'income' | 'expense' | 'transfer'
type Context = 'dfl' | 'personal'
type Repetition = 'once' | 'installments' | 'recurring'
type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'custom'

const CATEGORY_COLORS = [
  '#22c55e', '#ef4444', '#f97316', '#06b6d4',
  '#8b5cf6', '#eab308', '#94a3b8', '#ec4899', '#14b8a6',
]

const getDynamicIcon = (iconName: string) => {
  if (!iconName) return Icons.Tag
  const formatted = iconName.charAt(0).toUpperCase() + iconName.slice(1)
  return (Icons as any)[formatted] || Icons.Tag
}

function createLocalDate(dateString: string): Date {
  return new Date(dateString + 'T12:00:00')
}

function NewTransactionContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { appMode } = useContext_()

  const galeriaInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<TxType>(
    (searchParams.get('type') as TxType) || 'expense'
  )
  const [context, setContext] = useState<Context>('dfl')
  const [amountNum, setAmountNum] = useState(0)
  const [amountFormatted, setAmountFormatted] = useState('0,00')
  const [isPaid, setIsPaid] = useState(true)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [desc, setDesc] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [creditCardId, setCreditCardId] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<Record<string, any[]>>({})
  const [accounts, setAccounts] = useState<any[]>([])
  const [creditCards, setCreditCards] = useState<any[]>([])
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

  const { isOnline, saveToQueue } = useOfflineQueue()

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

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  const loadData = useCallback(async () => {
    if (!user?.id) return
    const catType = type === 'income' ? 'income' : 'expense'

    const [{ data: cats }, { data: accs }, { data: tgs }, { data: budgetsData }, { data: cardsData }] =
      await Promise.all([
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
          .order('name'),
        supabase
          .from('budgets')
          .select('*')
          .match({ user_id: user.id, context }),
        supabase
          .from('credit_cards')
          .select('*')
          .eq('user_id', user.id)
          .eq('context', context)
          .eq('is_archived', false)
          .order('name'),
      ])

    const allCats = Array.isArray(cats) ? cats : []
    const mainCats = allCats.filter((c) => !c.parent_id)
    const subCats = allCats.filter((c) => c.parent_id)
    const subsMap: Record<string, any[]> = {}
    subCats.forEach((sub) => {
      if (!subsMap[sub.parent_id]) subsMap[sub.parent_id] = []
      subsMap[sub.parent_id].push(sub)
    })

    setCategories(mainCats)
    setSubcategories(subsMap)
    setAccounts(Array.isArray(accs) ? accs : [])
    setCreditCards(Array.isArray(cardsData) ? cardsData : [])
    setTags(Array.isArray(tgs) ? tgs : [])
    setBudgets(Array.isArray(budgetsData) ? budgetsData : [])
  }, [user, context, type])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!categoryId || amountNum <= 0 || type !== 'expense') {
      setBudgetAlert(null)
      return
    }
    const budget = budgets.find((b) => b.category_id === categoryId)
    if (!budget) { setBudgetAlert(null); return }
    if (!user?.id) return

    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    supabase
      .from('transactions')
      .select('amount')
      .match({ user_id: user.id, context, category_id: categoryId })
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
  }, [categoryId, amountNum, type, budgets, user, context])

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
          context,
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
    } catch {
      showToast('Erro ao criar categoria.', 'error')
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
        .insert({ user_id: user.id, name: newAccName.trim(), color: newAccColor, context })
        .select()
        .single()
      if (error) throw error
      setAccounts((prev) => [...prev, data])
      setAccountId(data.id)
      setShowCreateAccModal(false)
      setNewAccName('')
      showToast('Conta criada!', 'success')
    } catch {
      showToast('Erro ao criar conta.', 'error')
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
        .insert({ user_id: user.id, name: newTagName.trim(), color: newTagColor, context })
        .select()
        .single()
      if (error) throw error
      setTags((prev) => [...prev, data])
      setSelectedTags((prev) => (prev.length < 5 ? [...prev, data.id] : prev))
      setShowCreateTagModal(false)
      setNewTagName('')
      showToast('Tag criada!', 'success')
    } catch {
      showToast('Erro ao criar tag.', 'error')
    } finally {
      setSavingTag(false)
    }
  }

  const handleSave = async () => {
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
          .match({ user_id: user.id, context, category_id: categoryId })
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

      // Lógica de fatura do cartão
      let invoiceId: string | null = null

      if (type === 'expense' && creditCardId && !isRefund) {
        // Encontra ou cria fatura para o período da transação
        const txDate = new Date(date)
        const { data: cardData } = await supabase
          .from('credit_cards')
          .select('closing_day, due_day')
          .eq('id', creditCardId)
          .single()

        if (cardData) {
          // Calcula as datas da fatura baseado no dia de fechamento
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

          // Busca fatura aberta para este cartão e período
          const { data: existingInvoice } = await supabase
            .from('credit_invoices')
            .select('id')
            .eq('user_id', user.id)
            .eq('credit_card_id', creditCardId)
            .eq('status', 'open')
            .lte('start_date', date)
            .gte('end_date', date)
            .single()

          if (existingInvoice) {
            invoiceId = existingInvoice.id
          } else {
            // Cria nova fatura
            const { data: newInvoice, error: invoiceError } = await supabase
              .from('credit_invoices')
              .insert({
                user_id: user.id,
                credit_card_id: creditCardId,
                closing_date: closingDate.toISOString().split('T')[0],
                due_date: dueDate.toISOString().split('T')[0],
                start_date: startDate.toISOString().split('T')[0],
                end_date: closingDate.toISOString().split('T')[0],
                total_amount: 0,
                paid_amount: 0,
                status: 'open',
                context,
              })
              .select()
              .single()

            if (invoiceError) throw invoiceError
            invoiceId = newInvoice.id
          }

          // Atualiza o total da fatura
          // Atualiza o total da fatura
if (invoiceId) {
  const { data: currentInvoice } = await supabase
    .from('credit_invoices')
    .select('total_amount')
    .eq('id', invoiceId)
    .single()

  const newTotal = (Number(currentInvoice?.total_amount) || 0) + installmentAmount

  await supabase
    .from('credit_invoices')
    .update({
      total_amount: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
}
        }
      }

      // Atualiza saldo da conta (se for débito normal)
      if (isPaid && accountId && type !== 'transfer' && !creditCardId) {
        const { data: acc } = await supabase
          .from('accounts')
          .select('balance, allow_negative')
          .eq('id', accountId)
          .single()

        if (acc) {
          const currentBalance = Number(acc.balance) || 0
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
            if (!proceed) { setIsSubmitting(false); return }
          }

          const { error: updateError } = await supabase
            .from('accounts')
            .update({ balance: newBalance })
            .eq('id', accountId)

          if (updateError) throw updateError
        }
      }

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

        const payload: any = {
          user_id: user.id,
          type,
          amount: installmentAmount,
          description: desc || null,
          category_id: categoryId || null,
          account_id: creditCardId ? null : (accountId || null),
          credit_card_id: creditCardId || null,
          invoice_id: invoiceId,
          tag_ids: selectedTags.length > 0 ? selectedTags : null,
          date: installmentDate,
          status: creditCardId ? 'done' : (isPaid ? 'done' : 'pending'),
          context,
          receipt_url: i === 0 ? receiptUrl : null,
          recurring_group_id: recurringGroupId,
          installment_index: totalParcels > 1 ? i + 1 : 1,
          total_installments: totalParcels > 1 ? totalParcels : 1,
          financing_id: financingId,
          debt_id: debtId,
        }

        if (!isOnline) {
          await saveToQueue(payload)
          if (i === totalParcels - 1) {
            showToast('Salvo localmente. Será enviado quando houver conexão.', 'info')
            router.push('/transactions')
          }
          continue
        }

        const { error: insertError } = await supabase.from('transactions').insert(payload)
        if (insertError) throw insertError
      }

      showToast('Transação salva com sucesso!', 'success')
      router.refresh()
      router.push('/transactions')
    } catch (e: any) {
      console.error('Erro ao salvar:', e)
      showToast('Erro ao salvar transação.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const AttachmentIcon = () => {
    if (uploading) return <Loader2 size={20} className="animate-spin text-teal-600" />
    if (receiptUrl) {
      if (receiptType === 'pdf') return <Paperclip size={20} className="text-teal-600 dark:text-teal-400" />
      return <ImageIcon size={20} className="text-teal-600 dark:text-teal-400" />
    }
    return <Camera size={20} className="text-gray-700 dark:text-gray-300" />
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 font-sans text-gray-800 dark:text-gray-200 overflow-y-auto pb-32 transition-colors duration-300">

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

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2 sticky top-0 bg-slate-50 dark:bg-slate-900 z-40">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm"
        >
          <ChevronLeft size={22} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="font-bold text-base text-gray-800 dark:text-gray-100">
          {isIncome ? 'Nova Receita' : creditCardId ? 'Nova Compra no Cartão' : 'Nova Despesa'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQRScanner(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm"
          >
            <QrCode size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          <button
            onClick={() => !receiptUrl && setShowReceiptModal(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm"
          >
            <AttachmentIcon />
          </button>
        </div>
      </div>

      <ContextToggle />

      {/* ── Valor ── */}
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
          <div
            className={`mt-3 mx-6 p-3 rounded-xl text-xs font-bold ${
              budgetAlert.type === 'danger'
                ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
            }`}
          >
            {budgetAlert.message}
          </div>
        )}
      </div>

      {/* ── Preview do comprovante ── */}
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
                {receiptType === 'pdf'
                  ? <Paperclip size={22} className="text-teal-600 dark:text-teal-400" />
                  : <ImageIcon size={22} className="text-teal-600 dark:text-teal-400" />
                }
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{receiptName}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Comprovante anexado</p>
            </div>
            <button
              onClick={handleRemoveReceipt}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Campos principais ── */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl mx-4 shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-50 dark:border-slate-700">
          <span className="font-bold text-sm text-gray-700 dark:text-gray-300">
            {isIncome ? 'Recebido' : creditCardId ? 'Compra no cartão' : 'Pago'}
          </span>
          {!creditCardId && (
            <button
              onClick={() => setIsPaid(!isPaid)}
              className={`w-12 h-6 rounded-full transition-colors ${isPaid ? bgColor : 'bg-gray-200 dark:bg-gray-600'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          )}
        </div>

        {/* Seletor de Cartão de Crédito (apenas para despesas) */}
        {!isIncome && creditCards.length > 0 && (
          <button
            onClick={() => setShowCardModal(true)}
            className="w-full flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="flex items-center gap-4">
              <CreditCard size={20} className="text-gray-400 dark:text-gray-500" />
              <span className={`text-sm font-medium ${selectedCard ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                {selectedCard ? selectedCard.name : 'Cartão de crédito (opcional)'}
              </span>
            </div>
            {selectedCard && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setCreditCardId('')
                }}
                className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={16} />
              </div>
            )}
          </button>
        )}

        <button
          onClick={() => setShowCatModal(true)}
          className="w-full flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
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
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${selectedCat.color}20`, color: selectedCat.color }}
                >
                  <IconComp size={20} />
                </div>
              )
            })()}
            <div
              onClick={(e) => { e.stopPropagation(); setShowCreateCatModal(true) }}
              className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-full transition-colors"
            >
              <Plus size={20} />
            </div>
          </div>
        </button>

        {!creditCardId && (
          <button
            onClick={() => setShowAccModal(true)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="flex items-center gap-4">
              <Wallet size={20} className="text-gray-400 dark:text-gray-500" />
              <span className={`text-sm font-medium ${selectedAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                {selectedAcc ? selectedAcc.name : 'Conta'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedAcc && <BankLogo color={selectedAcc.color} name={selectedAcc.name} size="sm" />}
              <div
                onClick={(e) => { e.stopPropagation(); setShowCreateAccModal(true) }}
                className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-full transition-colors"
              >
                <Plus size={20} />
              </div>
            </div>
          </button>
        )}
      </div>

      {/* ── Mais detalhes ── */}
      <div className="mx-4 mt-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-teal-700 dark:text-teal-400 text-sm font-bold flex items-center gap-1 mx-auto py-2"
        >
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
            <input
              placeholder="Descrição"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-5 py-5 text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-50 dark:border-slate-700 outline-none bg-transparent"
            />

            <div className="px-5 py-5 border-b border-gray-50 dark:border-slate-700">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">Repetição</p>
              <div className="flex gap-2 mb-4">
                {[
                  { key: 'once', label: 'Única' },
                  { key: 'installments', label: 'Parcelar' },
                  { key: 'recurring', label: 'Recorrente' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setRepetition(opt.key as Repetition)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                      repetition === opt.key
                        ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700 dark:border-teal-500 text-teal-800 dark:text-teal-300'
                        : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {repetition === 'installments' && (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700 p-4 rounded-xl">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Parcelas</span>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                    className="bg-transparent text-sm font-bold outline-none text-gray-800 dark:text-gray-200"
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <option key={n} value={n}>{n}x</option>
                    ))}
                  </select>
                </div>
              )}

              {repetition === 'recurring' && (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'weekly', label: 'Semanal' },
                      { key: 'biweekly', label: 'Quinzenal' },
                      { key: 'monthly', label: 'Mensal' },
                      { key: 'bimonthly', label: 'Bimestral' },
                      { key: 'custom', label: 'Personalizar' },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => {
                          setFrequency(f.key as Frequency)
                          if (f.key === 'custom') setShowCustomRecurrenceModal(true)
                        }}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                          frequency === f.key
                            ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700 dark:border-teal-500 text-teal-800 dark:text-teal-300'
                            : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                        }`}
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

            <button
              onClick={() => setShowTagModal(true)}
              className="w-full flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
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
                    <ArrowRightLeft size={20} className="text-gray-400 dark:text-gray-500" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">É uma devolução / estorno</span>
                  </div>
                  <button
                    onClick={() => setIsRefund(!isRefund)}
                    className={`w-12 h-6 rounded-full transition-colors ${isRefund ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${isRefund ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowFinancingModal(true)}
                >
                  <div className="flex items-center gap-3">
                    <Building size={20} className="text-gray-400 dark:text-gray-500" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Financiamento</span>
                  </div>
                  <button className={`w-12 h-6 rounded-full transition-colors ${financingId ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${financingId ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowLoanModal(true)}
                >
                  <div className="flex items-center gap-3">
                    <HandCoins size={20} className="text-gray-400 dark:text-gray-500" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Empréstimo a alguém</span>
                  </div>
                  <button className={`w-12 h-6 rounded-full transition-colors ${debtId ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${debtId ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Botão salvar ── */}
      <div className="fixed bottom-8 w-full flex justify-center z-40 pointer-events-none">
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          className={`pointer-events-auto w-16 h-16 ${bgColor} rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform`}
        >
          {isSubmitting
            ? <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" />
            : <Check size={30} className="text-white" />
          }
        </button>
      </div>

      {/* ── Modal Cartões ── */}
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
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: card.color || '#f97316' }}>
                      <CreditCard size={20} />
                    </div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                      {card.name}
                    </span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {creditCards.length === 0 && (
                <p className="text-center text-gray-400 mt-10">Nenhum cartão cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Demais modais (mantidos originais) ── */}
      {showCustomRecurrenceModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowCustomRecurrenceModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Recorrência Personalizada</h3>
              <button onClick={() => setShowCustomRecurrenceModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Número de parcelas</label>
                <input type="number" value={customParcels} onChange={(e) => setCustomParcels(Number(e.target.value))} className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200" min={1} max={120} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Intervalo (em meses)</label>
                <input type="number" value={customInterval} onChange={(e) => setCustomInterval(Number(e.target.value))} className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl outline-none font-medium text-gray-800 dark:text-gray-200" min={1} max={24} />
              </div>
              <button onClick={() => setShowCustomRecurrenceModal(false)} className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4">Confirmar</button>
            </div>
          </div>
        </div>
      )}

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
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
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
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Subcategorias</h3>
                <p className="text-xs text-gray-500">{selectedParentCat.name}</p>
              </div>
            </div>
            <div className="space-y-2">
              {(subcategories[selectedParentCat.id] || []).map((sub: any) => {
                const SubIcon = getDynamicIcon(sub.icon)
                const isActive = sub.id === categoryId
                return (
                  <button key={sub.id} onClick={() => { setCategoryId(sub.id); setShowSubCatModal(false); setShowCatModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
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
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
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
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
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
              <div>
                <p className="text-sm text-gray-500 font-medium mb-3">Ícone</p>
                <button onClick={() => setShowIconPicker(true)} className="flex items-center gap-3 bg-gray-100 dark:bg-slate-700 rounded-xl px-4 py-3 w-full text-left">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${newCatColor}20`, color: newCatColor }}>
                    {(() => { const I = getDynamicIcon(newCatIcon); return <I size={18} /> })()}
                  </div>
                  <span className="text-sm font-medium text-gray-800 dark:text-white flex-1">{newCatIcon}</span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_COLORS.map((c) => (
                    <button key={c} onClick={() => setNewCatColor(c)}
                      className={`w-10 h-10 rounded-full transition-transform ${newCatColor === c ? 'scale-125 border-4 border-white dark:border-slate-900 shadow-md' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button onClick={handleSaveCategory} disabled={savingCategory || !newCatName.trim()} className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4 disabled:opacity-50 flex justify-center items-center">
                {savingCategory ? <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" /> : 'Salvar categoria'}
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
              <div>
                <p className="text-sm text-gray-500 font-medium mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_COLORS.map((c) => (
                    <button key={c} onClick={() => setNewAccColor(c)}
                      className={`w-10 h-10 rounded-full transition-transform ${newAccColor === c ? 'scale-125 border-4 border-white dark:border-slate-900 shadow-md' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button onClick={handleSaveAccount} disabled={savingAccount || !newAccName.trim()} className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4 disabled:opacity-50 flex justify-center items-center">
                {savingAccount ? <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" /> : 'Salvar conta'}
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
              <div>
                <p className="text-sm text-gray-500 font-medium mb-3">Cor</p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_COLORS.map((c) => (
                    <button key={c} onClick={() => setNewTagColor(c)}
                      className={`w-10 h-10 rounded-full transition-transform ${newTagColor === c ? 'scale-125 border-4 border-white dark:border-slate-900 shadow-md' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button onClick={handleSaveTag} disabled={savingTag || !newTagName.trim()} className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold mt-4 disabled:opacity-50 flex justify-center items-center">
                {savingTag ? <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" /> : 'Salvar tag'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        onOptionSelect={handleReceiptOption}
      />
      <CameraCapture
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
      {showQRScanner && (
        <QRCodeScanner onClose={() => setShowQRScanner(false)} onResult={handleQRResult} />
      )}
      <IconPicker
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        selectedIcon={newCatIcon}
        onSelect={setNewCatIcon}
      />
      <ModalFinancing
        isOpen={showFinancingModal}
        onClose={() => setShowFinancingModal(false)}
        onSave={(id) => setFinancingId(id)}
      />
      <ModalEmprestimo
        isOpen={showLoanModal}
        onClose={() => setShowLoanModal(false)}
        onSave={(id) => setDebtId(id)}
      />
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