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
  X,
  Check,
} from 'lucide-react'
import { getDynamicIcon } from '@/lib/iconUtils'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import InvoiceAlert from '@/components/InvoiceAlert'

async function calculateCardLimit(cardId: string, userId: string) {
  const { data: card } = await supabase
    .from('credit_cards')
    .select('limit_amount')
    .eq('id', cardId)
    .single()

  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('credit_card_id', cardId)
    .eq('user_id', userId)

  const totalGastos = (txs || []).reduce((acc, t) => {
    return t.type === 'income' ? acc - Number(t.amount) : acc + Number(t.amount)
  }, 0)

  const novoLimite = Number(card?.limit_amount || 0) - totalGastos
  return Math.max(0, novoLimite)
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

  // Modal de ajuste (estorno)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('0,00')
  const [adjustDescription, setAdjustDescription] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const loadCardData = useCallback(async () => {
    if (!user?.id || !cardId) return
    setLoading(true)

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

    const despesas = txs.filter(t => t.type !== 'income')
    const estornos = txs.filter(t => t.type === 'income')
    const totalDespesas = despesas.reduce((a, t) => a + Number(t.amount || 0), 0)
    const totalEstornos = estornos.reduce((a, t) => a + Number(t.amount || 0), 0)
    const spent = totalDespesas - totalEstornos

    setTransactions(txs)
    setTotalSpent(spent)
    setEstornosTotal(totalEstornos)

    // Limite disponível recalculado
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
    setAdjustAmount('0,00')
    setAdjustDescription('')
    setShowAdjustModal(true)
  }

  const handleSaveAdjust = async () => {
    if (!user?.id || !cardId) return

    const rawAmount = parseFloat(adjustAmount.replace(/\./g, '').replace(',', '.')) || 0
    if (rawAmount <= 0) {
      alert('Informe um valor válido para o estorno.')
      return
    }

    setAdjustSaving(true)
    const payload = {
      user_id: user.id,
      amount: rawAmount,
      type: 'income', // Estorno é tratado como entrada no cartão
      status: 'done',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: adjustDescription || 'Estorno / Ajuste',
      credit_card_id: cardId,
      context: context,
      category_id: null,
    }

    const { error } = await supabase.from('transactions').insert([payload])
    if (error) {
      alert('Erro ao registrar estorno: ' + error.message)
    } else {
      setShowAdjustModal(false)
      // Recalcular limite e recarregar dados
      loadCardData()
    }
    setAdjustSaving(false)
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setAdjustAmount('0,00')
      return
    }
    const numValue = parseFloat(digits) / 100
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue)
    setAdjustAmount(formatted)
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
        <button onClick={() => navigateMonth('prev')} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 capitalize">{monthLabel}</span>
        <button onClick={() => navigateMonth('next')} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300">
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
        <button onClick={() => alert('Importação em breve')} className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-gray-50 dark:border-slate-700 flex flex-col items-center gap-1 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          <Download size={20} className="text-gray-500 dark:text-gray-400" />
          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Importar</span>
        </button>
        <button onClick={handleAdjustTotal} className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-gray-50 dark:border-slate-700 flex flex-col items-center gap-1 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          <RefreshCw size={20} className="text-gray-500 dark:text-gray-400" />
          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Ajustar</span>
        </button>
        <button onClick={() => router.push(`/analysis?cardId=${cardId}`)} className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-gray-50 dark:border-slate-700 flex flex-col items-center gap-1 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
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
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Sua fatura está vazia</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mb-4">Importe o PDF ou lance manualmente</p>
            <button onClick={() => router.push('/transactions/card-expense')} className="bg-teal-700 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-teal-800 transition-colors">
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
                        backgroundColor: isEstorno ? '#d1fae5' : `${tx.categories?.color || '#cbd5e1'}20`,
                        color: isEstorno ? '#059669' : tx.categories?.color || '#64748b'
                      }}
                    >
                      {isEstorno ? <RefreshCw size={18} /> : <IconComp size={18} />}
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
                    {isEstorno ? '+ ' : '- '}{formatCurrency(Number(tx.amount) || 0)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Ajuste (Estorno) */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdjustModal(false)}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Ajustar total (Estorno)</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-gray-400 dark:text-gray-500 p-1"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Registre um crédito na fatura (estorno).</p>
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Valor do crédito</label>
              <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                <span className="text-gray-400 dark:text-gray-500 font-bold mr-2">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={adjustAmount}
                  onChange={handleAmountChange}
                  className="bg-transparent w-full outline-none font-bold text-gray-800 dark:text-gray-200 text-lg"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Descrição (opcional)</label>
              <input
                type="text"
                value={adjustDescription}
                onChange={e => setAdjustDescription(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 outline-none text-sm text-gray-800 dark:text-gray-200"
                placeholder="Ex: Estorno da loja X"
              />
            </div>
            <button
              onClick={handleSaveAdjust}
              disabled={adjustSaving}
              className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50"
            >
              {adjustSaving ? 'Salvando...' : 'Registrar Estorno'}
            </button>
          </div>
        </div>
      )}

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