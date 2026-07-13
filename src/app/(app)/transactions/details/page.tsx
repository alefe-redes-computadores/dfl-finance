'use client'

import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import {
  ChevronLeft, Copy, Trash2, Calendar, Edit3, Tag, Wallet, RefreshCw, Check, Loader2,
  ChevronRight, ArrowRightLeft, Building, HandCoins, Plus, X, Camera, QrCode, Paperclip,
  Image as ImageIcon, CreditCard, ChevronUp, ChevronDown, Users, Layers, FileText,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ReceiptModal from '@/components/ReceiptModal'
import CameraCapture from '@/components/CameraCapture'
import QRCodeScanner from '@/components/QRCodeScanner'
import ModalFinancing from '@/components/ModalFinancing'
import ModalEmprestimo from '@/components/ModalEmprestimo'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'
import { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { db } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'
import Skeleton from '@/components/Skeleton'

const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

const TransactionSkeleton = () => (
  <div className="animate-pulse px-4 pt-6 space-y-5">
    <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
      <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-10 w-48 bg-gray-200 dark:bg-slate-700 rounded" />
    </div>
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] p-4 flex items-center gap-4 border border-gray-50 dark:border-slate-700/50">
          <div className="w-10 h-10 rounded-[14px] bg-gray-200 dark:bg-slate-700" />
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  </div>
)

function EditTransactionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const { user } = useAuth()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const { showToast } = useToast()
  const { vibrate, success, error: hapticError } = useHapticFeedback()

  const { safeAdd, safeUpdate, safeDelete } = useSafeDb()

  const galeriaInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tx, setTx] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)

  const [accounts, setAccounts] = useState<any[]>([])
  const [localCategories, setLocalCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<Record<string, any[]>>({})
  const [tags, setTags] = useState<any[]>([])
  const [creditCards, setCreditCards] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])

  const [amountInput, setAmountInput] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [creditCardId, setCreditCardId] = useState('')
  const [contactId, setContactId] = useState('')
  const [txType, setTxType] = useState<'income' | 'expense'>('expense')

  const [showDetails, setShowDetails] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isRefund, setIsRefund] = useState(false)
  const [isReimbursable, setIsReimbursable] = useState(false)

  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptName, setReceiptName] = useState<string>('')
  const [receiptType, setReceiptType] = useState<'image' | 'pdf' | null>(null)
  const [uploading, setUploading] = useState(false)

  const [financingId, setFinancingId] = useState<string | null>(null)
  const [debtId, setDebtId] = useState<string | null>(null)

  const [showCatModal, setShowCatModal] = useState(false)
  const [showSubCatModal, setShowSubCatModal] = useState(false)
  const [selectedParentCat, setSelectedParentCat] = useState<any>(null)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showCardModal, setShowCardModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [showFinancingModal, setShowFinancingModal] = useState(false)
  const [showLoanModal, setShowLoanModal] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const categories = useMemo(() => {
    return (localCategories || []).sort((a: any, b: any) => {
      const orderA = a.order_index ?? 9999
      const orderB = b.order_index ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [localCategories])

  const handleDateChange = (newDateStr: string) => {
    setDate(newDateStr)
    const selected = new Date(newDateStr + 'T12:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selected.setHours(0, 0, 0, 0)
    setIsPaid(selected <= today)
  }

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
      showToast('✅ Comprovante anexado!', 'success')
      success()

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
                const confirmed = confirm(`Deseja anexar este comprovante a despesa "${tx.description}" existente?`)
                if (confirmed) {
                  await safeUpdate('transactions', tx.id, { receipt_url: urlData.publicUrl })
                  showToast('✅ Comprovante vinculado!', 'success')
                  vibrate([50])
                  return
                }
              }
            }

            if (ocrData.data.amount > 0) setAmountInput(ocrData.data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
            if (ocrData.data.date) setDate(ocrData.data.date)
            if (ocrData.data.description) setDescription(ocrData.data.description)
            if (ocrData.data.suggested_category) {
              const matchedCat = categories.find((c: any) => c.name.toLowerCase() === ocrData.data.suggested_category.toLowerCase())
              if (matchedCat) setCategoryId(matchedCat.id)
            }
            vibrate([50, 100, 50])
            showToast('✅ Dados extraídos com sucesso!', 'success')
          }
        } catch (ocrError) {
          console.error('Erro OCR:', ocrError)
        }
      }
    } catch (err: any) {
      showToast(`❌ Erro ao anexar: ${err.message}`, 'error')
      hapticError()
      setReceiptPreview(null)
      setReceiptName('')
      setReceiptType(null)
    } finally {
      setUploading(false)
    }
  }

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
      const [accData, catData, tagData, cardsData, contactsData] = await Promise.all([
        db.table('accounts').where('user_id').equals(user.id).toArray(),
        db.table('categories').where('user_id').equals(user.id).toArray(),
        db.table('tags').where('user_id').equals(user.id).toArray(),
        db.table('credit_cards').where('user_id').equals(user.id).toArray(),
        db.table('contacts').where('user_id').equals(user.id).toArray(),
      ])

      setAccounts(accData.filter((a: any) => a.context === effectiveContext))
      setCreditCards(cardsData.filter((c: any) => c.context === effectiveContext))
      setContacts(contactsData.filter((c: any) => c.context === effectiveContext))
      setTags(tagData.filter((t: any) => t.context === effectiveContext))

      const isEditMode = id && id !== 'new' && typeof id === 'string' && id.length > 5
      let currentTxType = 'expense'

      if (isEditMode) {
        let txData = await db.table('transactions').get(id as string)

        if (!txData) {
          const { data: remoteTx } = await supabase.from('transactions').select('*').eq('id', id).single()
          if (remoteTx) txData = remoteTx
        }

        if (txData && txData.user_id === user.id) {
          setTx(txData)
          setTxType(txData.type)
          currentTxType = txData.type
          setIsNew(false)
          setIsPaid(txData.status === 'done')
          setDate(txData.date)
          setDescription(txData.description || '')
          setNotes(txData.notes || '')
          setCategoryId(txData.category_id || '')
          setAccountId(txData.account_id || '')
          setCreditCardId(txData.credit_card_id || '')
          setContactId(txData.contact_id || '')
          setSelectedTags(Array.isArray(txData.tag_ids) ? txData.tag_ids : [])
          setIsReimbursable(txData.is_reimbursable || false)

          const amountSafe = Number(txData.amount) || 0
          setAmountInput(amountSafe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

          if (txData.receipt_url) {
            setReceiptUrl(txData.receipt_url)
            const isPdf = txData.receipt_url.toLowerCase().includes('.pdf')
            setReceiptType(isPdf ? 'pdf' : 'image')
            setReceiptName(isPdf ? 'comprovante.pdf' : 'comprovante.jpg')
            if (!isPdf) setReceiptPreview(txData.receipt_url)
          }

          if (txData.financing_id) setFinancingId(txData.financing_id)
          if (txData.debt_id) setDebtId(txData.debt_id)
          if (txData.notes?.includes('[Devolução/Estorno]')) setIsRefund(true)
        }
      } else {
        setIsNew(true)
        const paramType = searchParams.get('type')
        if (paramType === 'income') {
          setTxType('income')
          currentTxType = 'income'
          setIsPaid(true)
        } else {
          setTxType('expense')
          currentTxType = 'expense'
          setIsPaid(false)
        }
      }

      // Filtra as categorias com base no tipo final (entrada ou saída)
      const allCats = catData.filter((c: any) => c.context === effectiveContext && c.type === currentTxType)
      const mainCats = allCats.filter((c: any) => !c.parent_id)
      const subCats = allCats.filter((c: any) => c.parent_id)
      const subsMap: Record<string, any[]> = {}
      subCats.forEach((sub: any) => {
        if (!subsMap[sub.parent_id]) subsMap[sub.parent_id] = []
        subsMap[sub.parent_id].push(sub)
      })
      setLocalCategories(mainCats)
      setSubcategories(subsMap)

    } catch (err) {
      console.error('Erro:', err)
      showToast('❌ Erro ao carregar a transação.', 'error')
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [id, user, effectiveContext, searchParams])

  useEffect(() => { loadData() }, [loadData])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    const num = Number(raw) / 100
    setAmountInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const toggleTag = useCallback((tagId: string) => {
    vibrate([10])
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) return prev.filter((t) => t !== tagId)
      if (prev.length >= 5) return prev
      return [...prev, tagId]
    })
  }, [vibrate])

  const handleSave = useCallback(async () => {
    if (!user?.id) { showToast('❌ Sessão expirada.', 'error'); return }
    setSaving(true)

    const rawAmount = parseFloat(amountInput.replace(/\./g, '').replace(',', '.'))
    if (isNaN(rawAmount) || rawAmount <= 0) {
      hapticError()
      showToast('⚠️ Informe um valor válido.', 'warning')
      setSaving(false)
      return
    }

    const selectedCat = categories.find((c) => c.id === categoryId) || Object.values(subcategories).flat().find((s: any) => s.id === categoryId)
    const finalDescription = description.trim() || selectedCat?.name || 'Transação sem nome'

    let finalNotes = notes
    if (txType === 'expense') {
      const flags = []
      if (isRefund) flags.push('[Devolução/Estorno]')
      if (financingId) flags.push('[Financiamento]')
      if (debtId) flags.push('[Empréstimo]')
      if (flags.length > 0) finalNotes = `${flags.join(' ')} ${finalNotes}`.trim()
    }

    const payload: any = {
      user_id: user.id,
      amount: rawAmount,
      status: creditCardId ? 'done' : (isPaid ? 'done' : 'pending'),
      date,
      description: finalDescription,
      category_id: categoryId || null,
      account_id: creditCardId ? null : (accountId || null),
      credit_card_id: creditCardId || null,
      contact_id: contactId || null,
      tag_ids: selectedTags.length > 0 ? selectedTags : null,
      notes: finalNotes || null,
      type: txType,
      receipt_url: receiptUrl,
      financing_id: financingId,
      debt_id: debtId,
      is_reimbursable: isReimbursable,
      updated_at: new Date().toISOString(),
    }

    try {
      await db.transaction('rw', db.accounts, db.transactions, db.syncQueue, async () => {
        if (!isNew && tx?.status === 'done' && tx?.account_id) {
          const oldAcc = await db.table('accounts').get(tx.account_id)
          if (oldAcc) {
            const revertedBalance = tx.type === 'income' ? safeNum(oldAcc.balance) - safeNum(tx.amount) : safeNum(oldAcc.balance) + safeNum(tx.amount)
            await safeUpdate('accounts', tx.account_id, { balance: revertedBalance })
          }
        }

        if (isPaid && accountId && !creditCardId) {
          const newAcc = await db.table('accounts').get(accountId)
          if (newAcc) {
            const updatedBalance = txType === 'income' ? safeNum(newAcc.balance) + rawAmount : safeNum(newAcc.balance) - rawAmount
            await safeUpdate('accounts', accountId, { balance: updatedBalance })
          }
        }

        if (isNew) {
          const txId = crypto.randomUUID()
          const fullPayload = { id: txId, ...payload, created_at: new Date().toISOString(), sync_status: 'pending', sync_attempts: 0 }
          await safeAdd('transactions', fullPayload)

          if (isReimbursable) {
            const otherContext = effectiveContext === 'dfl' ? 'personal' : 'dfl'
            const reimbTxId = crypto.randomUUID()
            await safeAdd('transactions', {
              id: reimbTxId, user_id: user.id, type: txType === 'expense' ? 'income' : 'expense', amount: rawAmount,
              description: `Reembolso: ${finalDescription}`, date, status: 'pending', context: otherContext,
              category_id: null, linked_transaction_id: txId, is_reimbursable: true,
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: 'pending', sync_attempts: 0,
            })
            await safeUpdate('transactions', txId, { linked_transaction_id: reimbTxId })
          }
        } else {
          await safeUpdate('transactions', id as string, payload)

          if (isReimbursable && !tx?.is_reimbursable) {
            const otherContext = effectiveContext === 'dfl' ? 'personal' : 'dfl'
            const reimbTxId = crypto.randomUUID()
            await safeAdd('transactions', {
              id: reimbTxId, user_id: user.id, type: txType === 'expense' ? 'income' : 'expense', amount: rawAmount,
              description: `Reembolso: ${finalDescription}`, date, status: 'pending', context: otherContext,
              category_id: null, linked_transaction_id: id, is_reimbursable: true,
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: 'pending', sync_attempts: 0,
            })
            await safeUpdate('transactions', id as string, { linked_transaction_id: reimbTxId })
          }
        }
      })

      vibrate([10, 50])
      setSaved(true)
      showToast('✅ Transação salva!', 'success')
      setTimeout(() => { router.refresh(); router.back() }, 800)
    } catch (err: any) {
      hapticError()
      showToast(`❌ Erro ao salvar: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }, [user, amountInput, categoryId, subcategories, description, notes, isRefund, financingId, debtId, txType, creditCardId, isPaid, accountId, contactId, selectedTags, receiptUrl, isReimbursable, isNew, tx, effectiveContext, vibrate, showToast, router, safeAdd, safeUpdate, id, hapticError, categories])

  const hasInstallments = tx?.recurring_group_id && tx?.total_installments && tx.total_installments > 1

  const confirmDelete = async (mode: 'single' | 'future' | 'all') => {
    if (!user?.id) return
    setSaving(true)
    setShowDeleteModal(false)

    try {
      let idsToDelete: string[] = []

      if (mode === 'single' || !hasInstallments) {
        idsToDelete = [id as string]
      } else if (mode === 'future' && tx?.recurring_group_id) {
        const futureTxs = await db.table('transactions').where('recurring_group_id').equals(tx.recurring_group_id).and((t: any) => t.date >= tx.date).toArray()
        idsToDelete = futureTxs.map((t: any) => t.id)
      } else if (mode === 'all' && tx?.recurring_group_id) {
        const allTxs = await db.table('transactions').where('recurring_group_id').equals(tx.recurring_group_id).toArray()
        idsToDelete = allTxs.map((t: any) => t.id)
      }

      await db.transaction('rw', db.accounts, db.transactions, db.syncQueue, async () => {
        for (const txId of idsToDelete) {
          const txRecord = await db.table('transactions').get(txId)
          if (!txRecord) continue

          if (txRecord.status === 'done' && txRecord.account_id) {
            const acc = await db.table('accounts').get(txRecord.account_id)
            if (acc) {
              const newBalance = txRecord.type === 'income' ? safeNum(acc.balance) - safeNum(txRecord.amount) : safeNum(acc.balance) + safeNum(txRecord.amount)
              await safeUpdate('accounts', txRecord.account_id, { balance: newBalance })
            }
          }
          await safeDelete('transactions', txId)
        }
      })

      success()
      showToast('🗑️ Transação excluída com sucesso.', 'success')
      router.refresh()
      router.back()
    } catch (err: any) {
      hapticError()
      showToast(`❌ Erro ao excluir: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8f9fa] dark:bg-slate-900 transition-colors">
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
        </div>
        <TransactionSkeleton />
      </div>
    )
  }

  const isIncome = txType === 'income'
  const colorClass = isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-500'
  const headerGradient = isIncome
    ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
    : 'bg-red-50/50 dark:bg-red-950/20'
  const toggleBgClass = isPaid ? (isIncome ? 'bg-emerald-500' : 'bg-teal-600') : 'bg-gray-200 dark:bg-slate-700'
  const toggleTracks = isPaid ? 'translate-x-7' : 'translate-x-1'

  const selectedCat = categories.find((c) => c.id === categoryId) || Object.values(subcategories).flat().find((s: any) => s.id === categoryId)
  const selectedAcc = (accounts || []).find((a) => a.id === accountId)
  const selectedCard = (creditCards || []).find((c) => c.id === creditCardId)
  const selectedContact = (contacts || []).find((c) => c.id === contactId)

  const isParcelado = tx?.recurring_group_id && tx?.total_installments && tx.total_installments > 1
  const parcelaLabel = isParcelado ? `${tx.installment_index || 1}/${tx.total_installments}` : null

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 font-sans pb-32 relative transition-colors duration-300">
      <input ref={galeriaInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }} />
      <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }} />

      {/* Header Fixo e Transparente */}
      <div className={`sticky top-0 z-30 ${headerGradient} bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 pt-6 pb-4 border-b border-gray-100 dark:border-slate-800 transition-colors`}>
        <div className="flex items-center justify-between">
          <button onClick={() => { vibrate([5]); router.back() }} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 active:scale-95 transition-transform">
            <ChevronLeft size={24} />
          </button>
          <div className="text-center">
            <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100 capitalize">
              {isNew ? `Nova ${isIncome ? 'Receita' : 'Despesa'}` : `Editar ${isIncome ? 'Receita' : 'Despesa'}`}
            </h1>
            {parcelaLabel && (
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full mt-1 inline-block shadow-sm border border-gray-100 dark:border-slate-700">
                Parcela {parcelaLabel}
              </span>
            )}
          </div>
          <div className="w-10 flex justify-end">
            {!isNew && <button onClick={() => { vibrate([10]); hasInstallments ? setShowDeleteModal(true) : confirmDelete('single') }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors active:scale-95"><Trash2 size={20} /></button>}
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Input de Valor Gigante */}
        <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 flex flex-col items-center">
          <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Valor da transação</label>
          <div className="flex items-center gap-2 justify-center w-full mt-2">
            <span className={`text-[20px] font-medium ${isIncome ? 'text-emerald-300' : 'text-red-300'}`}>R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={handleAmountChange}
              className={`bg-transparent outline-none text-center text-[44px] font-black tracking-tight w-full max-w-[200px] ${colorClass} placeholder:text-gray-300 dark:placeholder:text-gray-700`}
              placeholder="0,00"
              autoFocus={isNew}
            />
          </div>
        </div>

        {/* Status (Pago / Pendente) */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-colors duration-300 ${isPaid ? (isIncome ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' : 'bg-teal-50 dark:bg-teal-500/10 text-teal-600') : 'bg-gray-50 dark:bg-slate-700 text-gray-400'}`}>
              <Check size={20} />
            </div>
            <span className="font-bold text-[15px] text-gray-800 dark:text-gray-200">
              {isIncome ? 'Recebido' : creditCardId ? 'Lançado no cartão' : 'Pago'}
            </span>
          </div>
          {!creditCardId && (
            <button
              onClick={() => { vibrate([5]); setIsPaid(!isPaid); }}
              className={`w-14 h-8 rounded-full relative transition-all duration-300 shadow-inner ${toggleBgClass} active:scale-95`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${toggleTracks}`} />
            </button>
          )}
        </div>

        {/* Descrição */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center text-gray-400 shrink-0">
            <Edit3 size={18} />
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={selectedCat ? selectedCat.name : 'Nome da transação'}
            className="flex-1 text-[15px] font-bold bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
          />
        </div>

        {/* Data */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center text-gray-400 shrink-0">
            <Calendar size={18} />
          </div>
          <input type="date" value={date} onChange={(e) => { vibrate([5]); handleDateChange(e.target.value); }} className="flex-1 text-[15px] font-bold bg-transparent outline-none text-gray-800 dark:text-gray-200" />
        </div>

        {/* Categoria */}
        <button onClick={() => { vibrate([5]); setShowCatModal(true); }} className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            {selectedCat ? (() => {
              const IconComp = getDynamicIcon(selectedCat.icon)
              return (
                <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${selectedCat.color}20`, color: selectedCat.color }}>
                  <IconComp size={18} />
                </div>
              )
            })() : (
              <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center text-gray-400"><Tag size={18} /></div>
            )}
            <div className="text-left">
              <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Categoria</span>
              <span className={`text-[15px] font-bold ${selectedCat ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                {selectedCat ? selectedCat.name : 'Selecionar'}
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
        </button>

        {/* Conta */}
        {!creditCardId && (
          <button onClick={() => { vibrate([5]); setShowAccModal(true); }} className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center text-gray-400"><Wallet size={18} /></div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Conta</span>
                <span className={`text-[15px] font-bold ${selectedAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                  {selectedAcc ? selectedAcc.name : 'Selecionar'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedAcc && <BankLogo color={selectedAcc.color} name={selectedAcc.name} size="sm" />}
              <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
            </div>
          </button>
        )}

        {/* Cartão de Crédito */}
        {!isIncome && (creditCards || []).length > 0 && (
          <button onClick={() => { vibrate([5]); setShowCardModal(true); }} className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center ${selectedCard ? 'text-white' : 'bg-gray-50 dark:bg-slate-700/50 text-gray-400'}`} style={selectedCard ? { backgroundColor: selectedCard.color || '#f97316' } : {}}>
                <CreditCard size={18} />
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Cartão de Crédito (Op.)</span>
                <span className={`text-[15px] font-bold ${selectedCard ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                  {selectedCard ? selectedCard.name : 'Nenhum'}
                </span>
              </div>
            </div>
            {selectedCard ? (
              <div onClick={(e) => { e.stopPropagation(); vibrate([10]); setCreditCardId(''); }} className="p-2 -mr-2 text-gray-300 hover:text-red-500 bg-gray-50 dark:bg-slate-700/50 rounded-full"><X size={14} /></div>
            ) : <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />}
          </button>
        )}

        {/* Fornecedor / Cliente */}
        {(contacts || []).length > 0 && (
          <button onClick={() => { vibrate([5]); setShowContactModal(true); }} className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center text-gray-400">
                <Users size={18} />
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Fornecedor / Cliente (Op.)</span>
                <span className={`text-[15px] font-bold ${selectedContact ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                  {selectedContact ? selectedContact.name : 'Nenhum'}
                </span>
              </div>
            </div>
            {selectedContact ? (
              <div onClick={(e) => { e.stopPropagation(); vibrate([10]); setContactId(''); }} className="p-2 -mr-2 text-gray-300 hover:text-red-500 bg-gray-50 dark:bg-slate-700/50 rounded-full"><X size={14} /></div>
            ) : <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />}
          </button>
        )}

        {/* Comprovante */}
        {uploading ? (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
               <Loader2 size={18} className="animate-spin text-teal-600" />
            </div>
            <span className="text-[14px] font-bold text-gray-500">Enviando comprovante...</span>
          </div>
        ) : receiptUrl ? (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {receiptPreview ? (
                <div className="w-12 h-12 rounded-[16px] overflow-hidden bg-gray-100 dark:bg-slate-700 shrink-0 border border-gray-200 dark:border-slate-600">
                  <img src={receiptPreview} alt="Comprovante" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 ${receiptType === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                  {receiptType === 'pdf' ? <Paperclip size={20} /> : <ImageIcon size={20} />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate">{receiptName || 'Comprovante anexado'}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Arquivo salvo</p>
              </div>
            </div>
            <button onClick={() => { vibrate([10]); handleRemoveReceipt(); }} className="p-2.5 bg-gray-50 dark:bg-slate-700/50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-full active:scale-95 transition-all"><Trash2 size={16} /></button>
          </div>
        ) : (
          <button onClick={() => { vibrate([5]); setShowReceiptModal(true); }} className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-dashed border-gray-300 dark:border-slate-600 flex items-center gap-3 text-gray-400 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/50 transition-all active:scale-[0.98]">
            <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center shrink-0">
              <Camera size={18} />
            </div>
            <span className="text-[14px] font-bold">Anexar comprovante / Ler imagem</span>
          </button>
        )}

        {/* Mais Detalhes (Accordion) */}
        <button
          onClick={() => { vibrate([5]); setShowDetails(!showDetails); }}
          className="text-teal-600 dark:text-teal-400 text-[13px] font-bold flex items-center justify-center gap-1.5 mx-auto py-3 px-6 bg-teal-50 dark:bg-teal-900/10 rounded-full active:scale-95 transition-transform"
        >
          {showDetails ? 'Ocultar opções avançadas' : 'Mais opções (Tags, Reembolso...)'}
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showDetails ? 'max-h-[1000px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-start gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center text-gray-400 shrink-0 mt-0.5">
                 <FileText size={18} />
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais..."
                rows={2}
                className="flex-1 text-[14px] font-medium bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 resize-none py-2"
              />
            </div>

            <button onClick={() => { vibrate([5]); setShowTagModal(true); }} className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center text-gray-400 shrink-0">
                  <Tag size={18} />
                </div>
                <div className="text-left">
                  <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Tags</span>
                  <span className={`text-[14px] font-bold ${selectedTags.length > 0 ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                    {selectedTags.length > 0 ? `${selectedTags.length} tag(s) selecionada(s)` : 'Nenhuma tag'}
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
            </button>

            {!isIncome && (
              <>
                <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <RefreshCw size={18} className="text-orange-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">Reembolsável</span>
                      <span className="text-[11px] font-medium text-gray-400">Gasto será devolvido por PF/PJ</span>
                    </div>
                  </div>
                  <button onClick={() => { vibrate([5]); setIsReimbursable(!isReimbursable); }} className={`w-14 h-8 rounded-full relative transition-all duration-300 shadow-inner ${isReimbursable ? 'bg-orange-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-sm ${isReimbursable ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <ArrowRightLeft size={18} className="text-blue-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">Estorno / Devolução</span>
                      <span className="text-[11px] font-medium text-gray-400">Marcar no extrato</span>
                    </div>
                  </div>
                  <button onClick={() => { vibrate([5]); setIsRefund(!isRefund); }} className={`w-14 h-8 rounded-full relative transition-all duration-300 shadow-inner ${isRefund ? 'bg-blue-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-sm ${isRefund ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <button onClick={() => { vibrate([5]); setShowFinancingModal(true); }} className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                      <Building size={18} className="text-purple-500" />
                    </div>
                    <div className="text-left">
                       <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Financiamento (Op.)</span>
                       <span className={`text-[14px] font-bold ${financingId ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>{financingId ? 'Vinculado' : 'Nenhum'}</span>
                    </div>
                  </div>
                  {financingId ? (
                    <div onClick={(e) => { e.stopPropagation(); vibrate([10]); setFinancingId(null); }} className="p-2 -mr-2 text-gray-300 hover:text-red-500 bg-gray-50 dark:bg-slate-700/50 rounded-full"><X size={14} /></div>
                  ) : <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />}
                </button>

                <button onClick={() => { vibrate([5]); setShowLoanModal(true); }} className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <HandCoins size={18} className="text-amber-500" />
                    </div>
                    <div className="text-left">
                       <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Empréstimo (Op.)</span>
                       <span className={`text-[14px] font-bold ${debtId ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>{debtId ? 'Vinculado' : 'Nenhum'}</span>
                    </div>
                  </div>
                  {debtId ? (
                    <div onClick={(e) => { e.stopPropagation(); vibrate([10]); setDebtId(null); }} className="p-2 -mr-2 text-gray-300 hover:text-red-500 bg-gray-50 dark:bg-slate-700/50 rounded-full"><X size={14} /></div>
                  ) : <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FAB de Salvar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[80px] flex justify-center z-40 pointer-events-none">
        <button
          onClick={() => { vibrate([10, 50]); handleSave(); }}
          disabled={saving || saved}
          className={`w-[68px] h-[68px] rounded-full flex items-center justify-center text-white shadow-[0_8px_30px_rgba(0,0,0,0.2)] pointer-events-auto transition-all duration-300 ${
            saved ? 'bg-emerald-500 scale-110' : 'bg-teal-600 hover:bg-teal-700 active:scale-90 shadow-teal-600/40'
          }`}
        >
          {saving ? <Loader2 className="animate-spin" size={30} /> : <Check size={32} className={saved ? 'animate-in zoom-in duration-300' : ''} />}
        </button>
      </div>

      {/* Modal Deletar - Bottom Sheet */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowDeleteModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Excluir transação</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2.5 rounded-full active:scale-95"><X size={20} /></button>
            </div>
            <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              Esta transação faz parte de um parcelamento de <strong>{tx?.total_installments} vezes</strong>. Como deseja prosseguir?
            </p>
            <div className="space-y-3 pb-6">
              <button onClick={() => { vibrate([10]); confirmDelete('single'); }} className="w-full p-4 bg-gray-50 dark:bg-slate-700/50 rounded-[20px] text-left hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors active:scale-[0.98]">
                <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">Apenas esta parcela</p>
                <p className="text-[12px] font-medium text-gray-500 mt-0.5">As demais continuam existindo.</p>
              </button>
              <button onClick={() => { vibrate([10]); confirmDelete('future'); }} className="w-full p-4 bg-orange-50 dark:bg-orange-900/20 rounded-[20px] text-left hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors active:scale-[0.98]">
                <p className="font-bold text-[15px] text-orange-600 dark:text-orange-400">Esta e as próximas</p>
                <p className="text-[12px] font-medium text-orange-600/70 dark:text-orange-400/70 mt-0.5">Exclui o que falta pagar do grupo.</p>
              </button>
              <button onClick={() => { vibrate([10, 50]); confirmDelete('all'); }} className="w-full p-4 bg-red-50 dark:bg-red-900/20 rounded-[20px] text-left hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors active:scale-[0.98]">
                <p className="font-bold text-[15px] text-red-600 dark:text-red-400">Todas as parcelas</p>
                <p className="text-[12px] font-medium text-red-600/70 dark:text-red-400/70 mt-0.5">Apaga completamente todas as parcelas.</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outros Modais Inalterados */}
      {showReceiptModal && <ReceiptModal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} onOptionSelect={handleReceiptOption} />}
      {showCamera && <CameraCapture isOpen={showCamera} onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />}
      {showFinancingModal && <ModalFinancing isOpen={showFinancingModal} onClose={() => setShowFinancingModal(false)} onSave={(id) => setFinancingId(id)} />}
      {showLoanModal && <ModalEmprestimo isOpen={showLoanModal} onClose={() => setShowLoanModal(false)} onSave={(id) => setDebtId(id)} />}

      {/* Modal Categorias */}
      {showCatModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowCatModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Categorias</h3>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>
            <div className="space-y-2 pb-6">
              {categories.map((cat) => {
                const IconComp = getDynamicIcon(cat.icon)
                const subCount = subcategories[cat.id]?.length || 0
                const isActive = cat.id === categoryId
                return (
                  <button key={cat.id} onClick={() => { vibrate([5]); setCategoryId(cat.id); setSelectedParentCat(cat); subCount > 0 ? setShowSubCatModal(true) : setShowCatModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent'}`}>
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}><IconComp size={22} /></div>
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
                    {subCount > 0 && <span className="text-[12px] text-gray-400 font-bold mr-2">{subCount}</span>}
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                    {subCount > 0 && <ChevronRight size={18} className="text-gray-300" />}
                  </button>
                )
              })}
              {categories.length === 0 && <p className="text-center text-gray-400 mt-10 font-medium">Nenhuma categoria encontrada.</p>}
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
              <button onClick={() => { vibrate([5]); setShowSubCatModal(false); }} className="p-2 -ml-2 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-95"><ChevronLeft size={20} /></button>
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

      {/* Modal Conta */}
      {showAccModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowAccModal(false)}>
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
           <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
                <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Contas</h3>
                <button onClick={() => setShowAccModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
              </div>
              <div className="space-y-2 pb-6">
                {accounts.map(acc => {
                  const isActive = acc.id === accountId
                  return (
                    <button key={acc.id} onClick={() => { vibrate([5]); setAccountId(acc.id); setShowAccModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent'}`}>
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

      {/* Modal Cartão */}
      {showCardModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowCardModal(false)}>
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
           <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
                <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Cartão de Crédito</h3>
                <button onClick={() => setShowCardModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
              </div>
              <div className="space-y-2 pb-6">
                {creditCards.map(card => {
                  const isActive = card.id === creditCardId
                  return (
                    <button key={card.id} onClick={() => { vibrate([5]); setCreditCardId(card.id); setAccountId(''); setShowCardModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent'}`}>
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

      {/* Modal Contato */}
      {showContactModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowContactModal(false)}>
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
           <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
                <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Contatos</h3>
                <button onClick={() => setShowContactModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
              </div>
              <div className="space-y-2 pb-6">
                {contacts.map((contact) => {
                  const isActive = contact.id === contactId
                  const IconComp = getDynamicIcon(contact.icon || 'user')
                  return (
                    <button key={contact.id} onClick={() => { vibrate([5]); setContactId(contact.id); setShowContactModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent'}`}>
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
                <button onClick={() => setShowTagModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
              </div>
              <div className="space-y-2 pb-6">
                {tags.map((tag) => {
                  const isActive = selectedTags.includes(tag.id)
                  return (
                    <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent'}`}>
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
