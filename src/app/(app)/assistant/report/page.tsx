'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, RefreshCw, Loader2, FileText, Sparkles,
  TrendingUp, TrendingDown, Wallet, PieChart, Calendar,
  Download, Printer, Share2, BarChart3, LineChart,
  AlertCircle, CheckCircle, Clock, ArrowRight, Bot
} from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { formatCurrency } from '@/lib/utils'
import { useLocalData } from '@/hooks/useLocalData'

// ============================================================
// SKELETON LOADER
// ============================================================
const ReportSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-56 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
          <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded mx-auto" />
          <div className="h-5 w-24 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto mt-1" />
        </div>
      ))}
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between p-2 border-b border-gray-50 dark:border-slate-700 last:border-0">
          <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      ))}
    </div>
  </div>
)

export default function AssistantReportPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<'1m' | '3m' | '6m'>('3m')
  const [generating, setGenerating] = useState(false)

  // ============================================================
  // 🔥 CORRIGIDO: Removidos realtime: true e realtime: false
  // ============================================================
  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context },
  })

  const { data: localCategories, loading: catLoading, reload: reloadCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context },
  })

  // ============================================================
  // ESTADOS DO RELATÓRIO
  // ============================================================
  const [report, setReport] = useState({
    summary: {
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      transactionCount: 0,
      incomeCount: 0,
      expenseCount: 0,
      averageDaily: 0,
      biggestIncome: { description: '', amount: 0, date: '' },
      biggestExpense: { description: '', amount: 0, date: '' },
    },
    categoryBreakdown: [] as { name: string; amount: number; percent: number; color: string }[],
    monthlyTrend: [] as { month: string; income: number; expense: number; balance: number }[],
    insights: [] as { type: 'positive' | 'negative' | 'neutral'; message: string }[],
    generatedAt: new Date().toISOString(),
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
      generateReport().finally(() => setRefreshing(false))
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
      await Promise.all([reloadTransactions(), reloadCategories()])
      await generateReport()
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      showToast('Erro ao gerar relatório.', 'error')
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id, context, period])

  // ============================================================
  // GERAR RELATÓRIO
  // ============================================================
  const generateReport = async () => {
    if (!localTransactions) return

    setGenerating(true)

    try {
      const txs = localTransactions
      const cats = localCategories || []

      const now = new Date()
      const monthsToGo = parseInt(period)
      const startDate = subMonths(now, monthsToGo)

      const filteredTxs = txs.filter((t: any) => {
        const txDate = new Date(t.date)
        return txDate >= startDate && txDate <= now && t.status === 'done'
      })

      const income = filteredTxs
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

      const expense = filteredTxs
        .filter((t: any) => (t.type === 'expense' || t.type === 'sangria'))
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

      const incomeTxs = filteredTxs.filter((t: any) => t.type === 'income')
      const expenseTxs = filteredTxs.filter((t: any) => t.type === 'expense' || t.type === 'sangria')

      const biggestIncome = incomeTxs.reduce(
        (max: any, t: any) => (Number(t.amount) > max.amount ? t : max),
        { description: '', amount: 0, date: '' }
      ) as any

      const biggestExpense = expenseTxs.reduce(
        (max: any, t: any) => (Number(t.amount) > max.amount ? t : max),
        { description: '', amount: 0, date: '' }
      ) as any

      const dayDiff = differenceInDays(now, startDate) || 1
      const averageDaily = (income - expense) / dayDiff

      const categoryMap: Record<string, { name: string; amount: number; color: string }> = {}
      expenseTxs.forEach((t: any) => {
        const catId = t.category_id || 'uncategorized'
        const cat = cats.find((c: any) => c.id === catId) as any
        const catName = cat?.name || 'Sem categoria'
        const catColor = cat?.color || '#64748b'
        if (!categoryMap[catId]) {
          categoryMap[catId] = { name: catName, amount: 0, color: catColor }
        }
        categoryMap[catId].amount += Number(t.amount) || 0
      })

      const categoryBreakdown = Object.values(categoryMap)
        .map((cat) => ({
          ...cat,
          percent: expense > 0 ? (cat.amount / expense) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6)

      const monthlyMap: Record<string, { income: number; expense: number }> = {}
      filteredTxs.forEach((t: any) => {
        const monthKey = format(new Date(t.date), 'yyyy-MM')
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { income: 0, expense: 0 }
        }
        if (t.type === 'income') {
          monthlyMap[monthKey].income += Number(t.amount) || 0
        } else {
          monthlyMap[monthKey].expense += Number(t.amount) || 0
        }
      })

      const monthlyTrend = Object.keys(monthlyMap)
        .sort()
        .map((key) => ({
          month: format(new Date(key + '-01'), 'MMM/yy', { locale: ptBR }),
          income: monthlyMap[key].income,
          expense: monthlyMap[key].expense,
          balance: monthlyMap[key].income - monthlyMap[key].expense,
        }))

      const insights: { type: 'positive' | 'negative' | 'neutral'; message: string }[] = []

      if (income > expense) {
        insights.push({
          type: 'positive',
          message: `✅ Você está no azul! Suas receitas superam as despesas em ${formatCurrency(income - expense)}.`
        })
      } else if (expense > income) {
        insights.push({
          type: 'negative',
          message: `⚠️ Suas despesas estão maiores que as receitas. Tente reduzir gastos em ${formatCurrency(expense - income)}.`
        })
      } else {
        insights.push({
          type: 'neutral',
          message: '📊 Receitas e despesas estão equilibradas.'
        })
      }

      if (biggestExpense.amount > 0) {
        insights.push({
          type: 'neutral',
          message: `📌 Maior gasto: "${biggestExpense.description}" - ${formatCurrency(biggestExpense.amount)}`
        })
      }

      if (biggestIncome.amount > 0) {
        insights.push({
          type: 'positive',
          message: `📈 Maior receita: "${biggestIncome.description}" - ${formatCurrency(biggestIncome.amount)}`
        })
      }

      if (categoryBreakdown.length > 0) {
        insights.push({
          type: 'neutral',
          message: `🏷️ Categoria com mais gastos: "${categoryBreakdown[0].name}" - ${categoryBreakdown[0].percent.toFixed(0)}% do total`
        })
      }

      setReport({
        summary: {
          totalIncome: income,
          totalExpense: expense,
          balance: income - expense,
          transactionCount: filteredTxs.length,
          incomeCount: incomeTxs.length,
          expenseCount: expenseTxs.length,
          averageDaily,
          biggestIncome: {
            description: biggestIncome.description || 'Nenhuma',
            amount: biggestIncome.amount || 0,
            date: biggestIncome.date || '',
          },
          biggestExpense: {
            description: biggestExpense.description || 'Nenhuma',
            amount: biggestExpense.amount || 0,
            date: biggestExpense.date || '',
          },
        },
        categoryBreakdown,
        monthlyTrend,
        insights,
        generatedAt: new Date().toISOString(),
      })

      showToast('Relatório gerado com sucesso!', 'success')
    } catch (err) {
      console.error('Erro ao gerar relatório:', err)
      showToast('Erro ao gerar relatório.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleExport = () => {
    showToast('Exportação em breve 📄', 'info')
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
        {loadingPulse && (
          <div className="fixed top-20 right-4 z-50">
            <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FileText size={24} className="text-teal-600" />
            Relatório IA
          </h2>
          <div className="w-10" />
        </div>
        <ReportSkeleton />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <FileText size={22} className="text-teal-600" />
          Relatório IA
        </h2>
        <button
          onClick={handleExport}
          className="p-2 -mr-2 text-gray-400 hover:text-teal-600 transition-colors"
        >
          <Download size={20} />
        </button>
      </div>

      <div className="mb-4">
        <ContextToggle />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {[
          { key: '1m', label: '1 mês' },
          { key: '3m', label: '3 meses' },
          { key: '6m', label: '6 meses' },
        ].map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key as any)}
            className={`px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap transition-all border ${
              period === p.key
                ? 'bg-teal-700 text-white border-teal-700 shadow-md'
                : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-[24px] p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles size={24} className="text-teal-200" />
            <h3 className="font-bold text-lg">Relatório Financeiro</h3>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-teal-100 text-sm">Saldo no período</p>
              <p className="text-3xl font-bold">{formatCurrency(report.summary.balance)}</p>
            </div>
            <div className="text-right">
              <p className="text-teal-100 text-sm">Transações</p>
              <p className="text-xl font-bold">{report.summary.transactionCount}</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-teal-100/70">
            Gerado em {format(new Date(report.generatedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Receitas</p>
            <p className="text-[16px] font-bold text-emerald-600">{formatCurrency(report.summary.totalIncome)}</p>
            <p className="text-[10px] text-gray-400">{report.summary.incomeCount} transações</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
            <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-2">
              <TrendingDown size={16} className="text-red-500" />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Despesas</p>
            <p className="text-[16px] font-bold text-red-500">{formatCurrency(report.summary.totalExpense)}</p>
            <p className="text-[10px] text-gray-400">{report.summary.expenseCount} transações</p>
          </div>
        </div>

        {report.categoryBreakdown.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <PieChart size={18} className="text-teal-600" />
              Categorias com mais gastos
            </h3>
            <div className="space-y-3">
              {report.categoryBreakdown.map((cat, index) => (
                <div key={index}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
                    <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${cat.percent}%`, backgroundColor: cat.color }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{cat.percent.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.monthlyTrend.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-teal-600" />
              Evolução mensal
            </h3>
            <div className="space-y-2">
              {report.monthlyTrend.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 border-b border-gray-50 dark:border-slate-700 last:border-0">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{item.month}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-emerald-600">+{formatCurrency(item.income)}</span>
                    <span className="text-xs text-red-500">-{formatCurrency(item.expense)}</span>
                    <span className={`text-sm font-bold ${item.balance >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
                      {formatCurrency(item.balance)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.insights.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Bot size={18} className="text-teal-600" />
              Insights do Assistente
            </h3>
            <div className="space-y-2">
              {report.insights.map((insight, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl ${
                    insight.type === 'positive'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : insight.type === 'negative'
                      ? 'bg-red-50 dark:bg-red-900/20'
                      : 'bg-gray-50 dark:bg-slate-700'
                  }`}
                >
                  <p className="text-sm text-gray-800 dark:text-gray-200">{insight.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={generateReport}
          disabled={generating}
          className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-teal-700/20"
        >
          {generating ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
          {generating ? 'Atualizando relatório...' : 'Atualizar relatório'}
        </button>
      </div>
    </div>
  )
}