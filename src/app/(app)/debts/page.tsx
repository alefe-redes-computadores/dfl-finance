'use client'


import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { Plus, Users, Wallet, RefreshCw, AlertTriangle, Clock, Check, ChevronLeft } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useDebtsList } from '@/hooks/useDebtsList' // ✅ HOOK ESPECÍFICO
import { useLocalData } from '@/hooks/useLocalData'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import Skeleton from '@/components/Skeleton'

function DebtsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context, effectiveContext } = useContext_()
  const { success: hapticSuccess, error: hapticError, vibrate } = useHapticFeedback()

  const [filter, setFilter] = useState<'active' | 'paid'>('active')
  const [refreshing, setRefreshing] = useState(false)

  // ✅ HOOK ESPECÍFICO DE LISTAGEM
  const { data: localDebts, loading: debtsLoading } = useDebtsList(effectiveContext)

  // ✅ TRANSAÇÕES ainda vêm via useLocalData para calcular pagamentos
  const { data: localTransactions, loading: transactionsLoading } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext, type: 'income' },
  })

  const loading = debtsLoading || transactionsLoading || !user?.id || !context

  const debts = useMemo(() => {
    if (!localDebts || !localTransactions) return []

    const paymentsByDebt: Record<string, number> = {}

    localTransactions.forEach((tx: any) => {
      if (tx.debt_id) {
        paymentsByDebt[tx.debt_id] = (paymentsByDebt[tx.debt_id] || 0) + Number(tx.amount || 0)
      }
    })

    let filtered = localDebts

    if (filter === 'active') {
      filtered = localDebts.filter((d: any) => {
        const total = Number(d.total_amount) || 0
        const paid = paymentsByDebt[d.id] || 0
        const isEffectivelyPaid = total > 0 && paid >= total
        return !isEffectivelyPaid && d.status !== 'cancelled'
      })
    } else {
      filtered = localDebts.filter((d: any) => {
        const total = Number(d.total_amount) || 0
        const paid = paymentsByDebt[d.id] || 0
        const isEffectivelyPaid = total > 0 && paid >= total
        return isEffectivelyPaid || d.status === 'paid'
      })
    }

    return filtered.map((debt: any) => {
      const paid = paymentsByDebt[debt.id] || 0
      const total = Number(debt.total_amount) || 0

      return {
        ...debt,
        paid_amount: paid,
        percent: Math.min(total > 0 ? (paid / total) * 100 : 0, 100),
        status: total > 0 && paid >= total ? 'paid' : debt.status,
      }
    })
  }, [localDebts, localTransactions, filter])

  const totalToReceiveState = useMemo(() => {
    return debts
      .filter((d: any) => {
        const totalVal = Number(d.total_amount) || 0
        const paid = d.paid_amount || 0
        return totalVal > 0 && paid < totalVal
      })
      .reduce((sum: number, d: any) => {
        return sum + (Number(d.total_amount) - (d.paid_amount || 0))
      }, 0)
  }, [debts])

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || loading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return

    if (e.touches[0].clientY - pullStartY.current > 60) {
      setRefreshing(true)
      isPulling.current = false
      vibrate(10)

      setTimeout(() => {
        setRefreshing(false)
      }, 500)
    }
  }

  const handleTouchEnd = () => {
    isPulling.current = false
  }

  useEffect(() => {
    const c = containerRef.current
    if (!c) return

    c.addEventListener('touchstart', handleTouchStart, { passive: true })
    c.addEventListener('touchmove', handleTouchMove, { passive: true })
    c.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      c.removeEventListener('touchstart', handleTouchStart)
      c.removeEventListener('touchmove', handleTouchMove)
      c.removeEventListener('touchend', handleTouchEnd)
    }
  }, [loading, refreshing, vibrate])

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  return (
    <div
      ref={containerRef}
      className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300"
    >
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  vibrate(5)
                  router.push('/more')
                }}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Quem me deve
                </h1>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Controle de valores a receber
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                vibrate(10)
                router.push('/debts/new')
              }}
              className="h-11 w-11 rounded-[18px] bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] shrink-0"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <ContextToggle />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <div className="w-10 h-10 rounded-[16px] bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-3">
              <Wallet size={18} className="text-orange-600 dark:text-orange-400" />
            </div>
            <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1">
              A receber
            </p>
            <p className="text-[20px] font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {formatCurrency(totalToReceiveState)}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <div className="w-10 h-10 rounded-[16px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center mb-3">
              <Users size={18} className="text-teal-600 dark:text-teal-400" />
            </div>
            <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1">
              Pessoas
            </p>
            <p className="text-[20px] font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {debts.length}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-1.5 mb-4">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                vibrate(5)
                setFilter('active')
              }}
              className={`flex-1 h-10 rounded-[18px] text-[13px] font-semibold transition-all active:scale-[0.98] ${
                filter === 'active'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              Pendentes
            </button>

            <button
              type="button"
              onClick={() => {
                vibrate(5)
                setFilter('paid')
              }}
              className={`flex-1 h-10 rounded-[18px] text-[13px] font-semibold transition-all active:scale-[0.98] ${
                filter === 'paid'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              Pagos
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton count={3} height="112px" borderRadius="24px" />
          </div>
        ) : debts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <Users size={28} className="opacity-30 text-gray-500" />
            </div>
            <h3 className="font-semibold text-[16px] text-gray-800 dark:text-gray-100 mb-1">
              Nenhum registro
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-[12px] mb-5 max-w-[250px]">
              {filter === 'paid'
                ? 'Nenhuma dívida foi paga ainda.'
                : 'Registre empréstimos para acompanhar quem te deve.'}
            </p>
            <button
              type="button"
              onClick={() => {
                vibrate(10)
                router.push('/debts/new')
              }}
              className="bg-teal-600 text-white px-8 py-3.5 rounded-[20px] font-bold text-[14px] hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20 active:scale-[0.98]"
            >
              Novo empréstimo
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 animate-in fade-in duration-500">
            {debts.map((debt: any) => {
              const IconComp = getDynamicIcon(debt.icon || 'user')
              const isPaid = debt.status === 'paid'
              const remaining = Number(debt.total_amount) - (debt.paid_amount || 0)
              const daysUntilDue = debt.due_date
                ? differenceInDays(new Date(debt.due_date), new Date())
                : null
              const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && !isPaid
              const isNearDue = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7 && !isPaid

              return (
                <div
                  key={debt.id}
                  onClick={() => {
                    vibrate(5)
                    router.push(`/debts/details?id=${encodeURIComponent(debt.id)}`)
                  }}
                  className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2 cursor-pointer"
                >
                  <div className="rounded-[18px] p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 shadow-sm"
                          style={{ backgroundColor: `${debt.color}15`, color: debt.color }}
                        >
                          <IconComp size={18} />
                        </div>

                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {debt.person_name}
                          </p>
                          {debt.description && (
                            <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                              {debt.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <Check size={10} /> Pago
                          </span>
                        )}
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                            <AlertTriangle size={10} /> Atrasado {Math.abs(daysUntilDue)}d
                          </span>
                        )}
                        {isNearDue && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 text-[11px] font-medium text-orange-600 dark:text-orange-400">
                            <Clock size={10} /> Vence em {daysUntilDue}d
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-full bg-gray-100 dark:bg-slate-700/60 rounded-full h-2.5 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          isPaid
                            ? 'bg-emerald-500'
                            : isOverdue
                            ? 'bg-red-500'
                            : isNearDue
                            ? 'bg-orange-500'
                            : 'bg-teal-500'
                        }`}
                        style={{ width: `${Math.min(debt.percent, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 text-[12px]">
                      <span
                        className={`truncate ${
                          isOverdue
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {isPaid ? 'Total pago' : `Falta ${formatCurrency(Math.max(remaining, 0))}`}
                      </span>

                      <span className="shrink-0 text-gray-400 dark:text-gray-500">
                        {debt.percent.toFixed(0)}% • {formatCurrency(Number(debt.total_amount))}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DebtsPage() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900" />
  }

  return (
    <ContextProvider>
      <DebtsContent />
    </ContextProvider>
  )
}