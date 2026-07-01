'use client'

import React, { useState, useRef } from 'react'
import {
  TrendingUp,
  Calendar,
  PieChart,
  ArrowLeftRight,
  Download,
  BarChart3,
  Target,
  DollarSign,
  RefreshCw,
  ChevronRight,
  FileText,
  Filter,
} from 'lucide-react'
import CashFlow from '@/components/reports/CashFlow'
import CategoryResult from '@/components/reports/CategoryResult'
import FixedVsVariable from '@/components/reports/FixedVsVariable'
import BudgetVsReal from '@/components/reports/BudgetVsReal'
import WeekdayExpenses from '@/components/reports/WeekdayExpenses'
import ComparePeriods from '@/components/reports/ComparePeriods'
import ExportData from '@/components/reports/ExportData'
import ReportFilters, { ReportFilterValues } from '@/components/reports/ReportFilters'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'

const reportsList = [
  {
    id: 'cashflow',
    title: 'Fluxo de Caixa',
    description: 'Entradas e saídas do período',
    icon: TrendingUp,
    color: '#10B981',
    component: CashFlow,
  },
  {
    id: 'category',
    title: 'Despesas por Categoria',
    description: 'Distribuição dos gastos',
    icon: PieChart,
    color: '#F59E0B',
    component: CategoryResult,
  },
  {
    id: 'fixedvsvariable',
    title: 'Despesas Fixas vs Variáveis',
    description: 'Análise de recorrência',
    icon: BarChart3,
    color: '#3B82F6',
    component: FixedVsVariable,
  },
  {
    id: 'budgetvsreal',
    title: 'Orçamento vs Realizado',
    description: 'Compare com seu planejamento',
    icon: Target,
    color: '#EF4444',
    component: BudgetVsReal,
  },
  {
    id: 'weekday',
    title: 'Despesas por Dia da Semana',
    description: 'Padrões de consumo semanal',
    icon: Calendar,
    color: '#8B5CF6',
    component: WeekdayExpenses,
  },
  {
    id: 'compare',
    title: 'Comparar Períodos',
    description: 'Evolução mês a mês',
    icon: ArrowLeftRight,
    color: '#EC4899',
    component: ComparePeriods,
  },
  {
    id: 'export',
    title: 'Exportar Dados',
    description: 'CSV, JSON e planilhas',
    icon: Download,
    color: '#6366F1',
    component: ExportData,
  },
]

type ReportType =
  | 'cashflow'
  | 'category'
  | 'fixedvsvariable'
  | 'budgetvsreal'
  | 'weekday'
  | 'compare'
  | 'export'
  | null

export default function ReportsPage() {
  const { context } = useContext_()
  const [selectedReport, setSelectedReport] = useState<ReportType>(null)
  const [refreshing, setRefreshing] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const [filters, setFilters] = useState<ReportFilterValues>({
    context,
    dateRange: { start: '', end: '' },
    preset: 'thisMonth',
    tags: [],
    accounts: [],
    creditCards: [],
  })

  // Pull to refresh
  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      setTimeout(() => setRefreshing(false), 1000)
    }
  }

  const handleTouchEnd = () => {
    isPulling.current = false
  }

  React.useEffect(() => {
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
  }, [refreshing])

  const selectedItem = reportsList.find((item) => item.id === selectedReport)

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      
      {/* Pull to refresh */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => (selectedReport ? setSelectedReport(null) : window.history.back())}
            className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            {selectedReport && selectedItem && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${selectedItem.color}20` }}>
                <selectedItem.icon size={16} style={{ color: selectedItem.color }} />
              </div>
            )}
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {selectedReport ? selectedItem?.title || 'Relatório' : 'Relatórios'}
            </h1>
          </div>
          <div className="w-10" />
        </div>
        {!selectedReport && <ContextToggle />}
      </div>

      <div className="px-4 pt-4">
        {selectedReport && selectedItem ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <ReportFilters onChange={setFilters} initialPreset={filters.preset} context={context} />

            <div className="mt-4">
              <selectedItem.component filters={filters} />
            </div>
          </div>
        ) : (
          /* Lista de relatórios */
          <div className="space-y-2 animate-in fade-in duration-300">
            {reportsList.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedReport(item.id as ReportType)}
                  className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 flex items-center gap-3 active:bg-gray-50 dark:active:bg-slate-700 active:scale-[0.98] transition-all text-left shadow-sm border border-gray-50 dark:border-slate-700 hover:shadow-md"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${item.color}20` }}>
                    <Icon size={20} style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{item.title}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}