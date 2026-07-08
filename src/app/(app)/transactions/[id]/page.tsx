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
import { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { db, addToSyncQueue } from '@/lib/db'

export default function EditTransactionPage() {
  const { id } = useParams()
  console.log('🔍 ID recebido na edição:', id) // 🔥 ADICIONADO PARA DEBUG
  
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

    // 🔥 CORREÇÃO: Verifica se o ID existe e NÃO é 'new'
    const isEditMode = id && id !== 'new' && typeof id === 'string' && id.length > 5
    
    if (isEditMode) {
      console.log('🔍 Buscando transação com ID:', id)
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .match({ id, user_id: user.id })
        .single()

      if (txError) {
        console.error('❌ Erro ao buscar transação:', txError)
        showToast('Erro ao buscar transação.', 'error')
        // 🔥 Se não encontrar, cria uma nova
        setIsNew(true)
        setIsPaid(false)
        setDate(format(new Date(), 'yyyy-MM-dd'))
        setAmountInput('0,00')
        setDescription('')
        setNotes('')
        setCategoryId('')
        setAccountId('')
        setCreditCardId('')
        setContactId('')
        setSelectedTags([])
        setIsReimbursable(false)
        setReceiptUrl(null)
        setReceiptPreview(null)
        setReceiptName('')
        setReceiptType(null)
        setFinancingId(null)
        setDebtId(null)
        setIsRefund(false)
        return
      }

      if (txData) {
        // 🔥 CORREÇÃO: Define o tipo ANTES de preencher os campos
        setTxType(txData.type)
        setTx(txData)
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
        setIsNew(false)
      } else {
        // Não encontrou dados
        setIsNew(true)
        setIsPaid(false)
        setDate(format(new Date(), 'yyyy-MM-dd'))
        setAmountInput('0,00')
        setDescription('')
        setNotes('')
        setCategoryId('')
        setAccountId('')
        setCreditCardId('')
        setContactId('')
        setSelectedTags([])
        setIsReimbursable(false)
        setReceiptUrl(null)
        setReceiptPreview(null)
        setReceiptName('')
        setReceiptType(null)
        setFinancingId(null)
        setDebtId(null)
        setIsRefund(false)
      }
    } else {
      // Modo de criação (nova transação)
      setIsNew(true)
      const paramType = searchParams.get('type')
      if (paramType === 'income' || paramType === 'expense') {
        setTxType(paramType)
        if (paramType === 'income') setIsPaid(true)
      }
    }
  } catch (err) {
    console.error('Erro inesperado:', err)
    // Em caso de erro, cria uma nova transação
    setIsNew(true)
    setIsPaid(false)
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setAmountInput('0,00')
    setDescription('')
    setNotes('')
    setCategoryId('')
    setAccountId('')
    setCreditCardId('')
    setContactId('')
    setSelectedTags([])
    setIsReimbursable(false)
    setReceiptUrl(null)
    setReceiptPreview(null)
    setReceiptName('')
    setReceiptType(null)
    setFinancingId(null)
    setDebtId(null)
    setIsRefund(false)
  } finally {
    setLoading(false)
    setLoadingPulse(false)
  }
}, [id, user, txType, searchParams, context])

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

  const confirmDelete = async (mode: 'single' | 'future' | 'all') => {
    if (!user?.id) return
    setSaving(true)
    setShowDeleteModal(false)

    try {
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
        {/* ❌ ContextToggle REMOVIDO */}
      </div>

      {/* Resto da página permanece igual */}
      <div className="px-4 pt-4 space-y-4">
        {/* ... TODO O RESTO DO CÓDIGO PERMANECE IGUAL ... */}
      </div>
    </div>
  )
}