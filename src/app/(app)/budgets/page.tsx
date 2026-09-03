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

  const budgetsWithSpent = (localBudgets || []).map(
    (budget: any) => {
      const metrics = calculateBudgetMetrics({
        budget,
        transactions: localTransactions || [],
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
      className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-950 pb-28 font-sans px-4 pt-4 transition-colors duration-300"
    >
      {isDataLoading && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-950/92 backdrop-blur-xl pb-3 border-b border-gray-200/60 dark:border-slate-800">
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
              const isWarning = budget.percent >= 80 && budget.remaining >= 0
              const isOver = budget.remaining < 0

              return (
                // ✅ CARD INTEIRO CLICÁVEL → ABRE DETALHES
                <div
                  key={budget.id}
                  onClick={(e) => goToDetails(budget.id, e)}
                  className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2 cursor-pointer transition-transform active:scale-[0.98] hover:shadow-md"
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
                          de {formatCurrency(budget.availableAmount)}
                        </p>
                      </div>
                    </div>

                    <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isOver ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-teal-500'
                        }`}
                        style={{ width: `${budget.progressPercent}%` }}
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
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                          {getBudgetPeriodName(budget.period)}
                        </span>

                        <button
                          onClick={(e) => goToEdit(budget.id, e)}
                          className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-teal-600 dark:hover:text-teal-400 transition-colors active:scale-[0.98]"
                          aria-label="Editar orçamento"
                        >
                          <Edit2 size={16} />
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