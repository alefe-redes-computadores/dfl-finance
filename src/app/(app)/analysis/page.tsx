'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, BarChart3, PieChart, TrendingUp, Calendar,
  ArrowLeftRight, DollarSign, Clock, FileText
} from 'lucide-react'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

const REPORTS = [
  {
    id: 'budget-vs-real',
    title: 'Orçamento vs Realizado',
    description: 'Compare o que foi planejado com o que foi gasto',
    icon: BarChart3,
    color: 'text-teal-500',
    bg: 'bg-teal-50 dark:bg-teal-900/20',
  },
  {
    id: 'category-result',
    title: 'Gastos por Categoria',
    description: 'Visualize a distribuição dos seus gastos',
    icon: PieChart,
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
  },
  {
    id: 'cash-flow',
    title: 'Fluxo de Caixa',
    description: 'Acompanhe suas entradas e saídas diárias',
    icon: DollarSign,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    id: 'compare-periods',
    title: 'Comparar Períodos',
    description: 'Compare dois períodos e veja a evolução',
    icon: ArrowLeftRight,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
  },
  {
    id: 'fixed-vs-variable',
    title: 'Gastos Fixos vs Variáveis',
    description: 'Entenda a proporção dos seus gastos',
    icon: TrendingUp,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    id: 'weekday-expenses',
    title: 'Gastos por Dia da Semana',
    description: 'Descubra em quais dias você gasta mais',
    icon: Calendar,
    color: 'text-pink-500',
    bg: 'bg-pink-50 dark:bg-pink-900/20',
  },
  {
    id: 'export-data',
    title: 'Exportar Dados',
    description: 'Exporte seus dados para CSV ou PDF',
    icon: FileText,
    color: 'text-gray-500',
    bg: 'bg-gray-50 dark:bg-gray-900/20',
  },
]

function ReportsContent() {
  const router = useRouter()
  const { context } = useContext_()
  const [selectedReport, setSelectedReport] = useState<string | null>(null)

  const handleReportClick = (reportId: string) => {
    if (reportId === 'export-data') {
      router.push('/reports/export')
      return
    }
    setSelectedReport(reportId)
  }

  const renderReport = () => {
    switch (selectedReport) {
      case 'budget-vs-real':
        const BudgetVsReal = require('@/components/reports/BudgetVsReal').default
        return <BudgetVsReal />
      case 'category-result':
        const CategoryResult = require('@/components/reports/CategoryResult').default
        return <CategoryResult />
      case 'cash-flow':
        const CashFlow = require('@/components/reports/CashFlow').default
        return <CashFlow />
      case 'compare-periods':
        const ComparePeriods = require('@/components/reports/ComparePeriods').default
        return <ComparePeriods />
      case 'fixed-vs-variable':
        const FixedVsVariable = require('@/components/reports/FixedVsVariable').default
        return <FixedVsVariable />
      case 'weekday-expenses':
        const WeekdayExpenses = require('@/components/reports/WeekdayExpenses').default
        return <WeekdayExpenses />
      default:
        return null
    }
  }

  if (selectedReport) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setSelectedReport(null)} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {REPORTS.find(r => r.id === selectedReport)?.title}
          </h1>
          <div className="w-10" />
        </div>
        {renderReport()}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Relatórios Avançados</h1>
        <div className="w-10" />
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 px-1">
        Selecione um relatório para visualizar. Cada relatório possui filtro de período flexível.
      </p>

      <div className="space-y-3">
        {REPORTS.map(report => {
          const IconComp = report.icon
          return (
            <button
              key={report.id}
              onClick={() => handleReportClick(report.id)}
              className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center gap-4 hover:shadow-md transition-all text-left group"
            >
              <div className={`w-12 h-12 rounded-xl ${report.bg} flex items-center justify-center flex-shrink-0`}>
                <IconComp size={22} className={report.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{report.title}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{report.description}</p>
              </div>
              <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180 flex-shrink-0" />
            </button>
          )
        })}
      </div>
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