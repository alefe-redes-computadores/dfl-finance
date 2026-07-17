'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Plus,
  Tag, MoreHorizontal,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useBudgetsList } from '@/hooks/useBudgetsList'
import { useLocalData } from '@/hooks/useLocalData'
import { db } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

const BudgetsSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2">
        <div className="rounded-[18px] p-3">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-[14px] bg-gray-200 dark:bg-slate-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
            <div className="text-right">
              <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-12 bg-gray-100 dark:bg-slate-700/50 rounded mt-1" />
            </div>
          </div>
          <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
            <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
          </div>
          <div className="flex justify-between">
            <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
            <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

function BudgetsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { effectiveContext } = useContext_()
  const { showToast } = useToast()
  const { safeDelete, safeUpdate } = useSafeDb()
  const { success: hapticSuccess, error: hapticError, vibrate } = useHapticFeedback()

  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // ✅ 1. TODOS OS HOOKS NO TOPO
  const { data: localBudgets, loading: budgetsLoading } = useBudgetsList(effectiveContext)

  // ✅ 2. USA useLocalData APENAS PARA TRANSAÇÕES (não para budgets)
  const { data: localTransactions, loading: txLoading } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext },
  })

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user?.id) {
      setIsAuthLoading(false)
    }
  }, [user?.id])

  // ✅ 3. useMemo PARA DADOS DERIVADOS (não useState espelho)
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

  // ✅ 4. FUNÇÕES DE AÇÃO
  const handleDelete = async (id: string) => {
    if (!user) return
    if (!confirm('Excluir este orçamento?')) return
    try {
      await db.transaction('rw', db.budgets, db.syncQueue, async () => {
        const result = await safeDelete('budgets', id)
        if (!result.success) throw new Error(result.error || 'Erro desconhecido')
      })
      hapticSuccess()
      showToast('✅ Orçamento excluído!', 'success')
    } catch (err: any) {
      hapticError()
      showToast(`❌ Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const handleToggleStatus = async (budget: any) => {
    if (!user) return
    try {
      const newStatus = budget.status === 'active' ? 'inactive' : 'active'
      const payload = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }
      await db.transaction('rw', db.budgets, db.syncQueue, async () => {
        const result = await safeUpdate('budgets', budget.id, payload)
        if (!result.success) throw new Error(result.error || 'Erro desconhecido')
      })
      vibrate([20])
      showToast(`✅ Orçamento ${newStatus === 'active' ? 'ativado' : 'desativado'}!`, 'success')
    } catch (err: any) {
      hapticError()
      showToast(`❌ Erro: ${err.message}`, 'error')
    }
  }

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // ✅ 5. LOADING UNIFICADO
  const isDataLoading = budgetsLoading || txLoading || isAuthLoading

  // ✅ 6. RETURNS CONDICIONAIS (depois dos hooks)
  return (
    <div
      ref={containerRef}
      className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-4 transition-colors duration-300"
    >
      {isDataLoading && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {/* HEADER UNIFICADO */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => router.push('/more')}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h2 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Orçamentos
                </h2>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Controle por categoria
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push('/budgets/new')}
              className="h-11 w-11 rounded-[18px] bg-teal-700 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 hover:bg-teal-800 transition-all active:scale-[0.98] shrink-0"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <ContextToggle />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 px-2 py-1">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              className="h-9 w-9 rounded-[14px] flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
            >
              ‹
            </button>

            <span className="flex-1 text-center text-[13px] font-semibold text-gray-700 dark:text-gray-300 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>

            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              className="h-9 w-9 rounded-[14px] flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="pt-3">
        {isDataLoading ? (
          <BudgetsSkeleton />
        ) : budgetsWithSpent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <Tag size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="font-semibold text-[16px] text-gray-800 dark:text-gray-100 mb-1">
              Nenhum orçamento
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-[12px] mb-5 max-w-[250px]">
              Crie orçamentos para controlar seus gastos por categoria.
            </p>
            <button
              onClick={() => router.push('/budgets/new')}
              className="bg-teal-700 text-white px-6 py-3.5 rounded-[20px] font-bold text-[14px] hover:bg-teal-800 transition-colors shadow-lg shadow-teal-600/20 active:scale-[0.98]"
            >
              Criar orçamento
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 animate-in fade-in duration-300">
            {budgetsWithSpent.map((budget: any) => {
              const IconComp = getDynamicIcon(budget.icon || 'tag')
              const isActive = budget.status !== 'inactive'
              const isWarning = budget.percent >= 80 && budget.remaining >= 0
              const isOver = budget.remaining < 0

              return (
                <div
                  key={budget.id}
                  className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2"
                >
                  <div className="rounded-[18px] p-3">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${budget.color}20`, color: budget.color }}
                        >
                          <IconComp size={18} />
                        </div>

                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {budget.name}
                          </p>
                          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                            {budget.categories?.name || 'Geral'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(budget.spent)}
                        </p>
                        <p className="text-[12px] text-gray-400 dark:text-gray-500">
                          de {formatCurrency(Number(budget.amount))}
                        </p>
                      </div>
                    </div>

                    <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isOver ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-teal-500'
                        }`}
                        style={{ width: `${Math.min(budget.percent, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`text-[12px] font-medium ${
                          isOver
                            ? 'text-red-500'
                            : isWarning
                            ? 'text-orange-500'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {isOver
                          ? `Estourado ${formatCurrency(Math.abs(budget.remaining))}`
                          : `Restam ${formatCurrency(budget.remaining)}`}
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleStatus(budget)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors active:scale-[0.98] ${
                            isActive
                              ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {isActive ? 'Ativo' : 'Inativo'}
                        </button>

                        <button
                          onClick={() => router.push(`/budgets/details?id=${budget.id}`)}
                          className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-teal-600 dark:hover:text-teal-400 transition-colors active:scale-[0.98]"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
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

export default function BudgetsPage() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])
  if (!isClient) return <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900" />

  return (
    <ContextProvider>
      <BudgetsContent />
    </ContextProvider>
  )
}