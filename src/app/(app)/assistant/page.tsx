'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  Settings,
  Zap,
  TrendingUp,
  PiggyBank,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Bot,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

function AssistantDashboardContent() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [hasKey, setHasKey] = useState(false)
  const [provider, setProvider] = useState('')
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<string[]>([])

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  useEffect(() => {
    const key = localStorage.getItem('dfl_ai_key') || ''
    const prov = localStorage.getItem('dfl_ai_provider') || ''
    setHasKey(!!key.trim())
    setProvider(prov)
    setLoading(false)
  }, [])

  // Gerar insights locais
  useEffect(() => {
    if (!user?.id) return

    const loadInsights = async () => {
      const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const end = format(endOfMonth(new Date()), 'yyyy-MM-dd')

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .match({ user_id: user.id, context: context })
        .gte('date', start)
        .lte('date', end)

      const txs = Array.isArray(transactions) ? transactions : []

      // Gastos por categoria
      const catMap: Record<string, number> = {}
      txs
        .filter((t: any) => t.type === 'expense' || t.type === 'sangria')
        .forEach((t: any) => {
          const name = t.categories?.name || 'Outros'
          catMap[name] = (catMap[name] || 0) + Number(t.amount || 0)
        })

      const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1])
      const localInsights: string[] = []

      if (sorted.length > 0) {
        localInsights.push(`Maior gasto: ${sorted[0][0]} — ${formatCurrency(sorted[0][1])}`)
        if (sorted.length > 1) {
          localInsights.push(`${sorted[0][0]} representa ${((sorted[0][1] / (sorted.reduce((a, b) => a + b[1], 0))) * 100).toFixed(0)}% dos gastos`)
        }
      }

      // Orçamentos estourados
      const { data: budgets } = await supabase
        .from('budgets')
        .select('*, categories(name)')
        .match({ user_id: user.id, context: context })

      const budgetsArray = Array.isArray(budgets) ? budgets : []
      budgetsArray.forEach((b: any) => {
        const spent = txs
          .filter((t: any) => t.category_id === b.category_id && (t.type === 'expense' || t.type === 'sangria'))
          .reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
        if (spent > Number(b.amount)) {
          localInsights.push(`⚠️ Orçamento estourado: ${b.name || b.categories?.name}`)
        }
      })

      setInsights(localInsights.length > 0 ? localInsights : ['Nenhum insight disponível. Lance mais transações para obter análises.'])
    }

    loadInsights()
  }, [user, context])

  const actions = [
    {
      icon: Bot,
      title: 'Chat Financeiro',
      desc: 'Tire dúvidas sobre suas finanças',
      href: '/assistant/chat',
      color: 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
    },
    {
      icon: Sparkles,
      title: 'Resumo do Mês',
      desc: 'Análise completa dos seus gastos',
      href: '/assistant/report',
      color: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    },
    {
      icon: TrendingUp,
      title: 'Plano de Ação',
      desc: 'Sugestões para economizar',
      href: '/assistant/plan',
      color: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    },
  ]

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/more')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <Bot size={20} className="text-teal-700 dark:text-teal-400" />
          </div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Assistente IA</h1>
        </div>
        <button onClick={() => router.push('/assistant/settings')} className="p-2 -mr-2 text-gray-500 dark:text-gray-400">
          <Settings size={22} />
        </button>
      </div>

      {/* Status da API */}
      <div className={`rounded-2xl p-4 mb-6 flex items-center gap-3 ${hasKey ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'}`}>
        {hasKey ? <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" /> : <XCircle size={20} className="text-orange-600 dark:text-orange-400" />}
        <div>
          <p className={`text-sm font-bold ${hasKey ? 'text-emerald-700 dark:text-emerald-300' : 'text-orange-700 dark:text-orange-300'}`}>
            {hasKey ? 'API key configurada' : 'API key não configurada'}
          </p>
          {!hasKey && (
            <button onClick={() => router.push('/assistant/settings')} className="text-xs text-teal-700 dark:text-teal-400 font-bold mt-1">
              Configurar agora →
            </button>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-teal-700 dark:text-teal-400" />
          <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100">Insights</h3>
        </div>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <p key={i} className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
              {insight}
            </p>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="space-y-3">
        {actions.map(action => (
          <button
            key={action.title}
            onClick={() => router.push(action.href)}
            className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.color}`}>
              <action.icon size={20} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">{action.title}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">{action.desc}</p>
            </div>
            <ArrowRight size={18} className="text-gray-400 dark:text-gray-500" />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  return (
    <ContextProvider>
      <AssistantDashboardContent />
    </ContextProvider>
  )
}
