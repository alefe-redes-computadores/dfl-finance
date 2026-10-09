'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileSearch,
  Inbox,
  Landmark,
  Pencil,
  ReceiptText,
  RefreshCcw,
  SearchCheck,
  WalletCards,
  X,
} from 'lucide-react'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import {
  conciliatePendingTransaction,
  saveConciliationReview,
} from '@/lib/conciliationOperations'
import Skeleton from '@/components/Skeleton'

function safeNum(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function sourceMeta(source?: string | null) {
  switch (source) {
    case 'ai_ocr':
      return { label: 'Comprovante/OCR', review: true, icon: ReceiptText }
    case 'ofx_import':
    case 'ofx_merged':
      return { label: 'Importação · revisar', review: true, icon: FileSearch }
    case 'whatsapp':
      return { label: 'WhatsApp · revisar', review: true, icon: SearchCheck }
    case 'recurring':
      return { label: 'Recorrente', review: false, icon: RefreshCcw }
    default:
      return { label: 'Manual', review: false, icon: Pencil }
  }
}

type ReviewDraft = {
  id: string
  description: string
  amount: string
  date: string
  account_id: string
  category_id: string
  type: string
}

export default function ConciliationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const { showToast } = useToast()
  const { light, success, error: errorHaptic } = useHapticFeedback()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [review, setReview] = useState<ReviewDraft | null>(null)
  const [filter, setFilter] = useState<'all' | 'overdue' | 'today' | 'review'>('all')

  const data = useLiveQuery(async () => {
    if (!user?.id) return { transactions: [], accounts: [], categories: [] }

    const [transactions, accounts, categories] = await Promise.all([
      db.transactions.where('user_id').equals(user.id).toArray(),
      db.accounts.where('user_id').equals(user.id).toArray(),
      db.categories.where('user_id').equals(user.id).toArray(),
    ])

    const today = localIsoDate()

    return {
      transactions: transactions
        .filter((tx: any) => {
          if (tx.context !== effectiveContext || tx.status !== 'pending') return false
          const date = String(tx.date || '').slice(0, 10)
          return Boolean(date) && date <= today
        })
        .sort((a: any, b: any) => {
          const reviewDiff = Number(sourceMeta(b.source).review) - Number(sourceMeta(a.source).review)
          if (reviewDiff) return reviewDiff
          return String(a.date || '').localeCompare(String(b.date || ''))
        }),
      accounts: accounts.filter((item: any) => item.context === effectiveContext && !item.is_archived),
      categories: categories.filter((item: any) => item.context === effectiveContext && !item.is_archived),
    }
  }, [user?.id, effectiveContext])

  const transactions = useMemo(() => data?.transactions ?? [], [data?.transactions])
  const accounts = useMemo(() => data?.accounts ?? [], [data?.accounts])
  const categories = useMemo(() => data?.categories ?? [], [data?.categories])
  const loading = data === undefined
  const today = localIsoDate()

  const stats = useMemo(() => {
    return transactions.reduce(
      (acc, tx: any) => {
        const date = String(tx.date || '').slice(0, 10)
        const amount = safeNum(tx.amount)
        if (date < today) acc.overdue++
        if (date === today) acc.today++
        if (sourceMeta(tx.source).review) acc.review++
        if (tx.type === 'income') acc.receivable += amount
        else acc.payable += amount
        return acc
      },
      { overdue: 0, today: 0, review: 0, payable: 0, receivable: 0 }
    )
  }, [transactions, today])

  const visible = useMemo(() => {
    return transactions.filter((tx: any) => {
      const date = String(tx.date || '').slice(0, 10)
      if (filter === 'overdue') return date < today
      if (filter === 'today') return date === today
      if (filter === 'review') return sourceMeta(tx.source).review
      return true
    })
  }, [transactions, filter, today])

  const accountMap = useMemo(
    () => new Map(accounts.map((item: any) => [item.id, item])),
    [accounts]
  )
  const categoryMap = useMemo(
    () => new Map(categories.map((item: any) => [item.id, item])),
    [categories]
  )

  const openReview = (tx: any) => {
    light()
    setReview({
      id: tx.id,
      description: tx.description || '',
      amount: String(safeNum(tx.amount)),
      date: String(tx.date || '').slice(0, 10),
      account_id: tx.account_id || '',
      category_id: tx.category_id || '',
      type: tx.type,
    })
  }

  const saveReview = async () => {
    if (!user?.id || !review || processingId) return
    setProcessingId(review.id)
    try {
      await saveConciliationReview(user.id, review.id, {
        description: review.description,
        amount: Number(review.amount.replace(',', '.')),
        date: review.date,
        account_id: review.account_id,
        category_id: review.category_id || null,
      })
      success()
      showToast('Revisão salva. Agora você pode conciliar com segurança.', 'success')
      setReview(null)
    } catch (error: any) {
      errorHaptic()
      showToast(error?.message || 'Não foi possível salvar a revisão.', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const conciliate = async (tx: any) => {
    if (!user?.id || processingId) return
    if (!tx.account_id) {
      openReview(tx)
      showToast('Escolha a conta antes de conciliar.', 'warning')
      return
    }

    setProcessingId(tx.id)
    try {
      const result = await conciliatePendingTransaction(user.id, tx.id)
      success()
      showToast(
        result.alreadyDone
          ? 'Esta transação já estava concluída.'
          : tx.type === 'income'
            ? 'Recebimento conciliado e saldo atualizado.'
            : 'Pagamento conciliado e saldo atualizado.',
        'success'
      )
    } catch (error: any) {
      errorHaptic()
      showToast(error?.message || 'Não foi possível conciliar.', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#f6f7f8] px-4 pt-6 dark:bg-slate-950">
        <Skeleton count={6} />
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md bg-[#f6f7f8] pb-28 transition-colors dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f6f7f8]/92 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-white/5 dark:bg-slate-950/92">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/more')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-black/5 bg-white text-gray-600 active:scale-95 dark:border-white/5 dark:bg-slate-900 dark:text-gray-300"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-black tracking-tight text-gray-900 dark:text-white">
              Inbox financeira
            </h1>
            <p className="text-[11px] font-medium text-gray-400">
              Revise o que precisa da sua decisão
            </p>
          </div>
          <div className="flex h-10 min-w-10 items-center justify-center rounded-[16px] bg-sky-50 px-3 text-[12px] font-black text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
            {transactions.length}
          </div>
        </div>
      </header>

      <main className="space-y-4 px-4 pt-4">
        <section className="overflow-hidden rounded-[26px] border border-black/5 bg-white shadow-sm dark:border-white/5 dark:bg-slate-900">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                <Inbox size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-black text-gray-900 dark:text-white">O que precisa de você</p>
                <p className="mt-0.5 text-[11px] leading-4 text-gray-400">
                  WhatsApp, comprovantes, importações e pendências atuais ficam aqui. O que é futuro continua no planejamento.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: 'Atrasadas', value: stats.overdue, icon: AlertCircle, cls: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400' },
                { label: 'Hoje', value: stats.today, icon: Clock3, cls: 'text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400' },
                { label: 'Revisar', value: stats.review, icon: SearchCheck, cls: 'text-violet-700 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-400' },
              ].map(({ label, value, icon: Icon, cls }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFilter(label === 'Atrasadas' ? 'overdue' : label === 'Hoje' ? 'today' : 'review')}
                  className={`min-w-0 rounded-[17px] p-3 text-left active:scale-[0.98] ${cls}`}
                >
                  <Icon size={16} />
                  <p className="mt-2 text-[19px] font-black leading-none">{value}</p>
                  <p className="mt-1 truncate text-[9px] font-black uppercase tracking-wide opacity-70">{label}</p>
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="min-w-0 rounded-[17px] border border-red-100 bg-red-50/40 p-3 dark:border-red-500/10 dark:bg-red-500/5">
                <p className="text-[9px] font-black uppercase tracking-wide text-red-500/70">A pagar</p>
                <p className="mt-1 truncate text-[13px] font-black text-red-600 dark:text-red-400">{formatMoney(stats.payable)}</p>
              </div>
              <div className="min-w-0 rounded-[17px] border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-500/10 dark:bg-emerald-500/5">
                <p className="text-[9px] font-black uppercase tracking-wide text-emerald-600/70">A receber</p>
                <p className="mt-1 truncate text-[13px] font-black text-emerald-700 dark:text-emerald-400">{formatMoney(stats.receivable)}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-t border-gray-100 px-4 py-3 scrollbar-hide dark:border-slate-800">
            {[
              ['all', 'Todas'],
              ['overdue', 'Atrasadas'],
              ['today', 'Hoje'],
              ['review', 'Automação'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { light(); setFilter(key as typeof filter) }}
                className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-bold ${
                  filter === key
                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900'
                    : 'border-gray-200 bg-white text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {visible.length === 0 ? (
          <section className="flex flex-col items-center justify-center rounded-[26px] border border-black/5 bg-white px-6 py-14 text-center shadow-sm dark:border-white/5 dark:bg-slate-900">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Check size={24} />
            </div>
            <h2 className="mt-4 text-[16px] font-black text-gray-900 dark:text-white">
              {transactions.length === 0 ? 'Tudo conciliado' : 'Nada neste filtro'}
            </h2>
            <p className="mt-1 max-w-[250px] text-[11px] leading-5 text-gray-400">
              {transactions.length === 0
                ? 'Não há pendências vencidas ou de hoje aguardando sua revisão.'
                : 'As outras pendências continuam preservadas na caixa de revisão.'}
            </p>
          </section>
        ) : (
          <section className="space-y-2.5">
            {visible.map((tx: any) => {
              const account = tx.account_id ? accountMap.get(tx.account_id) : null
              const category = tx.category_id ? categoryMap.get(tx.category_id) : null
              const meta = sourceMeta(tx.source)
              const SourceIcon = meta.icon
              const overdue = String(tx.date || '').slice(0, 10) < today
              const isIncome = tx.type === 'income'
              const busy = processingId === tx.id

              return (
                <article
                  key={tx.id}
                  className="overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-sm dark:border-white/5 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    onClick={() => openReview(tx)}
                    className="w-full p-4 text-left active:bg-gray-50 dark:active:bg-slate-800"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] ${
                        isIncome
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                      }`}>
                        {isIncome ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-black text-gray-900 dark:text-white">
                              {tx.description || 'Transação sem descrição'}
                            </p>
                            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-gray-400">
                              <SourceIcon size={12} className="shrink-0" />
                              <span className="truncate">{meta.label}</span>
                              <span>•</span>
                              <span className={overdue ? 'text-red-500' : ''}>
                                {String(tx.date || '').slice(0, 10).split('-').reverse().join('/')}
                              </span>
                            </div>
                          </div>
                          <p className={`shrink-0 text-[14px] font-black ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                            {formatMoney(safeNum(tx.amount))}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className={`max-w-full truncate rounded-full px-2.5 py-1 text-[9.5px] font-bold ${
                            account
                              ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                          }`}>
                            {account?.name || 'Conta pendente'}
                          </span>
                          <span className="max-w-full truncate rounded-full bg-gray-50 px-2.5 py-1 text-[9.5px] font-bold text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                            {category?.name || 'Sem categoria'}
                          </span>
                          {meta.review && (
                            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[9.5px] font-bold text-violet-700 dark:bg-violet-500/10 dark:text-violet-400">
                              Revisão recomendada
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="mt-1 shrink-0 text-gray-300" />
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-2 border-t border-gray-100 p-2.5 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => openReview(tx)}
                      disabled={busy}
                      className="flex h-10 items-center justify-center gap-2 rounded-[15px] bg-gray-50 text-[11px] font-black text-gray-600 active:scale-[0.98] disabled:opacity-50 dark:bg-slate-800 dark:text-gray-300"
                    >
                      <Pencil size={14} /> Revisar
                    </button>
                    <button
                      type="button"
                      onClick={() => void conciliate(tx)}
                      disabled={busy}
                      className="flex h-10 items-center justify-center gap-2 rounded-[15px] bg-gray-900 text-[11px] font-black text-white active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-gray-900"
                    >
                      <Check size={14} /> {busy ? 'Conciliando…' : 'Conciliar'}
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </main>

      {review && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !processingId && setReview(null)}
        >
          <div
            className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[32px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 shadow-2xl dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-slate-200 dark:bg-slate-700" />

            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                <SearchCheck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-black text-gray-900 dark:text-white">Revisar pendência</h2>
                <p className="mt-0.5 text-[11px] leading-4 text-gray-400">
                  Corrija os dados antes de movimentar o saldo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReview(null)}
                className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-gray-50 text-gray-400 dark:bg-slate-800"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-gray-400">Descrição</span>
                <input
                  value={review.description}
                  onChange={(e) => setReview({ ...review, description: e.target.value })}
                  className="h-12 w-full rounded-[17px] border border-gray-200 bg-gray-50 px-3.5 text-[13px] font-semibold text-gray-800 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-gray-400">Valor</span>
                  <div className="relative">
                    <CircleDollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      inputMode="decimal"
                      value={review.amount}
                      onChange={(e) => setReview({ ...review, amount: e.target.value })}
                      className="h-12 w-full min-w-0 rounded-[17px] border border-gray-200 bg-gray-50 pl-9 pr-3 text-[13px] font-black text-gray-800 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                    />
                  </div>
                </label>

                <label className="block min-w-0">
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-gray-400">Data</span>
                  <div className="relative">
                    <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={review.date}
                      onChange={(e) => setReview({ ...review, date: e.target.value })}
                      className="h-12 w-full min-w-0 rounded-[17px] border border-gray-200 bg-gray-50 pl-9 pr-2 text-[12px] font-bold text-gray-800 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                    />
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-gray-400">Conta</span>
                <div className="relative">
                  <Landmark size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={review.account_id}
                    onChange={(e) => setReview({ ...review, account_id: e.target.value })}
                    className="h-12 w-full appearance-none rounded-[17px] border border-gray-200 bg-gray-50 pl-9 pr-8 text-[12px] font-bold text-gray-800 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                  >
                    <option value="">Escolha uma conta</option>
                    {accounts.map((account: any) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-gray-400">Categoria</span>
                <div className="relative">
                  <WalletCards size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={review.category_id}
                    onChange={(e) => setReview({ ...review, category_id: e.target.value })}
                    className="h-12 w-full appearance-none rounded-[17px] border border-gray-200 bg-gray-50 pl-9 pr-8 text-[12px] font-bold text-gray-800 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                  >
                    <option value="">Sem categoria</option>
                    {categories
                      .filter((category: any) => category.type === (review.type === 'income' ? 'income' : 'expense'))
                      .map((category: any) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                  </select>
                </div>
              </label>
            </div>

            <div className="sticky bottom-0 mt-5 grid grid-cols-2 gap-3 bg-white pb-1 pt-2 dark:bg-slate-900">
              <button
                type="button"
                disabled={Boolean(processingId)}
                onClick={() => setReview(null)}
                className="h-12 rounded-[18px] bg-gray-100 text-[12px] font-black text-gray-600 disabled:opacity-50 dark:bg-slate-800 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(processingId)}
                onClick={() => void saveReview()}
                className="flex h-12 items-center justify-center gap-2 rounded-[18px] bg-teal-600 text-[12px] font-black text-white disabled:opacity-50"
              >
                <Check size={15} /> {processingId ? 'Salvando…' : 'Salvar revisão'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
