'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  ArrowDown,
  ArrowUp,
  Clock,
  Check,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'

type FilterType = 'all' | 'income' | 'expense' | 'transfer' | 'pending'

function TransactionContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { context } = useContext_()
  const currentContext = context || 'dfl'

  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>(
    (searchParams.get('filter') as FilterType) || 'all'
  )
  const [searchQuery, setSearchQuery] = useState('')

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const loadTransactions = useCallback(async () => {
    if (!user) return
    setLoading(true)

    try {
      let query = supabase
        .from('transactions')
        .select('*, categories(name, icon, color), accounts(name, color)')
        .eq('user_id', user.id)
        .eq('context', currentContext)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (filter === 'income') {
        query = query.eq('type', 'income')
      } else if (filter === 'expense') {
        query = query.in('type', ['expense', 'sangria'])
      } else if (filter === 'transfer') {
        query = query.eq('type', 'transfer')
      } else if (filter === 'pending') {
        query = query.eq('status', 'pending')
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar transações:', error)
        setTransactions([])
      } else {
        setTransactions(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Erro inesperado:', err)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [user, currentContext, filter])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  // Filtro local pela pesquisa (descrição ou nome da categoria)
  const filteredTransactions = searchQuery.trim()
    ? transactions.filter(tx => {
        const term = searchQuery.toLowerCase()
        const desc = (tx.description || '').toLowerCase()
        const cat = (tx.categories?.name || '').toLowerCase()
        return desc.includes(term) || cat.includes(term)
      })
    : transactions

  const pendentes = filteredTransactions.filter(t => t.status === 'pending')
  const concluidas = filteredTransactions.filter(t => t.status !== 'pending')

  const groupByDate = (txs: any[]) => {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const ontem = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')

    const grupos: Record<string, any[]> = {}
    txs.forEach(tx => {
      let chave = tx.date
      if (tx.date === hoje) chave = 'HOJE'
      else if (tx.date === ontem) chave = 'ONTEM'
      else chave = format(parseISO(tx.date), "dd 'de' MMMM", { locale: ptBR }).toUpperCase()
      
      if (!grupos[chave]) grupos[chave] = []
      grupos[chave].push(tx)
    })
    return grupos
  }

  const gruposConcluidas = groupByDate(concluidas)

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'income', label: 'Receitas' },
    { key: 'expense', label: 'Despesas' },
    { key: 'transfer', label: 'Transferências' },
    { key: 'pending', label: 'Pendentes' },
  ]

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Transações</h1>
          <button onClick={() => router.push('/transactions/new')} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 font-bold text-sm">
            + Nova
          </button>
        </div>

        {/* ContextToggle */}
        <div className="mb-3">
          <ContextToggle />
        </div>

        {/* Barra de Pesquisa */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por descrição ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl pl-9 pr-8 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-teal-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filterButtons.map(btn => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                filter === btn.key
                  ? 'bg-teal-700 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-teal-700" size={40} />
          </div>
        ) : (
          <>
            {/* DEBUG TEMPORÁRIO */}
            <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs p-2 rounded mb-4">
              DEBUG: {transactions.length} transações recebidas do banco.<br />
              Contexto atual: {currentContext}<br />
              Filtro: {filter}<br />
              Pesquisa: "{searchQuery}"<br />
              Pendentes: {pendentes.length} | Concluídas: {concluidas.length}
            </div>

            {/* Pendentes no topo */}
            {pendentes.length > 0 && (
              <div className="mb-6">
                {pendentes.map(tx => (
                  <CardTransacao key={tx.id} tx={tx} router={router} formatCurrency={formatCurrency} />
                ))}
              </div>
            )}

            {/* Divisor Concluídas */}
            {concluidas.length > 0 && pendentes.length > 0 && (
              <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                Concluídas
              </h3>
            )}

            {/* Concluídas agrupadas */}
            {Object.entries(gruposConcluidas).map(([cabecalho, txs]) => (
              <div key={cabecalho} className="mb-6">
                <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 mt-6">
                  {cabecalho}
                </h3>
                <div className="space-y-2">
                  {txs.map(tx => (
                    <CardTransacao key={tx.id} tx={tx} router={router} formatCurrency={formatCurrency} />
                  ))}
                </div>
              </div>
            ))}

            {pendentes.length === 0 && concluidas.length === 0 && (
              <div className="text-center py-20 text-gray-400 dark:text-gray-500">
                Nenhuma transação encontrada.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CardTransacao({ tx, router, formatCurrency }: { tx: any; router: any; formatCurrency: (v: number) => string }) {
  const IconComp = getDynamicIcon(tx.categories?.icon)
  const bgColor = tx.categories?.color || '#64748b'
  const isPending = tx.status === 'pending'
  const isIncome = tx.type === 'income'
  const isTransfer = tx.type === 'transfer'

  return (
    <div
      onClick={() => router.push(`/transactions/${tx.id}`)}
      className="flex items-center gap-3 py-3 cursor-pointer active:bg-gray-50 dark:active:bg-slate-700 transition-colors"
    >
      <div className="flex-shrink-0 w-5 flex justify-center">
        {isPending ? (
          <Clock size={14} className="text-red-400" />
        ) : (
          <Check size={14} className="text-emerald-500" />
        )}
      </div>

      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${bgColor}18`, color: bgColor }}
      >
        {isTransfer ? <ArrowDown size={18} /> : <IconComp size={18} />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100 uppercase tracking-tight truncate">
          {tx.description || tx.categories?.name || (isIncome ? 'Receita' : 'Despesa')}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
          {tx.categories?.name || 'Geral'}{tx.accounts?.name ? ` • ${tx.accounts.name}` : ''}
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {format(parseISO(tx.date), "dd 'de' MMM", { locale: ptBR })}
        </p>
        <p className={`text-[14px] font-bold mt-0.5 ${
          isIncome || isTransfer ? 'text-emerald-600' : 'text-red-500'
        }`}>
          {isIncome ? '+ ' : isTransfer ? '' : '- '}
          {formatCurrency(Number(tx.amount) || 0)}
        </p>
      </div>
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <ContextProvider>
      <Suspense fallback={<div className="text-center py-20 text-gray-400">Carregando...</div>}>
        <TransactionContent />
      </Suspense>
    </ContextProvider>
  )
}