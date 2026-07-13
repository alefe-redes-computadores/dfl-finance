'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Upload, FileText, Loader2, Check, X, Edit3,
  Trash2, Download, CreditCard, Tag, Wallet,
  ChevronRight, ArrowRightLeft, Building, HandCoins,
  Camera, Plus, RefreshCw, AlertCircle, Sparkles, FileUp,
  ArrowDown, ArrowUp
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import ModalFinancing from '@/components/ModalFinancing'
import ModalEmprestimo from '@/components/ModalEmprestimo'
import BankLogo from '@/components/BankLogo'
import { getDynamicIcon } from '@/lib/iconUtils'
import MoneyInput from '@/components/MoneyInput'
import { useLocalData } from '@/hooks/useLocalData'
import { db, addToSyncQueue } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'

interface ExtractedTransaction {
  date: string
  description: string
  amount: number
  suggested_category: string
}

// 🔥 EXTRACTION SKELETON ATUALIZADO
const ExtractionSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-[18px] bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-teal-600 dark:text-teal-400" />
        </div>
        <div className="space-y-2 flex-1">
          <div className="h-4 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    </div>

    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2">
        <div className="rounded-[18px] p-3">
          <div className="flex items-start justify-between mb-2">
            <div className="h-5 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="w-8 h-8 bg-gray-100 dark:bg-slate-700/50 rounded-full" />
          </div>
          <div className="h-4 w-3/4 bg-gray-100 dark:bg-slate-700/50 rounded mb-2" />
          <div className="flex items-center gap-2">
            <div className="h-6 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-5 w-16 bg-gray-100 dark:bg-slate-700/50 rounded-full" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

export default function ImportInvoicePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const { showToast } = useToast()
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([])
  const [importing, setImporting] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')

  const [creditCardId, setCreditCardId] = useState('')
  const [creditCards, setCreditCards] = useState<any[]>([])
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<any[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tags, setTags] = useState<any[]>([])

  const [applyCategoryToAll, setApplyCategoryToAll] = useState(false)
  const [applyAccountToAll, setApplyAccountToAll] = useState(false)

  const [showCardModal, setShowCardModal] = useState(false)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showFinancingModal, setShowFinancingModal] = useState(false)
  const [showLoanModal, setShowLoanModal] = useState(false)
  const [financingId, setFinancingId] = useState<string | null>(null)
  const [debtId, setDebtId] = useState<string | null>(null)

  const [showDetails, setShowDetails] = useState(false)
  const [notes, setNotes] = useState('')
  const [isRefund, setIsRefund] = useState(false)

  const { data: localCreditCards, loading: cardsLoading, reload: reloadCards } = useLocalData({
    table: 'credit_cards' as any,
    filters: { context: effectiveContext },
  })

  const { data: localAccounts, loading: accLoading, reload: reloadAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context: effectiveContext },
  })

  const { data: localCategories, loading: catLoading, reload: reloadCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext, type: 'expense' },
  })

  const { data: localTags, loading: tagsLoading, reload: reloadTags } = useLocalData({
    table: 'tags' as any,
    filters: { context: effectiveContext },
  })

  useEffect(() => {
    if (!user?.id) return
    reloadCards()
    reloadAccounts()
    reloadCategories()
    reloadTags()
  }, [user?.id, effectiveContext])

  useEffect(() => {
    if (localCreditCards) setCreditCards(localCreditCards)
    if (localAccounts) setAccounts(localAccounts)
    if (localCategories) setCategories(localCategories)
    if (localTags) setTags(localTags)
  }, [localCreditCards, localAccounts, localCategories, localTags])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile || !user?.id) return

    setFile(selectedFile)
    setLoading(true)
    setStep('preview')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('user_id', user.id)
      formData.append('context', effectiveContext)

      const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao extrair transações')
      }

      setTransactions(data.transactions || [])
      showToast(`${data.transactions.length} transações encontradas.`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Erro ao processar arquivo', 'error')
      setStep('upload')
    } finally {
      setLoading(false)
    }
  }

  const updateTransaction = (index: number, field: string, value: any) => {
    setTransactions(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeTransaction = (index: number) => {
    setTransactions(prev => prev.filter((_, i) => i !== index))
  }

  const handleImport = async () => {
    if (!user?.id || transactions.length === 0) return
    setImporting(true)

    try {
      let invoiceId: string | null = null

      await db.transaction('rw', ['credit_invoices', 'transactions', 'notifications', 'syncQueue'], async () => {

        if (creditCardId) {
          const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)

          const allInvoices = await db.table('credit_invoices')
            .where('credit_card_id').equals(creditCardId)
            .toArray()
          
          const existingInvoice = allInvoices.find((inv: any) => inv.status === 'open')

          if (existingInvoice) {
            invoiceId = existingInvoice.id

            const newTotal = (Number(existingInvoice.total_amount) || 0) + totalAmount

            const updateData = {
              total_amount: newTotal,
              updated_at: new Date().toISOString(),
            }
            await db.table('credit_invoices').update(invoiceId, updateData)
            await addToSyncQueue(user.id, 'credit_invoices', 'update', invoiceId, updateData)

          } else {
            const today = new Date()
            const closingDay = 10
            const dueDay = 15

            const closingDate = new Date(today.getFullYear(), today.getMonth(), closingDay)
            if (today > closingDate) {
              closingDate.setMonth(closingDate.getMonth() + 1)
            }

            const startDate = new Date(closingDate)
            startDate.setMonth(startDate.getMonth() - 1)
            startDate.setDate(closingDay + 1)

            const dueDate = new Date(closingDate)
            dueDate.setDate(dueDay)
            if (dueDate <= closingDate) {
              dueDate.setMonth(dueDate.getMonth() + 1)
            }

            const newInvoiceId = crypto.randomUUID()
            const invoicePayload = {
              id: newInvoiceId,
              user_id: user.id,
              credit_card_id: creditCardId,
              closing_date: closingDate.toISOString().split('T')[0],
              due_date: dueDate.toISOString().split('T')[0],
              start_date: startDate.toISOString().split('T')[0],
              end_date: closingDate.toISOString().split('T')[0],
              total_amount: totalAmount,
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
        }

        const payload = transactions.map((tx, index) => {
          const catId = applyCategoryToAll ? categoryId : null
          const accId = applyAccountToAll ? accountId : null

          let finalNotes = notes
          if (isRefund) finalNotes = `[Devolução/Estorno] ${finalNotes}`.trim()

          return {
            id: crypto.randomUUID(),
            user_id: user.id,
            type: 'expense',
            amount: tx.amount,
            description: tx.description,
            category_id: catId,
            account_id: accId,
            credit_card_id: creditCardId || null,
            invoice_id: invoiceId,
            tag_ids: selectedTags.length > 0 ? selectedTags : null,
            date: tx.date,
            status: creditCardId ? 'done' : (accId ? 'done' : 'pending'),
            context: effectiveContext,
            notes: finalNotes || null,
            financing_id: financingId,
            debt_id: debtId,
            affects_balance: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sync_status: 'pending',
            sync_attempts: 0,
          }
        })

        for (const tx of payload) {
          await db.table('transactions').add(tx)
          await addToSyncQueue(user.id, 'transactions', 'create', tx.id, tx)
        }

        const notifId = crypto.randomUUID()
        const notifPayload = {
          id: notifId,
          user_id: user.id,
          type: 'import_done',
          title: 'Fatura importada',
          subtitle: `${transactions.length} transações importadas com sucesso.`,
          severity: 'success',
          data: {
            count: transactions.length,
            card_name: creditCards.find(c => c.id === creditCardId)?.name || 'Conta'
          },
          is_read: false,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        await db.table('notifications').add(notifPayload)
        await addToSyncQueue(user.id, 'notifications', 'create', notifId, notifPayload)

      })

      showToast(`${transactions.length} transações importadas!`, 'success')
      setStep('done')
      router.refresh()
    } catch (err: any) {
      console.error('Erro ao importar:', err)
      showToast(`Erro ao importar: ${err.message}`, 'error')
    } finally {
      setImporting(false)
    }
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const toggleTag = (id: string) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const selectedCard = creditCards.find(c => c.id === creditCardId)
  const selectedAcc = accounts.find(a => a.id === accountId)
  const selectedCat = categories.find(c => c.id === categoryId)

  // 🔥 LOADING STATE ATUALIZADO
  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
        <div className="px-4 pt-4 pb-3 sticky top-0 z-10 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl border-b border-gray-200/60 dark:border-slate-800">
          <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-[16px] animate-pulse" />
              <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="w-10" />
            </div>
            <div className="h-10 bg-gray-200 dark:bg-slate-700 rounded-[18px] animate-pulse" />
          </div>
        </div>

        <div className="px-4 pt-4">
          <ExtractionSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      
      {/* 🔥 HEADER UNIFICADO */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => router.back()}
              className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="text-center">
              <h1 className="text-[20px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Importar Fatura
              </h1>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                PDF ou OFX com extração local
              </p>
            </div>

            <div className="w-10" />
          </div>

          <ContextToggle />
        </div>
      </div>

      <div className="px-4 pt-3">
        {/* 🔥 STEP UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-[20px] border-2 border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/40 px-6 py-10 flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400 hover:border-teal-500/50 hover:bg-teal-50/40 dark:hover:bg-teal-900/10 transition-all active:scale-[0.98]"
              >
                <div className="w-14 h-14 rounded-[18px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                  <FileUp size={28} className="text-teal-600 dark:text-teal-400" />
                </div>

                <div className="text-center">
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                    Selecionar arquivo
                  </p>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">
                    PDF ou OFX da sua fatura
                  </p>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.ofx"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>
        )}

        {/* 🔥 STEP PREVIEW */}
        {step === 'preview' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* File info */}
            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[18px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
                  <FileText size={22} className="text-teal-600 dark:text-teal-400" />
                </div>

                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {file?.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <Sparkles size={11} />
                      {transactions.length} transações encontradas
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Configurações */}
            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2 overflow-hidden">
              {creditCards.length > 0 && (
                <button
                  onClick={() => setShowCardModal(true)}
                  className="w-full rounded-[18px] px-3 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-900/50 flex items-center justify-center shrink-0">
                      <CreditCard size={18} className="text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-0.5">
                        Cartão
                      </p>
                      <span className={`text-[14px] font-medium truncate block ${selectedCard ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                        {selectedCard ? selectedCard.name : 'Cartão de crédito (opcional)'}
                      </span>
                    </div>
                  </div>

                  {selectedCard ? (
                    <div
                      onClick={(e) => { e.stopPropagation(); setCreditCardId('') }}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    >
                      <X size={15} />
                    </div>
                  ) : (
                    <ChevronRight size={16} className="text-gray-300 dark:text-gray-500 shrink-0" />
                  )}
                </button>
              )}

              <div className="h-px bg-gray-100 dark:bg-slate-700 mx-3" />

              <div className="px-3 py-3 flex items-center justify-between gap-3">
                <button onClick={() => setShowCatModal(true)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-900/50 flex items-center justify-center shrink-0">
                    <Tag size={18} className="text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-0.5">
                      Categoria
                    </p>
                    <span className={`text-[14px] font-medium truncate block ${applyCategoryToAll && selectedCat ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                      {applyCategoryToAll && selectedCat ? selectedCat.name : 'Aplicar a todas'}
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => { setApplyCategoryToAll(!applyCategoryToAll); if (!applyCategoryToAll) setShowCatModal(true) }}
                  className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${applyCategoryToAll ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${applyCategoryToAll ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <div className="h-px bg-gray-100 dark:bg-slate-700 mx-3" />

              <div className="px-3 py-3 flex items-center justify-between gap-3">
                <button onClick={() => setShowAccModal(true)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-900/50 flex items-center justify-center shrink-0">
                    <Wallet size={18} className="text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-0.5">
                      Conta
                    </p>
                    <span className={`text-[14px] font-medium truncate block ${applyAccountToAll && selectedAcc ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                      {applyAccountToAll && selectedAcc ? selectedAcc.name : 'Aplicar a todas'}
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => { setApplyAccountToAll(!applyAccountToAll); if (!applyAccountToAll) setShowAccModal(true) }}
                  className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${applyAccountToAll ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${applyAccountToAll ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {/* Lista de transações */}
            <div className="space-y-2.5">
              {transactions.map((tx, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2"
                >
                  <div className="rounded-[18px] p-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <input
                        type="date"
                        value={tx.date}
                        onChange={(e) => updateTransaction(index, 'date', e.target.value)}
                        className="text-[13px] font-semibold bg-transparent outline-none text-gray-900 dark:text-gray-100 w-36"
                      />

                      <button
                        onClick={() => removeTransaction(index)}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={tx.description}
                      onChange={(e) => updateTransaction(index, 'description', e.target.value)}
                      className="w-full text-[14px] bg-transparent outline-none text-gray-700 dark:text-gray-300 mb-2"
                      placeholder="Descrição"
                    />

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-[14px] font-semibold text-red-600 dark:text-red-400">
                        <span className="text-gray-400">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={tx.amount}
                          onChange={(e) => updateTransaction(index, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-24 bg-transparent outline-none font-semibold text-red-600 dark:text-red-400"
                        />
                      </div>

                      {tx.suggested_category && (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                          {tx.suggested_category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mais detalhes */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="mx-auto py-2 text-teal-700 dark:text-teal-400 text-[13px] font-semibold flex items-center gap-1 hover:scale-[1.02] transition-transform"
            >
              {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
              {showDetails ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            </button>

            {showDetails && (
              <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="rounded-[18px] p-3 space-y-4">
                  <button
                    onClick={() => setShowTagModal(true)}
                    className="w-full flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] px-2 py-2 transition-colors active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Tag size={18} className="text-gray-400 dark:text-gray-500" />
                      <div className="text-left min-w-0">
                        <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-0.5">
                          Tags
                        </p>
                        <span className="text-[14px] text-gray-800 dark:text-gray-200 truncate block">
                          {selectedTags.length > 0 ? `${selectedTags.length} tag(ns) selecionada(s)` : 'Selecionar tags'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 dark:text-gray-500" />
                  </button>

                  <div className="rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3">
                    <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                      Observações gerais
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Adicione uma observação"
                      className="w-full bg-transparent text-[14px] text-gray-700 dark:text-gray-300 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ArrowRightLeft size={18} className="text-gray-400 dark:text-gray-500" />
                      <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                        É uma devolução / estorno
                      </span>
                    </div>
                    <button
                      onClick={() => setIsRefund(!isRefund)}
                      className={`w-11 h-6 rounded-full relative transition-colors ${isRefund ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isRefund ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  <div
                    className="flex items-center justify-between rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 cursor-pointer"
                    onClick={() => setShowFinancingModal(true)}
                  >
                    <div className="flex items-center gap-3">
                      <Building size={18} className="text-gray-400 dark:text-gray-500" />
                      <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                        Financiamento
                      </span>
                    </div>
                    <button className={`w-11 h-6 rounded-full relative transition-colors ${financingId ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${financingId ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  <div
                    className="flex items-center justify-between rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 cursor-pointer"
                    onClick={() => setShowLoanModal(true)}
                  >
                    <div className="flex items-center gap-3">
                      <HandCoins size={18} className="text-gray-400 dark:text-gray-500" />
                      <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                        Empréstimo a alguém
                      </span>
                    </div>
                    <button className={`w-11 h-6 rounded-full relative transition-colors ${debtId ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${debtId ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Botão importar */}
            <button
              onClick={handleImport}
              disabled={importing || transactions.length === 0}
              className="w-full bg-teal-700 text-white py-4 rounded-[20px] font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-teal-700/20"
            >
              {importing ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
              {importing ? 'Importando...' : `Importar ${transactions.length} transações`}
            </button>
          </div>
        )}

        {/* 🔥 STEP DONE */}
        {step === 'done' && (
          <div className="text-center py-12 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={40} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-[18px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Importação concluída!
            </h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-6">
              {transactions.length} transações foram importadas com sucesso.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push('/transactions')}
                className="bg-teal-700 text-white px-6 py-3 rounded-[20px] font-bold hover:bg-teal-800 transition-colors active:scale-[0.98] shadow-lg shadow-teal-700/20"
              >
                Ver transações
              </button>
              <button
                onClick={() => {
                  setStep('upload')
                  setFile(null)
                  setTransactions([])
                }}
                className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-[20px] font-bold border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98]"
              >
                Importar outra
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🔥 MODAL CARTÕES */}
      {showCardModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCardModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-5 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-10 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-semibold text-[18px] text-gray-800 dark:text-gray-100">Cartões de Crédito</h3>
              <button onClick={() => setShowCardModal(false)} className="text-gray-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {creditCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => { setCreditCardId(card.id); setShowCardModal(false) }}
                  className={`w-full rounded-[18px] p-3 flex items-center gap-4 transition-colors active:scale-[0.98] ${creditCardId === card.id ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                >
                  <div className="w-10 h-10 rounded-[14px] flex items-center justify-center text-white" style={{ backgroundColor: card.color || '#f97316' }}>
                    <CreditCard size={18} />
                  </div>
                  <span className="flex-1 text-left text-[14px] font-medium text-gray-800 dark:text-gray-200">{card.name}</span>
                  {creditCardId === card.id && <Check size={18} className="text-teal-700 dark:text-teal-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL CATEGORIAS */}
      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-5 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-10 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-semibold text-[18px] text-gray-800 dark:text-gray-100">Categorias</h3>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {categories.map((cat) => {
                const IconComp = getDynamicIcon(cat.icon)
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setCategoryId(cat.id); setShowCatModal(false); setApplyCategoryToAll(true) }}
                    className={`w-full rounded-[18px] p-3 flex items-center gap-4 transition-colors active:scale-[0.98] ${categoryId === cat.id ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                  >
                    <div className="w-10 h-10 rounded-[14px] flex items-center justify-center" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                      <IconComp size={18} />
                    </div>
                    <span className="flex-1 text-left text-[14px] font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                    {categoryId === cat.id && <Check size={18} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL CONTAS */}
      {showAccModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAccModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-5 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-10 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-semibold text-[18px] text-gray-800 dark:text-gray-100">Contas</h3>
              <button onClick={() => setShowAccModal(false)} className="text-gray-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => { setAccountId(acc.id); setShowAccModal(false); setApplyAccountToAll(true) }}
                  className={`w-full rounded-[18px] p-3 flex items-center gap-4 transition-colors active:scale-[0.98] ${accountId === acc.id ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                >
                  <BankLogo color={acc.color} name={acc.name} size="md" />
                  <span className="flex-1 text-left text-[14px] font-medium text-gray-800 dark:text-gray-200">{acc.name}</span>
                  {accountId === acc.id && <Check size={18} className="text-teal-700 dark:text-teal-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL TAGS */}
      {showTagModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTagModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-5 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-10 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-semibold text-[18px] text-gray-800 dark:text-gray-100">Tags</h3>
              <button onClick={() => setShowTagModal(false)} className="text-gray-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`w-full rounded-[18px] p-3 flex items-center gap-4 transition-colors active:scale-[0.98] ${selectedTags.includes(tag.id) ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-left text-[14px] font-medium text-gray-800 dark:text-gray-200">{tag.name}</span>
                  {selectedTags.includes(tag.id) && <Check size={18} className="text-teal-700 dark:text-teal-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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