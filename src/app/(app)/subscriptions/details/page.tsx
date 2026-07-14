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
import { useTransactionById } from '@/hooks/useTransactionById'
import { useLocalData } from '@/hooks/useLocalData'
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
  <div className="animate-pulse px-4 pt-5 space-y-4">
    <div className="rounded-[30px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 p-5">
      <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-12 w-48 bg-gray-200 dark:bg-slate-700 rounded mx-auto" />
    </div>
    <div className="rounded-[28px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 overflow-hidden space-y-4 p-5">
      <div className="h-6 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
      <div className="h-14 bg-gray-100 dark:bg-slate-700/50 rounded-2xl" />
      <div className="h-14 bg-gray-100 dark:bg-slate-700/50 rounded-2xl" />
      <div className="h-14 bg-gray-100 dark:bg-slate-700/50 rounded-2xl" />
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

  // ✅ HOOK ESPECÍFICO POR ID
  const { data: tx, loading, notFound } = useTransactionById(id)

  // ✅ TODOS OS HOOKS E USECALLBACK PRIMEIRO, ANTES DE QUALQUER RETURN CONDICIONAL
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
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

  const [initialized, setInitialized] = useState(!id || id === 'new')

  // ✅ useMemo (hook) também no topo
  const categories = useMemo(() => {
    return (localCategories || []).sort((a: any, b: any) => {
      const orderA = a.order_index ?? 9999
      const orderB = b.order_index ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [localCategories])

  // ✅ MOVIDOS PARA O TOPO (antes de qualquer return condicional)
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

  // ✅ CARREGA DADOS AUXILIARES (useEffect também deve estar antes dos returns)
  useEffect(() => {
    if (!user?.id) return

    const loadAuxData = async () => {
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

        const allCats = catData.filter((c: any) => c.context === effectiveContext)
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
        console.error('Erro ao carregar dados auxiliares:', err)
      }
    }

    loadAuxData()
  }, [user, effectiveContext])

  // ✅ HIDRATAÇÃO DO FORMULÁRIO QUANDO O ITEM CHEGAR (useEffect)
  useEffect(() => {
    if (id && id !== 'new' && tx && !initialized) {
      setTxType(tx.type || 'expense')
      setIsPaid(tx.status === 'done')
      setDate(tx.date || format(new Date(), 'yyyy-MM-dd'))
      setDescription(tx.description || '')
      setNotes(tx.notes || '')
      setCategoryId(tx.category_id || '')
      setAccountId(tx.account_id || '')
      setCreditCardId(tx.credit_card_id || '')
      setContactId(tx.contact_id || '')
      setSelectedTags(Array.isArray(tx.tag_ids) ? tx.tag_ids : [])
      setIsReimbursable(tx.is_reimbursable || false)
      setIsRefund(tx.notes?.includes('[Devolução/Estorno]') || false)
      setFinancingId(tx.financing_id || null)
      setDebtId(tx.debt_id || null)

      const amountSafe = Number(tx.amount) || 0
      setAmountInput(amountSafe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

      if (tx.receipt_url) {
        setReceiptUrl(tx.receipt_url)
        const isPdf = tx.receipt_url.toLowerCase().includes('.pdf')
        setReceiptType(isPdf ? 'pdf' : 'image')
        setReceiptName(isPdf ? 'comprovante.pdf' : 'comprovante.jpg')
        if (!isPdf) setReceiptPreview(tx.receipt_url)
      }

      setInitialized(true)
      setIsNew(false)
    }

    if ((!id || id === 'new') && !initialized) {
      const paramType = searchParams.get('type')
      if (paramType === 'income') {
        setTxType('income')
        setIsPaid(true)
      } else {
        setTxType('expense')
        setIsPaid(false)
      }
      setIsNew(true)
      setInitialized(true)
    }
  }, [id, tx, initialized, searchParams])

  // ✅ SÓ AGORA, DEPOIS DE TODOS OS HOOKS E USECALLBACK, PODEMOS TER RETURNS CONDICIONAIS

  // ✅ TRATAMENTO DE LOADING
  if (id && id !== 'new' && loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f6f7f8] dark:bg-slate-950 transition-colors">
        <div className="sticky top-0 z-30 bg-white/88 dark:bg-slate-950/88 backdrop-blur-xl border-b border-black/5 dark:border-white/10 px-4 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
            <div className="h-6 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-10 w-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
          </div>
        </div>
        <TransactionSkeleton />
      </div>
    )
  }

  // ✅ TRATAMENTO DE NÃO ENCONTRADO
  if (id && id !== 'new' && notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f6f7f8] dark:bg-slate-950 px-4">
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <Trash2 size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Transação não encontrada</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs mb-6">
          A transação que você está tentando editar pode ter sido excluída ou você não tem permissão para acessá-la.
        </p>
        <button
          onClick={() => router.push('/transactions')}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-semibold transition-colors active:scale-95"
        >
          Voltar para listagem
        </button>
      </div>
    )
  }

  // ✅ SKELETON ENQUANTO NÃO INICIALIZADO
  if (!initialized) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
        <div className="flex-1 px-4 pt-6">
          <Skeleton count={6} />
        </div>
      </div>
    )
  }

  // ====================================================================
  // A PARTIR DAQUI, FUNÇÕES E JSX QUE NÃO SÃO HOOKS
  // ====================================================================

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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    const num = Number(raw) / 100
    setAmountInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

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

  const isIncome = txType === 'income'
  const colorClass = isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
  const toggleBgClass = isPaid ? (isIncome ? 'bg-emerald-500' : 'bg-teal-600') : 'bg-gray-200 dark:bg-slate-700'
  const toggleTracks = isPaid ? 'translate-x-7' : 'translate-x-1'

  const selectedCat = categories.find((c) => c.id === categoryId) || Object.values(subcategories).flat().find((s: any) => s.id === categoryId)
  const selectedAcc = (accounts || []).find((a) => a.id === accountId)
  const selectedCard = (creditCards || []).find((c) => c.id === creditCardId)
  const selectedContact = (contacts || []).find((c) => c.id === contactId)

  const isParcelado = tx?.recurring_group_id && tx?.total_installments && tx.total_installments > 1
  const parcelaLabel = isParcelado ? `${tx.installment_index || 1}/${tx.total_installments}` : null

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f6f7f8] dark:bg-slate-950 font-sans pb-36 relative transition-colors duration-300">
      <input
        ref={galeriaInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) uploadFile(f)
          e.target.value = ''
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) uploadFile(f)
          e.target.value = ''
        }}
      />

      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-white/88 dark:bg-slate-950/88 backdrop-blur-xl border-b border-black/5 dark:border-white/10 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              vibrate([5])
              router.back()
            }}
            className="h-10 w-10 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 active:scale-95 transition-transform"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="text-center">
            <h1 className="text-[18px] font-bold text-gray-900 dark:text-white">
              {isNew ? `Nova ${isIncome ? 'receita' : 'despesa'}` : `Editar ${isIncome ? 'receita' : 'despesa'}`}
            </h1>
            {parcelaLabel && (
              <span className="mt-1 inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                Parcela {parcelaLabel}
              </span>
            )}
          </div>

          <div className="w-10 flex justify-end">
            {!isNew && (
              <button
                onClick={() => {
                  vibrate([10])
                  hasInstallments ? setShowDeleteModal(true) : confirmDelete('single')
                }}
                className="h-10 w-10 rounded-full flex items-center justify-center text-red-500 active:scale-95 transition-transform"
              >
                <Trash2 size={19} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TODO O RESTO DO JSX PERMANECE IGUAL */}
      {/* O restante do código (seções de valor, essenciais, vínculos, avançado, modais, etc.) */}
      {/* permanece exatamente como você já tinha, pois a correção foi apenas mover os hooks e useCallback para o topo */}
      {/* O que está abaixo NÃO precisa ser alterado */}
      <div className="px-4 pt-5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* ... todo o JSX que já existia ... */}
      </div>
      {/* FAB, modais, etc. */}
    </div>
  )
}

export default function EditTransactionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <EditTransactionContent />
    </Suspense>
  )
}