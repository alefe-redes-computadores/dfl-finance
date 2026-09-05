// src/app/(app)/conciliation/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  CheckCircle2,
  FileSearch,
  ListChecks,
  Pencil,
  RefreshCcw,
  WalletCards,
} from 'lucide-react'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useConciQueue } from '@/hooks/useConciQueue'
import { ConciCard } from '@/components/conciliation/ConciCard'
import { ConciProgress } from '@/components/conciliation/ConciProgress'
import { ConciSummary } from '@/components/conciliation/ConciSummary'
import Skeleton from '@/components/Skeleton'

function safeNum(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function ConciliationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const { safeUpdate } = useSafeDb()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const [processing, setProcessing] = useState(false)

  const {
    queue,
    current,
    currentIndex,
    total,
    approved,
    rejected,
    pending,
    processed,
    hydrated,
    isComplete,
    approve,
    reject,
    skip,
    reset,
    clear,
  } = useConciQueue()

  const data = useLiveQuery(async () => {
    if (!user?.id) return { transactions: [], accounts: [] }

    const [transactions, accounts] = await Promise.all([
      db.transactions.where('user_id').equals(user.id).toArray(),
      db.accounts.where('user_id').equals(user.id).toArray(),
    ])

    return {
      transactions: transactions.filter((item: any) =>
        item.context === effectiveContext && item.status === 'pending'
      ),
      accounts: accounts.filter((item: any) => item.context === effectiveContext),
    }
  }, [user?.id, effectiveContext])

  const pendingTransactions = data?.transactions ?? []
  const accounts = data?.accounts ?? []
  const loading = !hydrated || data === undefined

  const accountMap = useMemo(
    () => new Map(accounts.map((account: any) => [account.id, account])),
    [accounts]
  )

  useEffect(() => {
    if (!hydrated || !user?.id || data === undefined) return
    if (queue.length > 0 || pendingTransactions.length === 0) return

    reset(
      pendingTransactions.map((tx: any) => ({
        date: tx.date,
        description: tx.description || 'Transação sem descrição',
        amount: safeNum(tx.amount),
        type: tx.type === 'income' ? 'income' : 'expense',
        accountName: tx.account_id ? accountMap.get(tx.account_id)?.name : undefined,
        accountId: tx.account_id || undefined,
        context: tx.context,
        source: 'manual' as const,
        originalData: {
          id: tx.id,
          account_id: tx.account_id || null,
          credit_card_id: tx.credit_card_id || null,
        },
      }))
    )
  }, [hydrated, user?.id, data, queue.length, pendingTransactions, accountMap, reset])

  const sourceTransactionId = current?.originalData?.id as string | undefined

  const handleConciliate = async () => {
    if (!user?.id || !current || !sourceTransactionId || processing) return

    setProcessing(true)

    try {
      const tx = await db.transactions.get(sourceTransactionId)

      if (!tx) {
        approve()
        showToast('Esta pendência não existe mais e foi removida da revisão.', 'warning')
        return
      }

      if (tx.user_id !== user.id) {
        throw new Error('A transação pertence a outro usuário.')
      }

      if (tx.status !== 'pending') {
        approve()
        showToast('Esta transação já foi concluída.', 'success')
        return
      }

      if (!tx.account_id) {
        errorHaptic()
        showToast('Escolha uma conta para concluir esta pendência.', 'warning')
        router.push(`/transactions/details?id=${tx.id}`)
        return
      }

      const account = await db.accounts.get(tx.account_id)
      if (!account || account.user_id !== user.id) {
        throw new Error('A conta vinculada não foi encontrada.')
      }

      const currentBalance = safeNum(account.balance)
      const amount = safeNum(tx.amount)
      const nextBalance = tx.type === 'income'
        ? currentBalance + amount
        : currentBalance - amount

      await db.transaction('rw', db.accounts, db.transactions, db.syncQueue, async () => {
        const accountResult = await safeUpdate('accounts', account.id, {
          balance: nextBalance,
          updated_at: new Date().toISOString(),
        })

        if (!accountResult.success) {
          throw new Error(accountResult.error || 'Não foi possível atualizar o saldo da conta.')
        }

        const txResult = await safeUpdate('transactions', tx.id, {
          status: 'done',
          updated_at: new Date().toISOString(),
        })

        if (!txResult.success) {
          throw new Error(txResult.error || 'Não foi possível concluir a transação.')
        }
      })

      approve()
      success()
      showToast(tx.type === 'income' ? 'Recebimento conciliado' : 'Pagamento conciliado', 'success')
    } catch (err: any) {
      errorHaptic()
      showToast(err?.message || 'Não foi possível conciliar esta pendência.', 'error')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = () => {
    if (!current || processing) return
    vibrate([10])
    reject()
    showToast('Pendência adiada nesta revisão', 'info')
  }

  const handleReset = () => {
    clear()
    reset(
      pendingTransactions.map((tx: any) => ({
        date: tx.date,
        description: tx.description || 'Transação sem descrição',
        amount: safeNum(tx.amount),
        type: tx.type === 'income' ? 'income' : 'expense',
        accountName: tx.account_id ? accountMap.get(tx.account_id)?.name : undefined,
        accountId: tx.account_id || undefined,
        context: tx.context,
        source: 'manual' as const,
        originalData: { id: tx.id, account_id: tx.account_id || null },
      }))
    )
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 px-4 pt-6">
        <Skeleton count={6} />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 pb-28 transition-colors">
      <header className="sticky top-0 z-30 bg-[#f6f7f8]/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-black/5 dark:border-white/5 px-4 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => router.push('/more')} className="h-10 w-10 rounded-[16px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <h1 className="text-[18px] font-bold text-gray-900 dark:text-white">Conciliação</h1>
            <p className="text-[11px] font-medium text-gray-400">Revisão de valores a pagar e a receber</p>
          </div>
          <button onClick={handleReset} disabled={pendingTransactions.length === 0 || processing} className="h-10 w-10 rounded-[16px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 disabled:opacity-40 active:scale-95 transition-transform">
            <RefreshCcw size={18} />
          </button>
        </div>
      </header>

      <main className="px-4 pt-5 space-y-4">
        <section className="rounded-[28px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.13em] font-bold text-gray-400">Pendências reais</p>
              <p className="mt-2 text-[28px] leading-none font-black text-gray-900 dark:text-white">{pendingTransactions.length}</p>
              <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">Transações pendentes no contexto atual.</p>
            </div>
            <div className="w-12 h-12 rounded-[18px] bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center">
              <ListChecks size={21} className="text-sky-600 dark:text-sky-400" />
            </div>
          </div>
        </section>

        {queue.length > 0 && !isComplete && (
          <ConciProgress
            current={Math.min(processed + 1, total)}
            total={total}
            approved={approved}
            rejected={rejected}
          />
        )}

        {isComplete ? (
          <ConciSummary
            total={total}
            approved={approved}
            rejected={rejected}
            onReset={handleReset}
            onFinish={() => clear()}
          />
        ) : current ? (
          <>
            <ConciCard
              transaction={current}
              onApprove={() => void handleConciliate()}
              onReject={handleReject}
              onTap={() => {
                if (sourceTransactionId) router.push(`/transactions/details?id=${sourceTransactionId}`)
              }}
              isLast={pending <= 1}
              isLoading={processing}
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => sourceTransactionId && router.push(`/transactions/details?id=${sourceTransactionId}`)}
                className="h-12 rounded-[18px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 text-gray-700 dark:text-gray-300 font-bold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Pencil size={16} /> Editar antes
              </button>
              <button
                onClick={skip}
                className="h-12 rounded-[18px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 text-gray-700 dark:text-gray-300 font-bold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <FileSearch size={16} /> Ver depois
              </button>
            </div>

            {!current.accountId && (
              <div className="rounded-[22px] bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-4 flex gap-3">
                <WalletCards size={19} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-bold text-amber-800 dark:text-amber-300">Conta necessária para concluir</p>
                  <p className="mt-1 text-[12px] leading-5 text-amber-700/80 dark:text-amber-300/70">Pendências podem existir sem conta. Ao conciliar, escolha a conta que receberá o impacto no saldo.</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <section className="rounded-[30px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 p-7 text-center">
            <div className="w-16 h-16 rounded-[22px] bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={29} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-[19px] font-black text-gray-900 dark:text-white">Nada para conciliar</h2>
            <p className="mt-2 text-[13px] leading-5 text-gray-500 dark:text-gray-400">Não há valores pendentes neste contexto. Novas contas a pagar ou receber aparecerão aqui automaticamente.</p>
            <button onClick={() => router.push('/transactions/new')} className="mt-5 h-12 px-5 rounded-[18px] bg-teal-600 hover:bg-teal-700 text-white font-bold text-[14px] active:scale-[0.98] transition-transform">
              Nova transação
            </button>
          </section>
        )}
      </main>
    </div>
  )
}
