'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  PieChart,
  BarChart3,
  CalendarDays,
  Layers,
  TrendingUp,
  Target,
  Download,
  ChevronRight,
} from 'lucide-react'
import { getDynamicIcon } from '@/lib/iconUtils'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import CategoryResult from '@/components/reports/CategoryResult'
import CashFlow from '@/components/reports/CashFlow'
import BudgetVsReal from '@/components/reports/BudgetVsReal'
import ComparePeriods from '@/components/reports/ComparePeriods'
import WeekdayExpenses from '@/components/reports/WeekdayExpenses'
import FixedVsVariable from '@/components/reports/FixedVsVariable'
import ExportData from '@/components/reports/ExportData'
import ReportFilters, { ReportFilterValues } from '@/components/reports/ReportFilters'

const reportItems = [
  {
    id: 'category',
    title: 'Resultado por categoria',
    description: 'Entradas, saídas e saldo líquido por categoria.',
    icon: 'pie-chart',
    color: '#14b8a6',
  },
  {
    id: 'compare',
    title: 'Comparar períodos',
    description: 'Compare dois períodos lado a lado.',
    icon: 'bar-chart-3',
    color: '#f97316',
  },
  {
    id: 'weekday',
    title: 'Despesas por dia da semana',
    description: 'Veja em quais dias você gasta mais.',
    icon: 'calendar-days',
    color: '#8b5cf6',
  },
  {
    id: 'fixed-variable',
    title: 'Fixas x Variáveis',
    description: 'Separe gastos recorrentes de avulsos.',
    icon: 'layers',
    color: '#ef4444',
  },
  {
    id: 'cashflow',
    title: 'Fluxo de caixa',
    description: 'Evolução do saldo mês a mês.',
    icon: 'trending-up',
    color: '#3b82f6',
  },
  {
    id: 'budget-real',
    title: 'Previsto x Realizado',
    description: 'Compare orçamentos com o gasto real.',
    icon: 'target',
    color: '#22c55e',
  },
  {
    id: 'export',
    title: 'Exportar para planilha',
    description: 'Baixe suas transações em CSV.',
    icon: 'download',
    color: '#64748b',
  },
]

function ReportsContent() {
  const router = useRouter()
  const { context } = useContext_()
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [filters, setFilters] = useState<ReportFilterValues>({
    context,
    dateRange: { start: '', end: '' },
    preset: 'thisMonth',
  })

  const handleBack = () => {
    if (activeReport) {
      setActiveReport(null)
    } else {
      router.push('/more')
    }
  }

  const renderReport = () => {
    switch (activeReport) {
      case 'category':
        return <CategoryResult />
      case 'compare':
        return <ComparePeriods />
      case 'weekday':
        return <WeekdayExpenses />
      case 'fixed-variable':
        return <FixedVsVariable />
      case 'cashflow':
        return <CashFlow />
      case 'budget-real':
        return <BudgetVsReal />
      case 'export':
        return <ExportData />
      default:
        return null
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={handleBack} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          {activeReport ? reportItems.find(r => r.id === activeReport)?.title : 'Relatórios Avançados'}
        </h1>
        <ContextToggle />
      </div>

      {activeReport ? (
        <>
          <ReportFilters onChange={setFilters} initialPreset={filters.preset} />
          {renderReport()}
        </>
      ) : (
        <div className="space-y-3">
          {reportItems.map(item => {
            const IconComp = getDynamicIcon(item.icon)
            return (
              <button
                key={item.id}
                onClick={() => setActiveReport(item.id)}
                className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${item.color}20`, color: item.color }}
                >
                  <IconComp size={20} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">{item.title}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">{item.description}</p>
                </div>
                <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <ContextProvider>
      <ReportsContent />
    </ContextProvider>
  )
}