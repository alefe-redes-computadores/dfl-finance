'use client'

import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import {
  ChevronLeft, Copy, Trash2, Calendar, Edit3, Tag, Wallet, RefreshCw, Check, Loader2,
  ChevronRight, ArrowRightLeft, Building, HandCoins, Plus, X, Camera, QrCode, Paperclip,
  Image as ImageIcon, CreditCard, ChevronUp, ChevronDown, Users, Layers, FileText,
} from 'lucide-react'
import { format } from 'date-fns'
import ReceiptModal from '@/components/ReceiptModal'
import CameraCapture from '@/components/CameraCapture'
import QRCodeScanner from '@/components/QRCodeScanner'
import ModalFinancing from '@/components/ModalFinancing'
import ModalEmprestimo from '@/components/ModalEmprestimo'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { db, addToSyncQueue } from '@/lib/db' // 🔥 ADICIONADO

export default function EditTransactionPage() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const { vibrate, success } = useHapticFeedback()

  const galeriaInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tx, setTx] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)

  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
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
  const [deleteMode, setDeleteMode] = useState<'single' | 'future' | 'all' | null>(null)

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

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file, { upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)

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
              setAmountInput(ocrData.data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
            }
            if (ocrData.data.date) setDate(ocrData.data.date)
            if (ocrData.data.description) setDescription(ocrData.data.description)
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

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
      const catType = txType === 'income' ? 'income' : 'expense'
      const [{ data: accData }, { data: catData }, { data: tagData }, { data: cardsData }, { data: contactsData }] = await Promise.all([
        supabase.from('accounts').select('id, name, balance, color').match({ user_id: user.id }).order('name'),
        supabase.from('categories').select('*').match({ user_id: user.id }).eq('type', catType),
        supabase.from('tags').select('id, name, color').match({ user_id: user.id }).order('name'),
        supabase.from('credit_cards').select('*').eq('user_id', user.id).eq('is_archived', false).order('name'),
        supabase.from('contacts').select('*').eq('user_id', user.id).eq('context', context).order('name'),
      ])

      setAccounts(Array.isArray(accData) ? accData : [])
      setCreditCards(Array.isArray(cardsData) ? cardsData : [])
      setContacts(Array.isArray(contactsData) ? contactsData : [])
      const allCats = Array.isArray(catData) ? catData : []
      const mainCats = allCats.filter((c) => !c.parent_id)
      const subCats = allCats.filter((c) => c.parent_id)
      const subsMap: Record<string, any[]> = {}
      subCats.forEach((sub) => {
        if (!subsMap[sub.parent_id]) subsMap[sub.parent_id] = []
        subsMap[sub.parent_id].push(sub)
      })
      setCategories(mainCats)
      setSubcategories(subsMap)
      setTags(Array.isArray(tagData) ? tagData : [])

      if (id && id !== 'new') {
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .match({ id, user_id: user.id })
          .single()

        if (txError) {
          showToast('Erro ao buscar transação.', 'error')
        } else if (txData) {
          setTx(txData)
          setTxType(txData.type)
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
        if (paramType === 'income' || paramType === 'expense') {
          setTxType(paramType)
          if (paramType === 'income') setIsPaid(true)
        }
      }
    } catch (err) {
      console.error('Erro inesperado:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [id, user, txType, searchParams, context])

  useEffect(() => { loadData() }, [loadData])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    const num = Number(raw) / 100
    setAmountInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const toggleTag = useCallback((id: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }, [])

  // ============================================================
  // 🔥 HANDLE SAVE CORRIGIDO COM addToSyncQueue
  // ============================================================
  const handleSave = useCallback(async () => {
    if (!user?.id) { showToast('Sessão expirada.', 'error'); return }
    setSaving(true)

    const rawAmount = parseFloat(amountInput.replace(/\./g, '').replace(',', '.'))
    if (isNaN(rawAmount) || rawAmount <= 0) {
      showToast('Informe um valor válido.', 'warning')
      setSaving(false)
      return
    }

    const selectedCat =
      categories.find((c) => c.id === categoryId) ||
      Object.values(subcategories).flat().find((s: any) => s.id === categoryId)
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
      // 🔥 REVERTE SALDO DA CONTA ORIGINAL
      if (!isNew && tx?.status === 'done' && tx?.account_id) {
        const { data: oldAcc, error: oldAccErr } = await supabase
          .from('accounts')
          .select('balance')
          .match({ id: tx.account_id, user_id: user.id })
          .single()
        if (oldAccErr) throw oldAccErr

        const revertedBalance =
          tx.type === 'income'
            ? Number(oldAcc.balance) - Number(tx.amount)
            : Number(oldAcc.balance) + Number(tx.amount)

        await db.table('accounts').update(tx.account_id, { balance: revertedBalance })
        await addToSyncQueue(user.id, 'accounts', 'update', tx.account_id, { balance: revertedBalance })
      }

      // 🔥 APLICA NOVO SALDO
      if (isPaid && accountId && !creditCardId) {
        const { data: newAcc, error: newAccErr } = await supabase
          .from('accounts')
          .select('balance')
          .match({ id: accountId, user_id: user.id })
          .single()
        if (newAccErr) throw newAccErr

        const updatedBalance =
          txType === 'income'
            ? Number(newAcc.balance) + rawAmount
            : Number(newAcc.balance) - rawAmount

        await db.table('accounts').update(accountId, { balance: updatedBalance })
        await addToSyncQueue(user.id, 'accounts', 'update', accountId, { balance: updatedBalance })
      }

      if (isNew) {
        const txId = crypto.randomUUID()
        const fullPayload = { id: txId, ...payload, created_at: new Date().toISOString(), sync_status: 'pending', sync_attempts: 0 }
        await db.table('transactions').add(fullPayload)
        await addToSyncQueue(user.id, 'transactions', 'create', txId, fullPayload)

        if (isReimbursable) {
          const otherContext = context === 'dfl' ? 'personal' : 'dfl'
          const reimbTxId = crypto.randomUUID()
          const reimbPayload = {
            id: reimbTxId,
            user_id: user.id,
            type: txType === 'expense' ? 'income' : 'expense',
            amount: rawAmount,
            description: `Reembolso: ${finalDescription}`,
            date,
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
      } else {
        await db.table('transactions').update(id as string, payload)
        await addToSyncQueue(user.id, 'transactions', 'update', id as string, payload)

        if (isReimbursable && !tx?.is_reimbursable) {
          const otherContext = context === 'dfl' ? 'personal' : 'dfl'
          const reimbTxId = crypto.randomUUID()
          const reimbPayload = {
            id: reimbTxId,
            user_id: user.id,
            type: txType === 'expense' ? 'income' : 'expense',
            amount: rawAmount,
            description: `Reembolso: ${finalDescription}`,
            date,
            status: 'pending',
            context: otherContext,
            category_id: null,
            linked_transaction_id: id,
            is_reimbursable: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sync_status: 'pending',
            sync_attempts: 0,
          }
          await db.table('transactions').add(reimbPayload)
          await addToSyncQueue(user.id, 'transactions', 'create', reimbTxId, reimbPayload)

          await db.table('transactions').update(id as string, { linked_transaction_id: reimbTxId })
          await addToSyncQueue(user.id, 'transactions', 'update', id as string, { linked_transaction_id: reimbTxId })
        }
      }

      vibrate([50])
      setSaved(true)
      showToast('Transação salva!', 'success')
      setTimeout(() => {
        router.refresh()
        router.back()
      }, 800)
    } catch (err: any) {
      console.error('Erro ao salvar:', err)
      showToast('Erro ao salvar transação.', 'error')
    } finally {
      setSaving(false)
    }
  }, [user, amountInput, categoryId, subcategories, description, notes, isRefund, financingId, debtId, txType, creditCardId, isPaid, accountId, contactId, selectedTags, receiptUrl, isReimbursable, isNew, tx, context, vibrate, showToast, router])

  const hasInstallments = tx?.recurring_group_id && tx?.total_installments && tx.total_installments > 1

  const handleDeleteClick = () => {
    if (hasInstallments) {
      setShowDeleteModal(true)
    } else {
      confirmDelete('single')
    }
  }

  // ============================================================
  // 🔥 CONFIRM DELETE CORRIGIDO COM addToSyncQueue
  // ============================================================
  const confirmDelete = async (mode: 'single' | 'future' | 'all') => {
    if (!user?.id) return
    setSaving(true)
    setShowDeleteModal(false)

    try {
      // 🔥 REVERTE SALDO DA CONTA
      if (tx?.status === 'done' && tx?.account_id) {
        const { data: accData } = await supabase
          .from('accounts')
          .select('balance')
          .match({ id: tx.account_id, user_id: user.id })
          .single()
        if (accData) {
          const newBalance =
            tx.type === 'income'
              ? Number(accData.balance) - Number(tx.amount)
              : Number(accData.balance) + Number(tx.amount)
          await db.table('accounts').update(tx.account_id, { balance: newBalance })
          await addToSyncQueue(user.id, 'accounts', 'update', tx.account_id, { balance: newBalance })
        }
      }

      if (mode === 'single' || !hasInstallments) {
        await db.table('transactions').delete(id as string)
        await addToSyncQueue(user.id, 'transactions', 'delete', id as string, { id: id as string })
      } else if (mode === 'future' && tx?.recurring_group_id) {
        // 🔥 Busca transações futuras via supabase (leitura) e deleta localmente
        const { data: futureTxs } = await supabase
          .from('transactions')
          .select('id')
          .match({ user_id: user.id, recurring_group_id: tx.recurring_group_id })
          .gte('date', tx.date)

        if (futureTxs) {
          for (const ftx of futureTxs) {
            await db.table('transactions').delete(ftx.id)
            await addToSyncQueue(user.id, 'transactions', 'delete', ftx.id, { id: ftx.id })
          }
        }
      } else if (mode === 'all' && tx?.recurring_group_id) {
        const { data: allTxs } = await supabase
          .from('transactions')
          .select('id')
          .match({ user_id: user.id, recurring_group_id: tx.recurring_group_id })

        if (allTxs) {
          for (const atx of allTxs) {
            await db.table('transactions').delete(atx.id)
            await addToSyncQueue(user.id, 'transactions', 'delete', atx.id, { id: atx.id })
          }
        }
      }

      showToast(
        mode === 'single' ? 'Transação excluída.' :
        mode === 'future' ? 'Transações futuras excluídas.' :
        'Todas as parcelas excluídas.',
        'info'
      )
      router.refresh()
      router.back()
    } catch (err: any) {
      console.error('Erro ao excluir:', err)
      showToast('Erro ao excluir transação.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        {loadingPulse && (
          <div className="fixed top-20 right-4 z-50">
            <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
          </div>
        )}
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  const isIncome = txType === 'income'
  const typeLabel = isIncome ? 'receita' : 'despesa'
  const colorClass = isIncome ? 'text-emerald-600' : 'text-red-500'
  const headerGradient = isIncome
    ? 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950 dark:to-slate-800'
    : 'bg-gradient-to-br from-red-50 to-white dark:from-red-950 dark:to-slate-800'
  const valueShadow = isIncome
    ? 'shadow-[0_4px_20px_rgba(16,185,129,0.15)]'
    : 'shadow-[0_4px_20px_rgba(239,68,68,0.15)]'
  const toggleBgClass = isPaid ? (isIncome ? 'bg-emerald-600' : 'bg-teal-700') : 'bg-gray-300 dark:bg-gray-600'
  const toggleTracks = isPaid ? 'translate-x-6' : 'translate-x-1'

  const selectedCat =
    categories.find((c) => c.id === categoryId) ||
    Object.values(subcategories).flat().find((s: any) => s.id === categoryId)
  const selectedAcc = accounts.find((a) => a.id === accountId)
  const selectedCard = creditCards.find((c) => c.id === creditCardId)
  const selectedContact = contacts.find((c) => c.id === contactId)

  const isParcelado = tx?.recurring_group_id && tx?.total_installments && tx.total_installments > 1
  const parcelaLabel = isParcelado ? `${tx.installment_index || 1}/${tx.total_installments}` : null

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      <input ref={galeriaInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }} />
      <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }} />

      <div className={`${headerGradient} px-4 pt-6 pb-4 shadow-sm border border-gray-100 dark:border-slate-700 sticky top-0 z-10 transition-all duration-300`}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 capitalize">
              {isNew ? `Nova ${typeLabel}` : `Editar ${typeLabel}`}
            </h1>
            {parcelaLabel && (
              <span className="text-xs font-bold bg-white dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full mt-1 inline-block">
                Parcela {parcelaLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isNew && <button onClick={handleDeleteClick} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"><Trash2 size={20} /></button>}
          </div>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 ${valueShadow} transition-shadow duration-300`}>
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Valor</label>
          <div className="flex items-center gap-1 text-3xl font-bold">
            <span className="text-gray-400">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={handleAmountChange}
              className={`bg-transparent outline-none w-full ${colorClass}`}
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3">
          <Edit3 size={20} className="text-gray-400" />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={selectedCat ? selectedCat.name : 'Nome da transação'}
            className="flex-1 text-sm font-medium bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${isPaid ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <Check size={16} className={`transition-colors duration-300 ${isPaid ? 'text-emerald-600' : 'text-gray-400'}`} />
            </div>
            <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
              {isIncome ? 'Recebido' : creditCardId ? 'Compra no cartão' : 'Pago'}
            </span>
          </div>
          {!creditCardId && (
            <button
              onClick={() => { setIsPaid(!isPaid); vibrate(10) }}
              className={`w-12 h-7 rounded-full relative transition-all duration-300 ${toggleBgClass} active:scale-95`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-sm ${toggleTracks}`} />
            </button>
          )}
        </div>

        {!isIncome && creditCards.length > 0 && (
          <button onClick={() => setShowCardModal(true)} className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard size={20} className="text-gray-400" />
              <span className={`text-sm font-medium ${selectedCard ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                {selectedCard ? selectedCard.name : 'Cartão de crédito (opcional)'}
              </span>
            </div>
            {selectedCard && (
              <div onClick={(e) => { e.stopPropagation(); setCreditCardId('') }} className="p-2 text-gray-400 hover:text-red-500"><X size={16} /></div>
            )}
          </button>
        )}

        <button onClick={() => setShowCatModal(true)} className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tag size={20} className="text-gray-400" />
            <span className={`text-sm font-medium ${selectedCat ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
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
            <ChevronRight size={18} className="text-gray-300" />
          </div>
        </button>

        {!creditCardId && (
          <button onClick={() => setShowAccModal(true)} className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet size={20} className="text-gray-400" />
              <span className={`text-sm font-medium ${selectedAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                {selectedAcc ? selectedAcc.name : 'Conta'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedAcc && <BankLogo color={selectedAcc.color} name={selectedAcc.name} size="sm" />}
              <ChevronRight size={18} className="text-gray-300" />
            </div>
          </button>
        )}

        {contacts.length > 0 && (
          <button onClick={() => setShowContactModal(true)} className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-gray-400" />
              <span className={`text-sm font-medium ${selectedContact ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                {selectedContact ? selectedContact.name : 'Fornecedor / Cliente (opcional)'}
              </span>
            </div>
            {selectedContact && (
              <div onClick={(e) => { e.stopPropagation(); setContactId('') }} className="p-2 text-gray-400 hover:text-red-500"><X size={16} /></div>
            )}
          </button>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
            <Calendar size={16} className="text-gray-500" />
          </div>
          <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="flex-1 text-sm font-bold bg-transparent outline-none text-gray-800 dark:text-gray-200" />
          {parcelaLabel && (
            <span className="text-[10px] font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full flex items-center gap-1">
              <Layers size={10} />
              {parcelaLabel}
            </span>
          )}
        </div>

        {uploading ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-teal-700" />
            <span className="text-sm text-gray-500">Enviando comprovante...</span>
          </div>
        ) : receiptUrl ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              {receiptPreview ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-200 dark:bg-slate-600 flex-shrink-0 ring-2 ring-blue-100 dark:ring-blue-900">
                  <img src={receiptPreview} alt="Comprovante" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ring-2 ${receiptType === 'pdf' ? 'bg-red-50 dark:bg-red-900/30 ring-red-100 dark:ring-red-900' : 'bg-blue-50 dark:bg-blue-900/30 ring-blue-100 dark:ring-blue-900'}`}>
                  {receiptType === 'pdf' ? <Paperclip size={22} className="text-red-500" /> : <ImageIcon size={22} className="text-blue-500" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{receiptName || 'Comprovante'}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Comprovante anexado</p>
              </div>
              <button onClick={handleRemoveReceipt} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowReceiptModal(true)} className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3 text-gray-500 hover:border-teal-200 hover:text-teal-600 transition-colors">
            <Camera size={20} />
            <span className="text-sm font-medium">Anexar comprovante</span>
          </button>
        )}

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-teal-700 dark:text-teal-400 text-sm font-bold flex items-center gap-1 mx-auto py-2 hover:scale-105 transition-transform"
        >
          {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${showDetails ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="space-y-3 pt-1">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3">
              <FileText size={20} className="text-gray-400 opacity-50" />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações (opcional)"
                className="flex-1 text-sm bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>

            <button onClick={() => setShowTagModal(true)} className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Tag size={20} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {selectedTags.length > 0 ? `${selectedTags.length} tag(ns) selecionada(s)` : 'Tags'}
                </span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>

            {!isIncome && (
              <>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <RefreshCw size={16} className="text-orange-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">É um reembolso</span>
                      <span className="text-[11px] text-gray-400">Pago com recurso do outro contexto (PF/PJ)</span>
                    </div>
                  </div>
                  <button onClick={() => setIsReimbursable(!isReimbursable)} className={`w-12 h-6 rounded-full transition-colors ${isReimbursable ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 shadow-sm ${isReimbursable ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <ArrowRightLeft size={16} className="text-blue-500" />
                    </div>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">É uma devolução / estorno</span>
                  </div>
                  <button onClick={() => setIsRefund(!isRefund)} className={`w-12 h-6 rounded-full transition-colors ${isRefund ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 shadow-sm ${isRefund ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between cursor-pointer" onClick={() => setShowFinancingModal(true)}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Building size={16} className="text-purple-500" />
                    </div>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Financiamento</span>
                  </div>
                  <button className={`w-12 h-6 rounded-full transition-colors ${financingId ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 shadow-sm ${financingId ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between cursor-pointer" onClick={() => setShowLoanModal(true)}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <HandCoins size={16} className="text-amber-500" />
                    </div>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Empréstimo a alguém</span>
                  </div>
                  <button className={`w-12 h-6 rounded-full transition-colors ${debtId ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 shadow-sm ${debtId ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-0 w-full flex justify-center pointer-events-none z-50">
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl pointer-events-auto transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 scale-110'
              : 'bg-teal-700 hover:bg-teal-800 active:scale-95'
          }`}
        >
          {saving ? (
            <Loader2 className="animate-spin" size={24} />
          ) : saved ? (
            <Check size={28} className="animate-in zoom-in duration-300" />
          ) : (
            <Check size={28} />
          )}
        </button>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Excluir transação</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Esta transação faz parte de um grupo de <strong>{tx?.total_installments} parcelas</strong>.
              Como deseja prosseguir?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => confirmDelete('single')}
                className="w-full p-4 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl text-left hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
              >
                <p className="font-bold text-gray-800 dark:text-gray-200">Apenas esta parcela</p>
                <p className="text-xs text-gray-400 mt-1">Exclui somente a parcela atual. As demais continuam.</p>
              </button>

              <button
                onClick={() => confirmDelete('future')}
                className="w-full p-4 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl text-left hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              >
                <p className="font-bold text-amber-600 dark:text-amber-400">Esta e as próximas</p>
                <p className="text-xs text-gray-400 mt-1">Exclui a parcela atual e todas as futuras deste grupo.</p>
              </button>

              <button
                onClick={() => confirmDelete('all')}
                className="w-full p-4 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <p className="font-bold text-red-600 dark:text-red-400">Todas as parcelas</p>
                <p className="text-xs text-gray-400 mt-1">Exclui completamente todas as parcelas deste grupo (passadas e futuras).</p>
              </button>
            </div>

            <button
              onClick={() => setShowDeleteModal(false)}
              className="w-full mt-4 py-3 text-gray-500 font-medium text-sm hover:text-gray-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modais - mantidos com supabase para criação (funciona) */}
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

      {/* Modais de seleção - mantidos com supabase para criação (funciona) */}
      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Categorias</h3>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
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
              <button onClick={() => setShowAccModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
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
              <button onClick={() => setShowTagModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
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
    </div>
  )
}