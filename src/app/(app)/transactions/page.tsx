'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, Plus, Clock, Check, CreditCard,
  Search, X, ArrowLeftRight
} from 'lucide-react'
import { format, isToday, isYesterday, isThisYear } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'

export default function TransactionsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer' | 'pending'>('all')

  const loadTransactions = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    let query = supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('date', { ascending: false })
      .limit(100)

    if (filter !== 'all') {
      if (filter === 'pending') {
        query = query.eq('status', 'pending')
      } else {
        query = query.eq('type', filter)
      }
    }

    if (search) {
      query = query.or(`description.ilike.%${search}%,categories.name.ilike.%${search}%`)
    }

    const { data } = await query
    let txs = Array.isArray(data) ? data : []

    // Ordenação: pendentes primeiro, depois por data decrescente
    txs.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (a.status !== 'pending' && b.status === 'pending') return 1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    setTransactions(txs)
    setLoading(false)
  }, [user?.id, context, filter, search])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    if (isToday(date)) return 'Hoje'
    if (isYesterday(date)) return 'Ontem'
    return format(date, "dd 'de' MMMM", { locale: ptBR })
  }

  // Agrupa transações por data
  const groupByDate = (txs: any[]) => {
    const groups: Record<string, any[]> = {}
    txs.forEach(tx => {
      const key = tx.date
      if (!groups[key]) groups[key] = []
      groups[key].push(tx)
    })
    return Object.entries(groups)
  }

  const groupedTransactions = groupByDate(transactions)

  const filters = [
    { id: 'all', label: 'Todas' },
    { id: 'income', label: 'Receitas' },
    { id: 'expense', label: 'Despesas' },
    { id: 'transfer', label: 'Transferências' },
    { id: 'pending', label: 'Pendentes' },
  ]

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Transações</h1>
          <button onClick={() => router.push('/transactions/new')} className="p-2 -mr-2 text-teal-700 dark:text-teal-400">
            <Plus size={24} />
          </button>
        </div>
        <ContextToggle />

        {/* Barra de pesquisa */}
        <div className="relative mt-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar transações..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl text-sm outline-none text-gray-700 dark:text-gray-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700 text-teal-800 dark:text-teal-300'
                  : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de transações */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton variant="rect" height="64px" count={5} className="mb-2" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma transação encontrada</p>
            <p className="text-gray-400 text-xs mt-1">Tente ajustar os filtros ou criar uma nova.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTransactions.map(([date, txs], groupIndex) => (
              <div key={date}>
                {/* Cabeçalho da data */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {formatDateHeader(date)}
                  </h3>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {txs.length} transação{txs.length > 1 ? 'ões' : ''}
                  </span>
                </div>

                {/* Cards de transação */}
                <div className="space-y-1">
                  {txs.map((tx, index) => {
                    const isPending = tx.status === 'pending'
                    const isIncome = tx.type === 'income'
                    const isTransfer = tx.type === 'transfer'
                    const IconComp = getDynamicIcon(tx.categories?.icon)

                    return (
                      <div
                        key={tx.id}
                        onClick={() => router.push(`/transactions/${tx.id}`)}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl cursor-pointer hover:shadow-sm transition-all border border-gray-50 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-2"
                        style={{ animationDelay: `${(groupIndex * 50) + (index * 30)}ms` }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Ícone de status */}
                          {isPending ? (
                            <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                              <Clock size={14} className="text-orange-500" />
                            </div>
                          ) : isTransfer ? (
                            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                              <ArrowLeftRight size={14} className="text-blue-500" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                              <Check size={14} className="text-emerald-500" />
                            </div>
                          )}

                          {/* Ícone da categoria */}
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${tx.categories?.color || '#94a3b8'}15`, color: tx.categories?.color || '#64748b' }}
                          >
                            <IconComp size={16} />
                          </div>

                          {/* Descrição e categoria */}
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate">
                              {tx.description || tx.categories?.name || (isTransfer ? 'Transferência' : 'Sem descrição')}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">
                              {tx.categories?.name || 'Geral'}
                              {tx.credit_card_id && (
                                <span className="ml-1 text-orange-400">• Crédito</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Valor */}
                        <p className={`text-[14px] font-bold whitespace-nowrap ml-2 ${
                          isIncome ? 'text-emerald-600' :
                          isTransfer ? 'text-blue-600' :
                          'text-red-600'
                        }`}>
                          {isIncome ? '+' : isTransfer ? '↔' : '-'}{formatCurrency(Number(tx.amount) || 0)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB para nova transação */}
      <div className="fixed bottom-6 right-4 z-40">
        <button
          onClick={() => router.push('/transactions/new')}
          className="w-14 h-14 bg-teal-700 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-teal-800 transition-colors active:scale-95"
        >
          <Plus size={28} />
        </button>
      </div>
    </div>
  )
}