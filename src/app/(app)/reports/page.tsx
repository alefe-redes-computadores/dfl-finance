'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar,
  ArrowUpDown,
  Download,
  ChevronLeft,
} from 'lucide-react'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import CategoryResult from '@/components/reports/CategoryResult'
import CashFlow from '@/components/reports/CashFlow'
import BudgetVsReal from '@/components/reports/BudgetVsReal'
import ComparePeriods from '@/components/reports/ComparePeriods'
import WeekdayExpenses from '@/components/reports/WeekdayExpenses'
import FixedVsVariable from '@/components/reports/FixedVsVariable'
import ExportData from '@/components/reports/ExportData'
// ADICIONADO: Import dos filtros
import ReportFilters, { ReportFilterValues } from '@/components/reports/ReportFilters'


const reportItems = [
  {
    id: 'category-result',
    title: 'Resultado por Categoria',
    description: 'Receitas e despesas agrupadas por categoria no período selecionado',
    icon: TrendingUp,
    component: CategoryResult,
  },
  {
    id: 'cash-flow',
    title: 'Fluxo de Caixa',
    description: 'Entradas e saídas diárias no período',
    icon: ArrowUpDown,
    component: CashFlow,
  },
  {
    id: 'budget-vs-real',
    title: 'Orçamento vs Realizado',
    description: 'Compare seus orçamentos com os gastos reais',
    icon: BarChart3,
    component: BudgetVsReal,
  },
  {
    id: 'compare-periods',
    title: 'Comparar Períodos',
    description: 'Veja a evolução em relação ao período anterior',
    icon: Calendar,
    component: ComparePeriods,
  },
  {
    id: 'fixed-vs-variable',
    title: 'Fixos vs Variáveis',
    description: 'Análise dos gastos recorrentes e variáveis',
    icon: DollarSign,
    component: FixedVsVariable,
  },
  {
    id: 'weekday-expenses',
    title: 'Gastos por Dia da Semana',
    description: 'Descubra em quais dias você gasta mais',
    icon: Calendar,
    component: WeekdayExpenses,
  },
  {
    id: 'export-data',
    title: 'Exportar Dados',
    description: 'Baixe suas transações em CSV ou PDF',
    icon: Download,
    component: ExportData,
  },
]

function ReportsContent() {
  const router = useRouter()
  const { context } = useContext_()
  const [selectedReport, setSelectedReport] = useState<string | null>(null)

  // ADICIONADO: Estado dos filtros para o compilador reconhecer
  const [filters, setFilters] = useState<ReportFilterValues>({
    context,
    dateRange: { start: '', end: '' },
    preset: 'thisMonth',
  })

  const handleBack = () => {
    if (selectedReport) {
      setSelectedReport(null)
    } else {
      router.back()
    }
  }

  const selectedItem = reportItems.find(item => item.id === selectedReport)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={handleBack} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {selectedReport ? selectedItem?.title || 'Relatório' : 'Relatórios Avançados'}
          </h1>
          <div className="w-10" />
        </div>
        {!selectedReport && <ContextToggle />}
      </div>

      {/* Conteúdo */}
      <div className="px-4 pt-4">
        {selectedReport && selectedItem ? (
          <div>
            {/* ADICIONADO: O componente que faltava */}
            <ReportFilters onChange={setFilters} initialPreset={filters.preset} />
            
            <div className="mt-4">
              {selectedItem.component ? (
                <ErrorBoundary key={selectedReport}>
                  <selectedItem.component filters={filters} />
                </ErrorBoundary>
              ) : (
                <div className="text-center py-20 text-gray-400 dark:text-gray-500">
                  Em breve
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {reportItems.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedReport(item.id)}
                  className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 flex items-center gap-3 active:bg-gray-50 dark:active:bg-slate-700 transition-colors text-left shadow-sm border border-gray-50 dark:border-slate-700"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                    <Icon size={20} className="text-teal-700 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          Erro ao carregar relatório. Tente novamente.
        </div>
      )
    }
    return this.props.children
  }
}

export default function ReportsPage() {
  return (
    <ContextProvider>
      <ReportsContent />
    </ContextProvider>
  )
}
