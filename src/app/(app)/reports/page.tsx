'use client'

import React, { useState } from 'react'
import {
  TrendingUp,
  Calendar,
  PieChart,
  ArrowLeftRight,
  Download,
  BarChart3,
  Target,
  DollarSign,
} from 'lucide-react'
import CashFlow from './CashFlow'
import CategoryResult from './CategoryResult'
import FixedVsVariable from './FixedVsVariable'
import BudgetVsReal from './BudgetVsReal'
import WeekdayExpenses from './WeekdayExpenses'
import ComparePeriods from './ComparePeriods'
import ExportData from './ExportData'
import ReportFilters, { ReportFilterValues } from '@/components/reports/ReportFilters'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'

const reportsList = [
  {
    id: 'cashflow',
    title: 'Fluxo de Caixa',
    description: 'Entradas e saídas do período',
    icon: TrendingUp,
    color: '#10B981',
  },
  {
    id: 'category',
    title: 'Despesas por Categoria',
    description: 'Distribuição dos gastos',
    icon: PieChart,
    color: '#F59E0B',
  },
  {
    id: 'fixedvsvariable',
    title: 'Despesas Fixas vs Variáveis',
    description: 'Análise de recorrência',
    icon: BarChart3,
    color: '#3B82F6',
  },
  {
    id: 'budgetvsreal',
    title: 'Orçamento vs Realizado',
    description: 'Compare com seu planejamento',
    icon: Target,
    color: '#EF4444',
  },
  {
    id: 'weekday',
    title: 'Despesas por Dia da Semana',
    description: 'Padrões de consumo semanal',
    icon: Calendar,
    color: '#8B5CF6',
  },
  {
    id: 'compare',
    title: 'Comparar Períodos',
    description: 'Evolução mês a mês',
    icon: ArrowLeftRight,
    color: '#EC4899',
  },
  {
    id: 'export',
    title: 'Exportar Dados',
    description: 'CSV, JSON e planilhas',
    icon: Download,
    color: '#6366F1',
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

  const [filters, setFilters] = useState<ReportFilterValues>({
    context,
    dateRange: { start: '', end: '' },
    preset: 'thisMonth',
  })

  const selectedItem = reportsList.find((item) => item.id === selectedReport)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => (selectedReport ? setSelectedReport(null) : window.history.back())}
            className="p-2 -ml-2 text-gray-800 dark:text-gray-200"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {selectedReport ? selectedItem?.title || 'Relatório' : 'Relatórios'}
          </h1>
          <div className="w-10" />
        </div>
        {!selectedReport && <ContextToggle />}
      </div>

      <div className="px-4 pt-4">
        {selectedReport && selectedItem ? (
          <div className="space-y-4">
            <ReportFilters onChange={setFilters} initialPreset={filters.preset} context={context} />

            <div className="mt-4">
              <selectedItem.component filters={filters} />
            </div>
          </div>
        ) : (
          /* Lista de relatórios */
          <div className="space-y-2">
            {reportsList.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedReport(item.id as ReportType)}
                  className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 flex items-center gap-3 active:bg-gray-50 dark:active:bg-slate-700 transition-colors text-left shadow-sm border border-gray-50 dark:border-slate-700"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                    <Icon size={20} className="text-teal-700 dark:text-teal-400" />
                  </div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{item.title}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}