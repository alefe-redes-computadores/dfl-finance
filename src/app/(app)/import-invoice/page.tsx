// src/app/(app)/import-invoice/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  FileUp,
  HandCoins,
  Loader2,
  Tag,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'

import BankLogo from '@/components/BankLogo'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import ModalEmprestimo from '@/components/ModalEmprestimo'
import ModalFinancing from '@/components/ModalFinancing'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { reconcileCardInvoiceCycle } from '@/lib/cardOperations'
import { db, addToSyncQueue } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { getDynamicIcon } from '@/lib/iconUtils'
import { supabase } from '@/lib/supabase'

interface ExtractedTransaction {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  suggested_category?: string
}

const normalizeName = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const ExtractionSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="rounded-[20px] border border-gray-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-teal-100 dark:bg-teal-900/30">
          <Loader2 size={22} className="animate-spin text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-gray-200 dark:bg-slate-700" />
          <div className="h-3 w-24 rounded bg-gray-100 dark:bg-slate-700/50" />
        </div>
      </div>
    </div>

    {[1, 2, 3].map((item) => (
      <div
        key={item}
        className="rounded-[20px] border border-gray-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="mb-2 h-4 w-28 rounded bg-gray-200 dark:bg-slate-700" />
        <div className="mb-2 h-4 w-3/4 rounded bg-gray-100 dark:bg-slate-700/50" />
        <div className="h-5 w-24 rounded bg-gray-200 dark:bg-slate-700" />
      </div>
    ))}
  </div>
)

export default function ImportInvoicePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context, appMode } = useContext_()
  const effectiveContext =
    appMode === 'personal_only' ? 'personal' : context

  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } =
    useHapticFeedback()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<
    ExtractedTransaction[]
  >([])
  const [importing, setImporting] = useState(false)
  const [step, setStep] = useState<
    'upload' | 'preview' | 'done'
  >('upload')

  const [creditCardId, setCreditCardId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const [applyCategoryToAll, setApplyCategoryToAll] =
    useState(false)

  const [showCardModal, setShowCardModal] = useState(false)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showFinancingModal, setShowFinancingModal] =
    useState(false)
  const [showLoanModal, setShowLoanModal] = useState(false)

  const [financingId, setFinancingId] =
    useState<string | null>(null)
  const [debtId, setDebtId] =
    useState<string | null>(null)

  const [showDetails, setShowDetails] = useState(false)
  const [notes, setNotes] = useState('')

  const { data: creditCards = [] } = useLocalData({
    table: 'credit_cards' as any,
    filters: { context: effectiveContext },
  })

  const { data: accounts = [] } = useLocalData({
    table: 'accounts' as any,
    filters: { context: effectiveContext },
  })

  const { data: categories = [] } = useLocalData({
    table: 'categories' as any,
    filters: {
      context: effectiveContext,
      type: 'expense',
    },
  })

  const { data: tags = [] } = useLocalData({
    table: 'tags' as any,
    filters: { context: effectiveContext },
  })

  const categoryByName = useMemo(
    () =>
      new Map<string, string>(
        (categories as any[]).map((category) => [
          normalizeName(category.name),
          category.id,
        ])
      ),
    [categories]
  )

  const selectedCard = (creditCards as any[]).find(
    (card) => card.id === creditCardId
  )
  const selectedAccount = (accounts as any[]).find(
    (account) => account.id === accountId
  )
  const selectedCategory = (categories as any[]).find(
    (category) => category.id === categoryId
  )

  const incomeCount = transactions.filter(
    (transaction) => transaction.type === 'income'
  ).length

  useEffect(() => {
    setCreditCardId('')
    setAccountId('')
    setCategoryId('')
    setSelectedTags([])
    setApplyCategoryToAll(false)
    setFinancingId(null)
    setDebtId(null)
  }, [effectiveContext])

  const resetImport = () => {
    vibrate([5])
    setFile(null)
    setTransactions([])
    setLoading(false)
    setImporting(false)
    setStep('upload')
    setShowDetails(false)
    setNotes('')
    setCreditCardId('')
    setAccountId('')
    setCategoryId('')
    setSelectedTags([])
    setApplyCategoryToAll(false)
    setFinancingId(null)
    setDebtId(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0]

    if (!selectedFile || !user?.id) return

    const extension = selectedFile.name
      .split('.')
      .pop()
      ?.toLowerCase()

    if (!extension || !['pdf', 'ofx'].includes(extension)) {
      errorHaptic()
      showToast('Use um arquivo PDF ou OFX.', 'warning')
      event.target.value = ''
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      errorHaptic()
      showToast('O arquivo deve ter no máximo 10 MB.', 'warning')
      event.target.value = ''
      return
    }

    vibrate([8])
    setFile(selectedFile)
    setTransactions([])
    setLoading(true)
    setStep('preview')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Sessão expirada. Entre novamente.')
      }

      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error || 'Erro ao extrair movimentações.'
        )
      }

      const extracted: ExtractedTransaction[] =
        Array.isArray(data.transactions)
          ? data.transactions
          : []

      if (extracted.length === 0) {
        throw new Error(
          'Nenhuma movimentação válida foi encontrada.'
        )
      }

      setTransactions(extracted)
      success()
      showToast(
        `${extracted.length} movimentações encontradas. Revise antes de importar.`,
        'success'
      )
    } catch (error: any) {
      errorHaptic()
      showToast(
        error?.message || 'Erro ao processar o arquivo.',
        'error'
      )
      setFile(null)
      setTransactions([])
      setStep('upload')

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setLoading(false)
    }
  }

  const updateTransaction = (
    index: number,
    field: keyof ExtractedTransaction,
    value: string | number
  ) => {
    setTransactions((current) =>
      current.map((transaction, currentIndex) =>
        currentIndex === index
          ? { ...transaction, [field]: value }
          : transaction
      )
    )
  }

  const removeTransaction = (index: number) => {
    vibrate([5])
    setTransactions((current) =>
      current.filter((_, currentIndex) => currentIndex !== index)
    )
  }

  const chooseCard = (id: string) => {
    vibrate([5])
    setCreditCardId(id)
    setAccountId('')
    setShowCardModal(false)
  }

  const chooseAccount = (id: string) => {
    vibrate([5])
    setAccountId(id)
    setCreditCardId('')
    setShowAccModal(false)
  }

  const toggleTag = (id: string) => {
    vibrate([4])
    setSelectedTags((current) =>
      current.includes(id)
        ? current.filter((tagId) => tagId !== id)
        : [...current, id]
    )
  }

  const handleImport = async () => {
    if (!user?.id || transactions.length === 0) return

    if (!creditCardId && !accountId) {
      errorHaptic()
      showToast(
        'Escolha um cartão ou uma conta antes de importar.',
        'warning'
      )
      return
    }

    if (
      creditCardId &&
      transactions.some(
        (transaction) => transaction.type === 'income'
      )
    ) {
      errorHaptic()
      showToast(
        'A fatura contém créditos ou estornos. Remova esses itens antes de importar para o cartão; o fluxo de crédito de cartão será tratado separadamente para não distorcer a fatura.',
        'warning'
      )
      return
    }

    const invalidTransaction = transactions.find(
      (transaction) =>
        !transaction.date ||
        !transaction.description.trim() ||
        !Number.isFinite(Number(transaction.amount)) ||
        Number(transaction.amount) <= 0
    )

    if (invalidTransaction) {
      errorHaptic()
      showToast(
        'Revise datas, descrições e valores antes de importar.',
        'warning'
      )
      return
    }

    setImporting(true)
    vibrate([10])

    try {
      await db.transaction(
        'rw',
        [
          'credit_cards',
          'credit_invoices',
          'transactions',
          'notifications',
          'syncQueue',
        ],
        async () => {
          let freshCreditCard: any = null
          let freshAccount: any = null

          if (creditCardId) {
            freshCreditCard =
              await db.credit_cards.get(creditCardId)

            if (
              !freshCreditCard ||
              freshCreditCard.user_id !== user.id
            ) {
              throw new Error(
                'Cartão selecionado não está disponível.'
              )
            }
          }

          if (accountId) {
            freshAccount =
              await db.accounts.get(accountId)

            if (
              !freshAccount ||
              freshAccount.user_id !== user.id
            ) {
              throw new Error(
                'Conta selecionada não está disponível.'
              )
            }
          }

          const now = new Date().toISOString()

          const payload = transactions.map((transaction) => {
            const suggestedCategoryId =
              transaction.suggested_category
                ? categoryByName.get(
                    normalizeName(
                      transaction.suggested_category
                    )
                  ) || null
                : null

            const finalCategoryId =
              applyCategoryToAll && categoryId
                ? categoryId
                : suggestedCategoryId

            const isCard = Boolean(freshCreditCard)
            const transactionType = isCard
              ? 'expense'
              : transaction.type

            return {
              id: crypto.randomUUID(),
              user_id: user.id,
              type: transactionType,
              amount: Math.abs(Number(transaction.amount)),
              description: transaction.description.trim(),
              category_id: finalCategoryId,
              account_id: isCard
                ? null
                : freshAccount?.id || null,
              credit_card_id:
                freshCreditCard?.id || null,
              invoice_id: null,
              tag_ids:
                selectedTags.length > 0
                  ? selectedTags
                  : null,
              date: transaction.date,
              status: 'done',
              context: effectiveContext,
              notes: notes.trim() || null,
              financing_id: financingId,
              debt_id: debtId,
              affects_balance: isCard ? false : true,
              created_at: now,
              updated_at: now,
              sync_status: 'pending',
              sync_attempts: 0,
            }
          })

          for (const transaction of payload) {
            await db.transactions.add(transaction)

            await addToSyncQueue(
              user.id,
              'transactions',
              'create',
              transaction.id,
              transaction
            )
          }

          if (freshCreditCard) {
            const cycleDates = Array.from(
              new Set(
                payload.map(
                  (transaction) => transaction.date
                )
              )
            )

            for (const transactionDate of cycleDates) {
              await reconcileCardInvoiceCycle({
                userId: user.id,
                card: freshCreditCard,
                transactionDate,
              })
            }
          }

          const notificationId = crypto.randomUUID()
          const notificationPayload = {
            id: notificationId,
            user_id: user.id,
            type: 'import_done',
            title: 'Importação concluída',
            subtitle: `${payload.length} transações importadas.`,
            severity: 'success',
            data: {
              count: payload.length,
              destination:
                freshCreditCard?.name ||
                freshAccount?.name ||
                'Destino',
            },
            is_read: false,
            created_at: now,
            sync_status: 'pending',
            sync_attempts: 0,
          }

          await db.notifications.add(notificationPayload)

          await addToSyncQueue(
            user.id,
            'notifications',
            'create',
            notificationId,
            notificationPayload
          )
        }
      )

      success()
      showToast(
        `${transactions.length} transações importadas.`,
        'success'
      )
      setStep('done')
      router.refresh()
    } catch (error: any) {
      console.error('Erro ao importar fatura:', error)
      errorHaptic()
      showToast(
        error?.message || 'Erro ao importar as transações.',
        'error'
      )
    } finally {
      setImporting(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value || 0))

  if (loading) {
    return (
      <div className="relative mx-auto min-h-screen max-w-md bg-[#f7f8fa] pb-24 font-sans dark:bg-slate-950">
        <div className="sticky top-0 z-10 border-b border-gray-200/60 bg-[#f7f8fa]/92 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92">
          <div className="rounded-[20px] border border-gray-200/70 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-10 w-10 animate-pulse rounded-[16px] bg-gray-200 dark:bg-slate-700" />
              <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-slate-700" />
              <div className="w-10" />
            </div>
            <div className="h-10 animate-pulse rounded-[18px] bg-gray-200 dark:bg-slate-700" />
          </div>
        </div>

        <div className="px-4 pt-4">
          <ExtractionSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="relative mx-auto min-h-screen max-w-md bg-[#f7f8fa] pb-24 font-sans dark:bg-slate-950">
      <div className="sticky top-0 z-30 border-b border-gray-200/60 bg-[#f7f8fa]/92 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92">
        <div className="rounded-[20px] border border-gray-200/70 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-700 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-950/40 dark:text-gray-200"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="text-center">
              <h1 className="text-[20px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Importar Fatura
              </h1>
              <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                OFX direto ou PDF analisado pelo Gemini
              </p>
            </div>

            <div className="w-10" />
          </div>

          <ContextToggle />
        </div>
      </div>

      <div className="px-4 pt-3">
        {step === 'upload' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="rounded-[20px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-3 rounded-[20px] border-2 border-dashed border-gray-200 bg-gray-50/70 px-6 py-10 text-gray-500 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-950/40 dark:text-gray-400"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-teal-50 dark:bg-teal-900/20">
                  <FileUp size={28} className="text-teal-600 dark:text-teal-400" />
                </div>

                <div className="text-center">
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                    Selecionar arquivo
                  </p>
                  <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">
                    PDF ou OFX · até 10 MB
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

            <div className="rounded-[20px] border border-teal-200/70 bg-teal-50/70 p-4 text-[12px] leading-5 text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/20 dark:text-teal-300">
              Arquivos OFX são interpretados diretamente. PDFs são enviados ao Gemini configurado no servidor e retornam somente uma prévia para sua revisão.
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="rounded-[20px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-teal-50 dark:bg-teal-900/20">
                  <FileText size={22} className="text-teal-600 dark:text-teal-400" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                    {file?.name}
                  </p>
                  <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">
                    {transactions.length} movimentações encontradas
                    {incomeCount > 0 &&
                      ` · ${incomeCount} crédito(s)/estorno(s)`}
                  </p>
                </div>
              </div>
            </div>

            {incomeCount > 0 && creditCardId && (
              <div className="flex gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-[12px] leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p>
                  Créditos e estornos não serão gravados como despesa negativa. Remova esses itens antes de importar para o cartão; isso evita aumentar ou reduzir a fatura de forma incorreta.
                </p>
              </div>
            )}

            <div className="overflow-hidden rounded-[20px] border border-gray-200/70 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              {(creditCards as any[]).length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCardModal(true)}
                  className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 active:scale-[0.98]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gray-50 dark:bg-slate-950/50">
                      <CreditCard size={18} className="text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="mb-0.5 ml-1 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                        Destino
                      </p>
                      <span className="block truncate text-[14px] font-medium text-gray-900 dark:text-gray-100">
                        {selectedCard
                          ? selectedCard.name
                          : selectedAccount
                            ? selectedAccount.name
                            : 'Escolher cartão ou conta'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 dark:text-gray-500" />
                </button>
              )}

              <div className="mx-3 h-px bg-gray-100 dark:bg-slate-700" />

              <button
                type="button"
                onClick={() => setShowAccModal(true)}
                className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 active:scale-[0.98]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gray-50 dark:bg-slate-950/50">
                    <Wallet size={18} className="text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="mb-0.5 ml-1 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                      Conta
                    </p>
                    <span className={`block truncate text-[14px] font-medium ${selectedAccount ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                      {selectedAccount
                        ? selectedAccount.name
                        : 'Usar conta em vez do cartão'}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 dark:text-gray-500" />
              </button>

              <div className="mx-3 h-px bg-gray-100 dark:bg-slate-700" />

              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <button
                  type="button"
                  onClick={() => setShowCatModal(true)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gray-50 dark:bg-slate-950/50">
                    <Tag size={18} className="text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-0.5 ml-1 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                      Categoria
                    </p>
                    <span className={`block truncate text-[14px] font-medium ${applyCategoryToAll && selectedCategory ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                      {applyCategoryToAll && selectedCategory
                        ? selectedCategory.name
                        : 'Usar sugestões quando houver'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    vibrate([4])
                    if (applyCategoryToAll) {
                      setApplyCategoryToAll(false)
                      setCategoryId('')
                    } else {
                      setShowCatModal(true)
                    }
                  }}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${applyCategoryToAll ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}
                >
                  <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${applyCategoryToAll ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {transactions.map((transaction, index) => (
                <div
                  key={`${transaction.date}-${index}`}
                  className="rounded-[20px] border border-gray-200/70 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="rounded-[18px] p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <input
                        type="date"
                        value={transaction.date}
                        onChange={(event) =>
                          updateTransaction(
                            index,
                            'date',
                            event.target.value
                          )
                        }
                        className="w-36 bg-transparent text-[13px] font-semibold text-gray-900 outline-none dark:text-gray-100"
                      />

                      <button
                        type="button"
                        onClick={() => removeTransaction(index)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 active:scale-[0.96]"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={transaction.description}
                      onChange={(event) =>
                        updateTransaction(
                          index,
                          'description',
                          event.target.value
                        )
                      }
                      className="mb-2 w-full bg-transparent text-[14px] text-gray-700 outline-none dark:text-gray-300"
                      placeholder="Descrição"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${transaction.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                        {transaction.type === 'income'
                          ? 'Crédito / estorno'
                          : 'Despesa'}
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={transaction.amount}
                        onChange={(event) =>
                          updateTransaction(
                            index,
                            'amount',
                            Number(event.target.value) || 0
                          )
                        }
                        className="w-28 bg-transparent text-[14px] font-semibold text-gray-900 outline-none dark:text-gray-100"
                      />

                      {transaction.suggested_category && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-slate-700 dark:text-gray-400">
                          {transaction.suggested_category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                vibrate([4])
                setShowDetails((current) => !current)
              }}
              className="mx-auto flex items-center gap-1 py-2 text-[13px] font-semibold text-teal-700 dark:text-teal-400"
            >
              {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
              {showDetails ? (
                <ArrowUp size={16} />
              ) : (
                <ArrowDown size={16} />
              )}
            </button>

            {showDetails && (
              <div className="rounded-[20px] border border-gray-200/70 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTagModal(true)}
                  className="flex w-full items-center justify-between rounded-[16px] px-2 py-3 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <Tag size={18} className="text-gray-400" />
                    <span className="text-[14px] text-gray-800 dark:text-gray-200">
                      {selectedTags.length > 0
                        ? `${selectedTags.length} tag(ns)`
                        : 'Selecionar tags'}
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </button>

                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Observações gerais"
                  className="mt-2 w-full rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-gray-200"
                />

                <button
                  type="button"
                  onClick={() => setShowFinancingModal(true)}
                  className="mt-2 flex w-full items-center justify-between rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  <span className="flex items-center gap-3 text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                    <Building size={18} className="text-gray-400" />
                    Financiamento
                  </span>
                  <span className={`h-2.5 w-2.5 rounded-full ${financingId ? 'bg-teal-600' : 'bg-gray-300 dark:bg-slate-600'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowLoanModal(true)}
                  className="mt-2 flex w-full items-center justify-between rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  <span className="flex items-center gap-3 text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                    <HandCoins size={18} className="text-gray-400" />
                    Empréstimo
                  </span>
                  <span className={`h-2.5 w-2.5 rounded-full ${debtId ? 'bg-teal-600' : 'bg-gray-300 dark:bg-slate-600'}`} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleImport}
              disabled={
                importing ||
                transactions.length === 0
              }
              className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-teal-700 py-4 font-bold text-white shadow-lg shadow-teal-700/20 active:scale-[0.98] disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Download size={20} />
              )}
              {importing
                ? 'Importando...'
                : `Importar ${transactions.length} transações`}
            </button>

            <button
              type="button"
              onClick={resetImport}
              disabled={importing}
              className="w-full py-2 text-[12px] font-semibold text-gray-400 disabled:opacity-50"
            >
              Cancelar importação
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="py-12 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Check size={40} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="mb-2 text-[18px] font-semibold text-gray-800 dark:text-gray-200">
              Importação concluída
            </h2>
            <p className="mb-6 text-[13px] text-gray-500 dark:text-gray-400">
              {transactions.length} transações foram gravadas.
            </p>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/transactions')}
                className="rounded-[20px] bg-teal-700 px-6 py-3 font-bold text-white active:scale-[0.98]"
              >
                Ver transações
              </button>

              <button
                type="button"
                onClick={resetImport}
                className="rounded-[20px] border border-gray-200 bg-white px-6 py-3 font-bold text-gray-700 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300"
              >
                Importar outra
              </button>
            </div>
          </div>
        )}
      </div>

      {showCardModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCardModal(false)}
        >
          <div
            className="h-[60vh] w-full max-w-lg overflow-y-auto rounded-t-[32px] bg-white p-5 dark:bg-slate-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-gray-800 dark:text-gray-100">
                Cartões de Crédito
              </h3>
              <button
                type="button"
                onClick={() => setShowCardModal(false)}
                className="p-2 text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              {(creditCards as any[]).map((card) => (
                <button
                  type="button"
                  key={card.id}
                  onClick={() => chooseCard(card.id)}
                  className={`flex w-full items-center gap-4 rounded-[18px] p-3 active:scale-[0.98] ${creditCardId === card.id ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-[14px] text-white"
                    style={{
                      backgroundColor:
                        card.color || '#0f766e',
                    }}
                  >
                    <CreditCard size={18} />
                  </div>
                  <span className="flex-1 text-left text-[14px] font-medium text-gray-800 dark:text-gray-200">
                    {card.name}
                  </span>
                  {creditCardId === card.id && (
                    <Check size={18} className="text-teal-700 dark:text-teal-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCatModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCatModal(false)}
        >
          <div
            className="h-[60vh] w-full max-w-lg overflow-y-auto rounded-t-[32px] bg-white p-5 dark:bg-slate-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-gray-800 dark:text-gray-100">
                Categoria para todas
              </h3>
              <button
                type="button"
                onClick={() => setShowCatModal(false)}
                className="p-2 text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              {(categories as any[]).map((category) => {
                const Icon = getDynamicIcon(category.icon)

                return (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => {
                      vibrate([5])
                      setCategoryId(category.id)
                      setApplyCategoryToAll(true)
                      setShowCatModal(false)
                    }}
                    className={`flex w-full items-center gap-4 rounded-[18px] p-3 active:scale-[0.98] ${categoryId === category.id ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-[14px]"
                      style={{
                        backgroundColor: `${category.color}20`,
                        color: category.color,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <span className="flex-1 text-left text-[14px] font-medium text-gray-800 dark:text-gray-200">
                      {category.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showAccModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAccModal(false)}
        >
          <div
            className="h-[60vh] w-full max-w-lg overflow-y-auto rounded-t-[32px] bg-white p-5 dark:bg-slate-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-gray-800 dark:text-gray-100">
                Contas
              </h3>
              <button
                type="button"
                onClick={() => setShowAccModal(false)}
                className="p-2 text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              {(accounts as any[]).map((account) => (
                <button
                  type="button"
                  key={account.id}
                  onClick={() => chooseAccount(account.id)}
                  className={`flex w-full items-center gap-4 rounded-[18px] p-3 active:scale-[0.98] ${accountId === account.id ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}
                >
                  <BankLogo
                    color={account.color}
                    name={account.name}
                    size="md"
                  />
                  <span className="flex-1 text-left text-[14px] font-medium text-gray-800 dark:text-gray-200">
                    {account.name}
                  </span>
                  {accountId === account.id && (
                    <Check size={18} className="text-teal-700 dark:text-teal-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showTagModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowTagModal(false)}
        >
          <div
            className="h-[60vh] w-full max-w-lg overflow-y-auto rounded-t-[32px] bg-white p-5 dark:bg-slate-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-gray-800 dark:text-gray-100">
                Tags
              </h3>
              <button
                type="button"
                onClick={() => setShowTagModal(false)}
                className="p-2 text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              {(tags as any[]).map((tag) => (
                <button
                  type="button"
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`flex w-full items-center gap-4 rounded-[18px] p-3 active:scale-[0.98] ${selectedTags.includes(tag.id) ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}
                >
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-left text-[14px] font-medium text-gray-800 dark:text-gray-200">
                    {tag.name}
                  </span>
                  {selectedTags.includes(tag.id) && (
                    <Check size={18} className="text-teal-700 dark:text-teal-400" />
                  )}
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
