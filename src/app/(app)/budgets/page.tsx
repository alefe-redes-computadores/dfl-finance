'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Plus, Loader2, RefreshCw, 
  AlertTriangle, CheckCircle, Clock, Tag, MoreHorizontal,
  Eye, EyeOff, Settings2
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'

// ============================================================
// SKELETON LOADER
// ============================================================
const BudgetsSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
          <div className="h-6 w-16 bg-gray-200 dark:bg-slate-700 rounded-full" />
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
          <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    ))}
  </div>
)

function BudgetsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // ============================================================
  // 🔥 BUSCAS LOCAIS (INDEXEDDB)
  // ============================================================
  const { data: localBudgets, loading: budgetsLoading, reload: reloadBudgets } = useLocalData({
    table: 'budgets' as any,
    filters: { context },
    orderBy: { field: 'name', direction: 'asc' },
    realtime: true,
  })

  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions',
    filters: { context },
    realtime: true,
  })

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
      loadData().finally(() => setRefreshing(false))
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
  // LOAD DATA
  // ============================================================
  const loadData = async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)
    try {
      await Promise.all([reloadBudgets(), reloadTransactions()])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id, context])

  // ============================================================
  // PROCESSAMENTO EM MEMÓRIA
  // ============================================================
  const monthStart = format(currentMonth, 'yyyy-MM-01')
  const monthEnd = format(currentMonth, 'yyyy-MM-31')

  const budgetsWithSpent = (localBudgets || []).map((budget: any) => {
    const spent = (localTransactions || [])
      .filter((tx: any) => 
        tx.category_id === budget.category_id &&
        (tx.type === 'expense' || tx.type === 'sangria') &&
        tx.status === 'done' &&
        tx.date >= monthStart &&
        tx.date <= monthEnd
      )
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)

    const remaining = Number(budget.amount) - spent
    const percent = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0

    return {
      ...budget,
      spent,
      remaining,
      percent: Math.min(percent, 100)
    }
  })

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este orçamento?')) return
    try {
      const { remove } = useLocalData({ table: 'budgets' as any })
      await remove(id)
      showToast('Orçamento excluído.', 'info')
      loadData()
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const handleToggleStatus = async (budget: any) => {
    try {
      const { update } = useLocalData({ table: 'budgets' as any })
      const newStatus = budget.status === 'active' ? 'inactive' : 'active'
      await update(budget.id, { status: newStatus })
      showToast(`Orçamento ${newStatus === 'active' ? 'ativado' : 'desativado'}!`, 'success')
      loadData()
    } catch (err: any) {
      showToast(`Erro: ${err.message}`, 'error')
    }
  }

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Orçamentos</h2>
        </div>
        <button onClick={() => router.push('/budgets/new')} className="w-9 h-9 bg-teal-700 rounded-full flex items-center justify-center shadow-lg shadow-teal-700/20 active:scale-90 transition-transform">
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <div className="mb-4">
        <ContextToggle />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">‹</button>
        <span className="font-bold text-sm text-gray-700 dark:text-gray-300 flex-1 text-center">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</span>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">›</button>
      </div>

      {loading ? (
        <BudgetsSkeleton />
      ) : budgetsWithSpent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Tag size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhum orçamento</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            Crie orçamentos para controlar seus gastos por categoria.
          </p>
          <button onClick={() => router.push('/budgets/new')} className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors">
            Criar orçamento
          </button>
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in duration-300">
          {budgetsWithSpent.map((budget: any) => {
            const IconComp = getDynamicIcon(budget.icon || 'tag')
            const isActive = budget.status !== 'inactive'
            const isWarning = budget.percent >= 80 && budget.remaining >= 0
            const isOver = budget.remaining < 0
            const isSafe = !isWarning && !isOver

            return (
              <div key={budget.id} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${budget.color}20`, color: budget.color }}>
                      <IconComp size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{budget.name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{budget.categories?.name || 'Geral'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{formatCurrency(budget.spent)}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">de {formatCurrency(Number(budget.amount))}</p>
                  </div>
                </div>

                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-1.5">
                  <div className={`h-full rounded-full transition-all duration-700 ${isOver ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(budget.percent, 100)}%` }} />
                </div>

                <div className="flex justify-between items-center">
                  <span className={`text-[11px] font-bold ${isOver ? 'text-red-500' : isWarning ? 'text-orange-500' : 'text-teal-600'}`}>
                    {isOver ? `Estourado ${formatCurrency(Math.abs(budget.remaining))}` : `Restam ${formatCurrency(budget.remaining)}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggleStatus(budget)} className="text-xs text-gray-400 hover:text-teal-600 transition-colors">
                      {isActive ? 'Ativo' : 'Inativo'}
                    </button>
                    <button onClick={() => router.push(`/budgets/${budget.id}`)} className="text-gray-400 hover:text-teal-600 transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function BudgetsPage() {
  return (
    <ContextProvider>
      <BudgetsContent />
    </ContextProvider>
  )
}