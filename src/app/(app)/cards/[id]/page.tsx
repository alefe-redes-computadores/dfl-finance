'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  CreditCard,
  Calendar,
  RefreshCw,
  Download,
  PieChart,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowDown,
  ArrowUp,
} from 'lucide-react'
import { getDynamicIcon } from '@/lib/iconUtils'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

function InvoiceAlert({ dueDay, closingDay }: { dueDay: number; closingDay: number }) {
  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  // Definir a data de vencimento do mês atual
  let dueDate = new Date(currentYear, currentMonth, dueDay)
  if (currentDay > dueDay) {
    dueDate = new Date(currentYear, currentMonth + 1, dueDay)
  }

  const diffTime = dueDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3">
        <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
        <div>
          <p className="font-bold text-red-700 dark:text-red-300 text-sm">Sua fatura vence hoje!</p>
          <p className="text-xs text-red-600 dark:text-red-400">Dia {dueDay} • Fecha dia {closingDay}</p>
        </div>
      </div>
    )
  } else if (diffDays < 0) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3">
        <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
        <div>
          <p className="font-bold text-red-700 dark:text-red-300 text-sm">
            Fatura vencida há {Math.abs(diffDays)} dias!
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">Venceu dia {dueDay} • Fecha dia {closingDay}</p>
        </div>
      </div>
    )
  } else if (diffDays <= 5) {
    return (
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 flex items-center gap-3">
        <Clock size={20} className="text-orange-600 dark:text-orange-400" />
        <div>
          <p className="font-bold text-orange-700 dark:text-orange-300 text-sm">
            Fatura vence em {diffDays} dias
          </p>
          <p className="text-xs text-orange-600 dark:text-orange-400">Dia {dueDay} • Fecha dia {closingDay}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-3">
      <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
      <div>
        <p className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
          Fatura vence em {diffDays} dias
        </p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Dia {dueDay} • Fecha dia {closingDay}</p>
      </div>
    </div>
  )
}

function CardDetailContent() {
  const router = useRouter()
  const params = useParams()
  const cardId = params?.id as string
  const { user } = useAuth()
  const { context } = useContext_()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [card, setCard] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSpent, setTotalSpent] = useState(0)
  const [availableLimit, setAvailableLimit] = useState(0)
  const [estornosTotal, setEstornosTotal] = useState(0)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const loadCardData = useCallback(async () => {
    if (!user?.id || !cardId) return
    setLoading(true)

    // Dados do cartão
    const { data: cardData } = await supabase
      .from('credit_cards')
      .select('*')
      .match({ id: cardId, user_id: user.id, context })
      .single()

    if (!cardData) {
      router.push('/cards')
      return
    }
    setCard(cardData)

    // Transações do mês
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const { data: txsData } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .match({ credit_card_id: cardId, user_id: user.id, context })
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    const txs = Array.isArray(txsData) ? txsData : []

    // Separar despesas e estornos
    const despesas = txs.filter(t => t.type !== 'income')
    const estornos = txs.filter(t => t.type === 'income')
    const totalDespesas = despesas.reduce((a, t) => a + Number(t.amount || 0), 0)
    const totalEstornos = estornos.reduce((a, t) => a + Number(t.amount || 0), 0)
    const spent = totalDespesas - totalEstornos

    setTransactions(txs)
    setTotalSpent(spent)
    setEstornosTotal(totalEstornos)

    // Limite disponível
    const limit = Number(cardData.limit_amount) || 0
    setAvailableLimit(limit - spent)

    setLoading(false)
  }, [user, cardId, context, currentDate, router])

  useEffect(() => {
    loadCardData()
  }, [loadCardData])

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev =>
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    )
  }

  const handleAdjustTotal = () => {
    // Abre modal de ajuste (estorno) - podemos implementar depois
    alert('Funcionalidade de ajuste em desenvolvimento')
  }

  const handleImportInvoice = () => {
    alert('Funcionalidade de importação em desenvolvimento')
  }

  const handleAnalysis = () => {
    router.push(`/analysis?cardId=${cardId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        <div className="text-center">
          <CreditCard size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Cartão não encontrado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/cards')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <ContextToggle />
        <div className="w-8" />
      </div>

      {/* Card Info */}
      <div
        className="rounded-2xl p-5 mb-4 text-white shadow-lg"
        style={{ backgroundColor: card.color || '#14b8a6' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <CreditCard size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">{card.name}</h1>
            <p className="text-white/70 text-xs">
              {card.flag || 'Cartão'} {card.last_four ? `•••• ${card.last_four}` : ''}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-white/70 text-[10px] font-bold uppercase">Limite Total</p>
            <p className="font-bold">{formatCurrency(card.limit_amount || 0)}</p>
          </div>
          <div>
            <p className="text-white/70 text-[10px] font-bold uppercase">Disponível</p>
            <p className="font-bold">{formatCurrency(availableLimit)}</p>
          </div>
          <div>
            <p className="text-white/70 text-[10px] font-bold uppercase">Fechamento</p>
            <p className="font-bold">Dia {card.closing_day}</p>
          </div>
          <div>
            <p className="text-white/70 text-[10px] font-bold uppercase">Vencimento</p>
            <p className="font-bold">Dia {card.due_day}</p>
          </div>
        </div>
      </div>

      {/* Invoice Alert */}
      <div className="mb-4">
        <InvoiceAlert dueDay={card.due_day} closingDay={card.closing_day} />
      </div>

      {/* Navegação de meses */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-full p-1.5 mb-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 capitalize">
          {monthLabel}
        </span>
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Resumo da fatura */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center shadow-sm border border-gray-50 dark:border-slate-700">
          <ArrowDown size={14} className="text-red-500 mx-auto mb-1" />
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">Total Gasto</p>
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center shadow-sm border border-gray-50 dark:border-slate-700">
          <RefreshCw size={14} className="text-emerald-500 mx-auto mb-1" />
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">Estornos</p>
          <p className="text-sm font-bold text-emerald-600">{formatCurrency(estornosTotal)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center shadow-sm border border-gray-50 dark:border-slate-700">
          <CreditCard size={14} className="text-teal-500 mx-auto mb-1" />
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">Limite Livre</p>
          <p className="text-sm font-bold text-teal-600">{formatCurrency(availableLimit)}</p>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          onClick={handleImportInvoice}
          className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-gray-50 dark:border-slate-700 flex flex-col items-center gap-1 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <Download size={20} className="text-gray-500 dark:text-gray-400" />
          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Importar</span>
        </button>
        <button
          onClick={handleAdjustTotal}
          className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-gray-50 dark:border-slate-700 flex flex-col items-center gap-1 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw size={20} className="text-gray-500 dark:text-gray-400" />
          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Ajustar</span>
        </button>
        <button
          onClick={handleAnalysis}
          className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-gray-50 dark:border-slate-700 flex flex-col items-center gap-1 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <PieChart size={20} className="text-gray-500 dark:text-gray-400" />
          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Análise</span>
        </button>
      </div>

      {/* Lista de transações da fatura */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-50 dark:border-slate-700 overflow-hidden">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 px-4 py-3 border-b border-gray-50 dark:border-slate-700">
          Lançamentos da fatura
        </h3>
        {transactions.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <CreditCard size={24} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">
              Sua fatura está vazia
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mb-4">
              Importe o PDF ou lance manualmente
            </p>
            <button
              onClick={() => router.push('/transactions/card-expense')}
              className="bg-teal-700 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-teal-800 transition-colors"
            >
              Nova despesa no cartão
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-700">
            {transactions.map((tx) => {
              const isEstorno = tx.type === 'income'
              const IconComp = getDynamicIcon(tx.categories?.icon)
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  onClick={() => router.push(`/transactions/${tx.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor: isEstorno
                          ? '#d1fae5'
                          : `${tx.categories?.color || '#cbd5e1'}20`,
                        color: isEstorno ? '#059669' : tx.categories?.color || '#64748b'
                      }}
                    >
                      {isEstorno ? (
                        <RefreshCw size={18} />
                      ) : (
                        <IconComp size={18} />
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                        {isEstorno ? 'Estorno / Ajuste' : tx.description || tx.categories?.name}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}
                        {tx.categories?.name && !isEstorno ? ` • ${tx.categories.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <p className={`text-[14px] font-bold ${isEstorno ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isEstorno ? '+ ' : '- '}
                    {formatCurrency(Number(tx.amount) || 0)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

export default function CardDetailPage() {
  return (
    <ContextProvider>
      <CardDetailContent />
    </ContextProvider>
  )
}
