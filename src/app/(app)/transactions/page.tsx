'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, Plus, Clock, Check, CreditCard,
  Search, X, ArrowLeftRight, Paperclip, Image as ImageIcon,
  Calendar, Download, AlertCircle
} from 'lucide-react'
import { format, isToday, isYesterday, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/Skeleton'

export default function TransactionsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer' | 'pending'>('all')
  const [dateRange, setDateRange] = useState<'7' | '14' | '30' | 'all'>('all')
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadTransactions = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    let query = supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('status', { ascending: true })   // pendentes primeiro
      .order('date', { ascending: false })     // depois por data (mais recente primeiro)
      .limit(100)

    if (dateRange !== 'all') {
      const days = parseInt(dateRange)
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
      query = query.gte('date', startDate)
    }

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
    const txs = Array.isArray(data) ? data : []

    setTransactions(txs)
    setLoading(false)
  }, [user?.id, context, filter, search, dateRange])

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

  const getReceiptIcon = (receiptUrl: string | null) => {
    if (!receiptUrl) return null
    const isPdf = receiptUrl.toLowerCase().endsWith('.pdf')
    return isPdf ? 'pdf' : 'image'
  }

  const groupByDate = (txs: any[]) => {
    const groups: Record<string, any[]> = {}
    txs.forEach(tx => {
      const key = tx.date
      if (!groups[key]) groups[key] = []
      groups[key].push(tx)
    })
    return Object.entries(groups)
  }

  const pendingTransactions = transactions.filter(t => t.status === 'pending')
  const completedTransactions = transactions.filter(t => t.status !== 'pending')
  const groupedCompleted = groupByDate(completedTransactions)

  const filters = [
    { id: 'all', label: 'Todas' },
    { id: 'income', label: 'Receitas' },
    { id: 'expense', label: 'Despesas' },
    { id: 'transfer', label: 'Transferências' },
    { id: 'pending', label: 'Pendentes' },
  ]

  const dateRangeOptions = [
    { id: '7', label: '7 dias' },
    { id: '14', label: '14 dias' },
    { id: '30', label: '30 dias' },
    { id: 'all', label: 'Todo período' },
  ]

  const handleExport = async (exportFormat: 'csv' | 'pdf') => {
    if (!user?.id || transactions.length === 0) return
    setExporting(true)

    try {
      if (exportFormat === 'csv') {
        const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status', 'Comprovante']
        const rows = transactions.map(tx => [
          tx.date,
          tx.description || tx.categories?.name || 'Sem descrição',
          tx.categories?.name || 'Geral',
          tx.type === 'income' ? 'Receita' : tx.type === 'transfer' ? 'Transferência' : 'Despesa',
          Number(tx.amount).toFixed(2),
          tx.status === 'done' ? 'Concluída' : 'Pendente',
          tx.receipt_url ? 'Sim' : 'Não'
        ])

        const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `dfl-extrato-${dateRange}-dias.csv`
        link.click()
        URL.revokeObjectURL(url)

        showToast('Extrato CSV baixado!', 'success')
      } else {
        const startDate = dateRange !== 'all' ? format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd') : ''
        window.open(
          `/api/export-pdf?userId=${user.id}&context=${context}&range=${dateRange}&startDate=${startDate}`,
          '_blank'
        )
      }
    } catch (err: any) {
      showToast('Erro ao exportar.', 'error')
    } finally {
      setExporting(false)
      setShowExportModal(false)
    }
  }

  const TransactionCard = ({ tx, index }: { tx: any; index: number }) => {
    const isPending = tx.status === 'pending'
    const isIncome = tx.type === 'income'
    const isTransfer = tx.type === 'transfer'
    const IconComp = getDynamicIcon(tx.categories?.icon)
    const receiptType = getReceiptIcon(tx.receipt_url)

    return (
      <div
        onClick={() => router.push(`/transactions/${tx.id}`)}
        className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl cursor-pointer hover:shadow-sm transition-all border border-gray-50 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-2"
        style={{ animationDelay: `${index * 30}ms` }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
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

          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${tx.categories?.color || '#94a3b8'}15`, color: tx.categories?.color || '#64748b' }}
          >
            <IconComp size={16} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate">
                {tx.description || tx.categories?.name || (isTransfer ? 'Transferência' : 'Sem descrição')}
              </p>
              {receiptType === 'image' && (
                <ImageIcon size={12} className="text-teal-500 flex-shrink-0" />
              )}
              {receiptType === 'pdf' && (
                <Paperclip size={12} className="text-teal-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-[10px] text-gray-400 truncate">
              {tx.categories?.name || 'Geral'}
              {tx.credit_card_id && (
                <span className="ml-1 text-orange-400">• Crédito</span>
              )}
            </p>
          </div>
        </div>

        <p className={`text-[14px] font-bold whitespace-nowrap ml-2 ${
          isIncome ? 'text-emerald-600' :
          isTransfer ? 'text-blue-600' :
          'text-red-600'
        }`}>
          {isIncome ? '+' : isTransfer ? '↔' : '-'}{formatCurrency(Number(tx.amount) || 0)}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Transações</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowExportModal(true)} className="p-2 text-gray-400 hover:text-teal-600 transition-colors rounded-full" title="Exportar extrato">
              <Download size={20} />
            </button>
            <button onClick={() => setShowDateFilter(!showDateFilter)} className={`p-2 rounded-full transition-colors ${dateRange !== 'all' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-400 hover:text-gray-600'}`} title="Filtrar por período">
              <Calendar size={20} />
            </button>
            <button onClick={() => router.push('/transactions/new')} className="p-2 -mr-2 text-teal-700 dark:text-teal-400">
              <Plus size={24} />
            </button>
          </div>
        </div>
        <ContextToggle />

        {showDateFilter && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {dateRangeOptions.map(opt => (
              <button key={opt.id} onClick={() => { setDateRange(opt.id as any); setShowDateFilter(false) }} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${dateRange === opt.id ? 'bg-teal-100 dark:bg-teal-900/40 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className="relative mt-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar transações..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl text-sm outline-none text-gray-700 dark:text-gray-300" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {filters.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id as any)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${filter === f.id ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700 text-teal-800 dark:text-teal-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-3"><Skeleton variant="rect" height="64px" count={5} className="mb-2" /></div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4"><Search size={24} className="text-gray-400" /></div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma transação encontrada</p>
            <p className="text-gray-400 text-xs mt-1">Tente ajustar os filtros ou criar uma nova.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingTransactions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1.5"><AlertCircle size={12} />Pendentes</h3>
                  <span className="text-[10px] text-gray-400 font-medium">{pendingTransactions.length} transação{pendingTransactions.length > 1 ? 'ões' : ''}</span>
                </div>
                <div className="space-y-1">
                  {pendingTransactions.map((tx, index) => (<TransactionCard key={tx.id} tx={tx} index={index} />))}
                </div>
              </div>
            )}

            {groupedCompleted.map(([date, txs], groupIndex) => (
              <div key={date}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{formatDateHeader(date)}</h3>
                  <span className="text-[10px] text-gray-400 font-medium">{txs.length} transação{txs.length > 1 ? 'ões' : ''}</span>
                </div>
                <div className="space-y-1">
                  {txs.map((tx, index) => (<TransactionCard key={tx.id} tx={tx} index={(groupIndex * 10) + index} />))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowExportModal(false)}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-t-[32px] sm:rounded-3xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Exportar Extrato</h3>
              <button onClick={() => setShowExportModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-3 tracking-widest">Período</p>
            <div className="flex gap-2 mb-6">
              {dateRangeOptions.map(opt => (
                <button key={opt.id} onClick={() => setDateRange(opt.id as any)} className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${dateRange === opt.id ? 'bg-teal-700 text-white shadow-md' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-slate-600'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <button onClick={() => handleExport('csv')} disabled={exporting || transactions.length === 0} className="w-full flex items-center gap-4 p-4 rounded-[20px] bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-900/30 hover:bg-teal-100 transition-colors disabled:opacity-50">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm"><Download size={20} className="text-teal-700 dark:text-teal-400" /></div>
                <div className="text-left flex-1">
                  <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">Baixar CSV</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{transactions.length} transações • Planilha compatível com Excel</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}