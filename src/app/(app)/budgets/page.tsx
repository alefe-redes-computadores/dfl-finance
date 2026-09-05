'use client'



import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Plus,
  Tag, Edit2,  
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  calculateBudgetMetrics,
  getBudgetPeriodName,
  buildBudgetTransactionIndex,
  getBudgetCandidateTransactions,
} from '@/lib/budgetOperations'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useBudgetsList } from '@/hooks/useBudgetsList'
import { useLocalData } from '@/hooks/useLocalData'

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
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const { data: localBudgets, loading: budgetsLoading } = useBudgetsList(effectiveContext)
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

  const budgetTransactionIndex = useMemo(
    () => buildBudgetTransactionIndex(localTransactions),
    [localTransactions]
  )

  const budgetsWithSpent = (localBudgets || []).map(
    (budget: any) => {
      const metrics = calculateBudgetMetrics({
        budget,
        transactions: getBudgetCandidateTransactions(budget, localTransactions, budgetTransactionIndex) || [],
        referenceDate: currentMonth,
      })

      return {
        ...budget,
        ...metrics,
      }
    }
  )

  // ✅ NAVEGAÇÃO: CARD → DETALHES
  const goToDetails = (budgetId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!budgetId) {
      console.warn('[BudgetsList] ID inválido:', budgetId)
      return
    }
    router.push(`/budgets/details?id=${budgetId}`)
  }

  // ✅ NAVEGAÇÃO: LÁPIS → EDIÇÃO
  const goToEdit = (budgetId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!budgetId) {
      console.warn('[BudgetsList] ID inválido para edição:', budgetId)
      return
    }
    router.push(`/budgets/new?edit=${budgetId}`)
  }

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const isDataLoading = budgetsLoading || txLoading || isAuthLoading

  return (
    <div
      ref={containerRef}
      className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-950 pb-28 font-sans px-4 pt-2 transition-colors duration-300"
    >
      {isDataLoading && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      <div className="sticky top-0 z-30 -mx-4 bg-[#f8f9fa]/94 px-4 pb-3 backdrop-blur-xl dark:bg-slate-950/94">
        <div className="flex items-center justify-between gap-3 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              onClick={() => router.push('/more')}
              aria-label="Voltar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-gray-200/70 bg-white text-gray-500 shadow-sm transition-transform active:scale-[0.97] dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0">
              <h2 className="text-[22px] font-bold tracking-[-0.025em] text-gray-900 dark:text-gray-100">
                Orçamentos
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                Limites para manter os gastos sob controle
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push('/budgets/new')}
            aria-label="Novo orçamento"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-teal-600 text-white shadow-sm shadow-teal-600/20 transition-transform active:scale-[0.97]"
          >
            <Plus size={19} />
          </button>
        </div>

        <div className="mb-2.5">
          <ContextToggle />
        </div>

        <div className="flex items-center gap-1 rounded-[16px] border border-gray-200/70 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            aria-label="Mês anterior"
            className="flex h-8 w-8 items-center justify-center rounded-[11px] text-gray-400 transition-colors active:scale-[0.97] hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-slate-800 dark:hover:text-gray-200"
          >
            ‹
          </button>

          <span className="flex-1 text-center text-[12px] font-bold capitalize text-gray-700 dark:text-gray-300">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>

          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            aria-label="Próximo mês"
            className="flex h-8 w-8 items-center justify-center rounded-[11px] text-gray-400 transition-colors active:scale-[0.97] hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-slate-800 dark:hover:text-gray-200"
          >
            ›
          </button>
        </div>
      </div>

      <div className="pt-2.5">
        {isDataLoading ? (
          <BudgetsSkeleton />
        ) : budgetsWithSpent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-300">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[18px] border border-gray-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
              className="rounded-[16px] bg-teal-600 px-5 py-3 text-[13px] font-bold text-white shadow-sm shadow-teal-600/20 transition-transform active:scale-[0.98]"
            >
              Criar orçamento
            </button>
          </div>
        ) : (
          <div className="space-y-2 animate-in fade-in duration-300">
            {budgetsWithSpent.map((budget: any) => {
              const IconComp = getDynamicIcon(budget.icon || 'tag')
              const isWarning = budget.percent >= 80 && budget.remaining >= 0
              const isOver = budget.remaining < 0

              return (
                <div
                  key={budget.id}
                  onClick={(e) => goToDetails(budget.id, e)}
                  className="cursor-pointer rounded-[20px] border border-gray-200/70 bg-white p-4 shadow-sm transition-transform active:scale-[0.985] dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
                        style={{ backgroundColor: `${budget.color}20`, color: budget.color }}
                      >
                        <IconComp size={18} />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold text-gray-900 dark:text-gray-100">
                          {budget.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-gray-400 dark:text-gray-500">
                          {budget.categories?.name || 'Geral'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(budget.spent)}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        de {formatCurrency(budget.availableAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-2.5 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isOver ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-teal-500'
                      }`}
                      style={{ width: `${budget.progressPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`text-[12px] font-semibold ${
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

                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                        {getBudgetPeriodName(budget.period)}
                      </span>

                      <button
                        onClick={(e) => goToEdit(budget.id, e)}
                        aria-label="Editar orçamento"
                        className="flex h-8 w-8 items-center justify-center rounded-[10px] text-gray-400 transition-colors active:scale-[0.97] hover:bg-gray-50 hover:text-teal-600 dark:hover:bg-slate-800 dark:hover:text-teal-400"
                      >
                        <Edit2 size={15} />
                      </button>
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