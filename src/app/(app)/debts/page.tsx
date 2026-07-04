'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Plus, Users, Wallet, RefreshCw, AlertTriangle, Clock, Check, TrendingUp, ChevronLeft } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
// 🔥 NOVO: Import do hook local
import { useLocalData } from '@/hooks/useLocalData'

// ============================================================
// SKELETON LOADER
// ============================================================
const DebtsSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
        <div className="h-3 w-14 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
        <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
        <div className="h-3 w-14 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
        <div className="h-5 w-10 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
    </div>

    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
          </div>
          <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
          <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-1/2" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
          <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    ))}
  </div>
)

function DebtsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const [filter, setFilter] = useState<'active' | 'paid'>('active')
  const [totalToReceive, setTotalToReceive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // ============================================================
  // 🔥 BUSCAS LOCAIS (INDEXEDDB)
  // ============================================================
  const { data: localDebts, loading: debtsLoading, syncing: debtsSyncing, reload: reloadDebts } = useLocalData({
    table: 'debts',
    filters: { context },
    realtime: true,
  })

  const { data: localTransactions, loading: txLoading, syncing: txSyncing, reload: reloadTransactions } = useLocalData({
    table: 'transactions',
    filters: { context, type: 'income' }, // Só receitas (pagamentos)
    realtime: true,
  })

  // ============================================================
  // 🔥 JOIN EM MEMÓRIA (DÍVIDAS + PAGAMENTOS)
  // ============================================================
  const consolidateDebts = useCallback(() => {
    if (!localDebts || !localTransactions) return []

    // 🔥 1. Agrupa pagamentos por debt_id
    const paymentsByDebt: Record<string, number> = {}
    localTransactions.forEach((tx: any) => {
      if (tx.debt_id) {
        paymentsByDebt[tx.debt_id] = (paymentsByDebt[tx.debt_id] || 0) + Number(tx.amount || 0)
      }
    })

    // 🔥 2. Filtra dívidas pelo status (ativo/pago)
    let filteredDebts = localDebts
    if (filter === 'active') {
      filteredDebts = localDebts.filter((d: any) => d.status !== 'paid' && d.status !== 'cancelled')
    } else {
      filteredDebts = localDebts.filter((d: any) => d.status === 'paid')
    }

    // 🔥 3. Constrói o array com progresso
    return filteredDebts.map((debt: any) => {
      const paidAmount = paymentsByDebt[debt.id] || 0
      const totalAmount = Number(debt.total_amount) || 0
      const percent = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0

      return {
        ...debt,
        paid_amount: paidAmount,
        percent: Math.min(percent, 100),
      }
    })
  }, [localDebts, localTransactions, filter])

  // ============================================================
  // LOAD DATA (REFATORADO PARA USAR DADOS LOCAIS)
  // ============================================================
  const loadDebts = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
      // Recarrega dados do IndexedDB (já estão em background)
      await Promise.all([reloadDebts(), reloadTransactions()])

      // Os dados já estão disponíveis via localDebts e localTransactions
      // O consolidateDebts() será chamado no useEffect abaixo
    } catch (err) {
      console.error('Erro ao carregar dívidas:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [user?.id, reloadDebts, reloadTransactions])

  // ============================================================
  // EFETTOS
  // ============================================================
  useEffect(() => {
    if (user?.id && context) {
      loadDebts()
    }
  }, [user?.id, context, filter, loadDebts])

  // 🔥 Atualiza a lista consolidada sempre que os dados locais mudarem
  const [debts, setDebts] = useState<any[]>([])
  const [totalToReceiveState, setTotalToReceiveState] = useState(0)

  useEffect(() => {
    if (localDebts && localTransactions) {
      const consolidated = consolidateDebts()
      setDebts(consolidated)

      // Calcula total a receber (apenas ativos)
      const total = consolidated
        .filter((d: any) => d.status !== 'paid' && d.status !== 'cancelled')
        .reduce((sum: number, d: any) => sum + (Number(d.total_amount) - (d.paid_amount || 0)), 0)
      setTotalToReceiveState(total)
    }
  }, [localDebts, localTransactions, filter, consolidateDebts])

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
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
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      loadDebts().finally(() => setRefreshing(false))
    }
  }

  const handleTouchEnd = () => {
    isPulling.current = false
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [loading, refreshing])

  // ============================================================
  // FUNÇÕES AUXILIARES
  // ============================================================
  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {/* 🔵 Bolinha de carregamento sutil */}
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* ❌ REMOVIDO: Toast de "Atualizando..." */}

      {/* ============================================================
          HEADER
          ============================================================ */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">
            Quem me deve
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <ContextToggle />
          <button
            onClick={() => router.push('/debts/new')}
            className="w-9 h-9 bg-teal-700 dark:bg-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-700/20 active:scale-90 transition-transform"
          >
            <Plus size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
          <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-2">
            <Wallet size={16} className="text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">A receber</p>
          <p className="text-[15px] font-bold text-orange-600">{formatCurrency(totalToReceiveState)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
          <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
            <Users size={16} className="text-teal-700 dark:text-teal-400" />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Pessoas</p>
          <p className="text-[15px] font-bold text-teal-700 dark:text-teal-400">{debts.length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 p-1 rounded-full mb-6">
        <button
          onClick={() => setFilter('active')}
          className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all ${filter === 'active' ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400 dark:text-gray-500'}`}
        >
          Pendentes
        </button>
        <button
          onClick={() => setFilter('paid')}
          className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all ${filter === 'paid' ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400 dark:text-gray-500'}`}
        >
          Pagos
        </button>
      </div>

      {/* Lista de dívidas */}
      {loading ? (
        <DebtsSkeleton />
      ) : debts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Users size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhum registro</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            {filter === 'paid' ? 'Nenhuma dívida foi paga ainda.' : 'Registre empréstimos para acompanhar quem te deve.'}
          </p>
          <button
            onClick={() => router.push('/debts/new')}
            className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors"
          >
            Novo empréstimo
          </button>
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in duration-300">
          {debts.map(debt => {
            const IconComp = getDynamicIcon(debt.icon || 'user')
            const isPaid = debt.status === 'paid'
            const remaining = Number(debt.total_amount) - (debt.paid_amount || 0)
            const daysUntilDue = debt.due_date ? differenceInDays(new Date(debt.due_date), new Date()) : null
            const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && !isPaid
            const isNearDue = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7 && !isPaid

            return (
              <div
                key={debt.id}
                onClick={() => router.push(`/debts/${debt.id}`)}
                className={`bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98] ${
                  isPaid 
                    ? 'border-emerald-200 dark:border-emerald-800' 
                    : isOverdue 
                      ? 'border-red-200 dark:border-red-800' 
                      : 'border-gray-50 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${debt.color}20`, color: debt.color }}>
                      <IconComp size={18} />
                    </div>
                    <div>
                      <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{debt.person_name}</span>
                      {debt.description && <p className="text-[11px] text-gray-400 dark:text-gray-500">{debt.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isPaid && <Check size={14} className="text-emerald-500" />}
                    {isOverdue && <AlertTriangle size={14} className="text-red-500" />}
                    {isNearDue && <Clock size={14} className="text-orange-500" />}
                    <span className={`text-[11px] font-bold ${
                      isPaid 
                        ? 'text-emerald-600' 
                        : isOverdue 
                          ? 'text-red-500' 
                          : isNearDue 
                            ? 'text-orange-500' 
                            : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {isPaid 
                        ? 'Pago' 
                        : isOverdue 
                          ? `Atrasado ${Math.abs(daysUntilDue)} dia(s)` 
                          : isNearDue 
                            ? `Vence em ${daysUntilDue} dia(s)` 
                            : ''}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      isPaid ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : isNearDue ? 'bg-orange-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${Math.min(debt.percent, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px]">
                  <span className={`font-medium ${isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                    {isPaid ? 'Total pago' : `Falta ${formatCurrency(Math.max(remaining, 0))}`}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 font-medium">
                    {debt.percent.toFixed(0)}% • {formatCurrency(Number(debt.total_amount))}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function DebtsPage() {
  return (
    <ContextProvider>
      <DebtsContent />
    </ContextProvider>
  )
}