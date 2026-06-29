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
  RefreshCw,
  Download,
  PieChart,
  ArrowDown,
  X,
  Edit3,
  Banknote,
} from 'lucide-react'
import { getDynamicIcon } from '@/lib/iconUtils'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import InvoiceAlert from '@/components/InvoiceAlert'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'

function CardDetailContent() {
  const router = useRouter()
  const params = useParams()
  const cardId = params?.id as string
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [card, setCard] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSpent, setTotalSpent] = useState(0)
  const [availableLimit, setAvailableLimit] = useState(0)
  const [estornosTotal, setEstornosTotal] = useState(0)

  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('0,00')
  const [adjustDescription, setAdjustDescription] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)

  const [showLimitModal, setShowLimitModal] = useState(false)
  const [newLimit, setNewLimit] = useState('')
  const [limitSaving, setLimitSaving] = useState(false)

  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [payAccountId, setPayAccountId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const loadCardData = useCallback(async () => {
    if (!user?.id || !cardId) return
    setLoading(true)

    // 🔧 CORREÇÃO: busca o cartão SEM filtrar por context
    const { data: cardData } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single()

    if (!cardData) {
      router.push('/cards')
      return
    }
    setCard(cardData)

    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const [{ data: txsData }, { data: invoicesData }, { data: accsData }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, categories(name, icon, color)')
        .eq('credit_card_id', cardId)
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false }),
      supabase
        .from('credit_invoices')
        .select('*')
        .eq('user_id', user.id)
        .eq('credit_card_id', cardId)
        .order('closing_date', { ascending: false })
        .limit(6),
      supabase
        .from('accounts')
        .select('id, name, color')
        .eq('user_id', user.id)
        .eq('context', cardData.context)
        .order('name'),
    ])

    const txs = Array.isArray(txsData) ? txsData : []
    const despesas = txs.filter(t => t.type !== 'income')
    const estornos = txs.filter(t => t.type === 'income')
    const totalDespesas = despesas.reduce((a, t) => a + Number(t.amount || 0), 0)
    const totalEstornos = estornos.reduce((a, t) => a + Number(t.amount || 0), 0)
    const spent = totalDespesas - totalEstornos

    setTransactions(txs)
    setTotalSpent(spent)
    setEstornosTotal(totalEstornos)
    setInvoices(Array.isArray(invoicesData) ? invoicesData : [])
    setAccounts(Array.isArray(accsData) ? accsData : [])

    const limit = Number(cardData.limit_amount) || 0
    setAvailableLimit(limit - spent)

    setLoading(false)
  }, [user, cardId, currentDate, router])

  useEffect(() => {
    loadCardData()
  }, [loadCardData])

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1))
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
      type: 'income',
      status: 'done',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: adjustDescription || 'Estorno / Ajuste',
      credit_card_id: cardId,
      context: card.context,
      category_id: null,
    }

    const { error } = await supabase.from('transactions').insert([payload])
    if (error) {
      alert('Erro ao registrar estorno: ' + error.message)
    } else {
      setShowAdjustModal(false)
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

  const handleSaveLimit = async () => {
    if (!user?.id || !cardId) return
    const rawLimit = parseFloat(newLimit.replace(/\./g, '').replace(',', '.')) || 0
    if (rawLimit <= 0) {
      alert('Informe um valor válido para o limite.')
      return
    }
    setLimitSaving(true)
    const { error } = await supabase
      .from('credit_cards')
      .update({ limit_amount: rawLimit })
      .eq('id', cardId)
      .eq('user_id', user.id)
    if (error) {
      alert('Erro ao salvar limite: ' + error.message)
    } else {
      setShowLimitModal(false)
      loadCardData()
    }
    setLimitSaving(false)
  }

  const handleLimitInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setNewLimit('0,00')
      return
    }
    const numValue = parseFloat(digits) / 100
    setNewLimit(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const openPayModal = (invoice: any) => {
    setSelectedInvoice(invoice)
    const remaining = Number(invoice.total_amount) - Number(invoice.paid_amount || 0)
    setPayAmount(remaining.toFixed(2).replace('.', ','))
    setPayAccountId('')
    setShowPayModal(true)
  }

  const handlePayInvoice = async () => {
    if (!selectedInvoice || !payAccountId || !user?.id) return
    setPaying(true)

    const rawAmount = parseFloat(payAmount.replace(/\./g, '').replace(',', '.'))
    if (isNaN(rawAmount) || rawAmount <= 0) {
      showToast('Valor inválido.', 'warning')
      setPaying(false)
      return
    }

    try {
      const { data: accData, error: accError } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', payAccountId)
        .eq('user_id', user.id)
        .single()

      if (accError) throw accError

      const newBalance = (Number(accData.balance) || 0) - rawAmount

      await supabase
        .from('accounts')
        .update({ balance: newBalance })
        .eq('id', payAccountId)
        .eq('user_id', user.id)

      await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'expense',
          amount: rawAmount,
          description: `Pagamento fatura ${card.name} - ${format(new Date(selectedInvoice.closing_date), "MMM/yy", { locale: ptBR })}`,
          account_id: payAccountId,
          date: new Date().toISOString().split('T')[0],
          status: 'done',
          context: card.context,
          category_id: null,
        })

      const newPaidAmount = (Number(selectedInvoice.paid_amount) || 0) + rawAmount
      const totalAmount = Number(selectedInvoice.total_amount)
      const newStatus = newPaidAmount >= totalAmount ? 'paid' : 'partial'

      await supabase
        .from('credit_invoices')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedInvoice.id)

      showToast('Fatura paga com sucesso!', 'success')
      setShowPayModal(false)
      loadCardData()
    } catch (err: any) {
      console.error('Erro ao pagar fatura:', err)
      showToast(`Erro: ${err.message}`, 'error')
    } finally {
      setPaying(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return { label: 'Aberta', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' }
      case 'closed':
        return { label: 'Fechada', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' }
      case 'paid':
        return { label: 'Paga', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' }
      case 'partial':
        return { label: 'Parcial', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' }
      default:
        return { label: status, color: 'bg-gray-50 text-gray-600' }
    }
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/cards/${cardId}/edit`)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
            title="Editar cartão"
          >
            <Edit3 size={20} />
          </button>
          <ContextToggle />
        </div>
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
            <button
              onClick={(e) => {
                e.stopPropagation()
                setNewLimit((Number(card.limit_amount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                setShowLimitModal(true)
              }}
              className="text-white/60 text-[10px] underline hover:text-white mt-1"
            >
              Ajustar limite
            </button>
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

      {/* Seção de Faturas */}
      {invoices.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">Faturas</h3>
          <div className="space-y-2">
            {invoices.slice(0, 3).map((invoice) => {
              const statusBadge = getStatusBadge(invoice.status)
              const remaining = Number(invoice.total_amount) - Number(invoice.paid_amount || 0)
              const progress = Number(invoice.total_amount) > 0
                ? ((Number(invoice.paid_amount) || 0) / Number(invoice.total_amount)) * 100
                : 0

              return (
                <div key={invoice.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-[13px] text-gray-800 dark:text-gray-200">
                        {format(new Date(invoice.closing_date), "MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Vence {format(new Date(invoice.due_date), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadge.color}`}>
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500 dark:text-gray-400">Total</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(Number(invoice.total_amount))}</span>
                  </div>

                  {Number(invoice.paid_amount) > 0 && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500 dark:text-gray-400">Pago</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(Number(invoice.paid_amount))}</span>
                    </div>
                  )}

                  {invoice.status !== 'paid' && remaining > 0 && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500 dark:text-gray-400">Restante</span>
                      <span className="font-bold text-red-600">{formatCurrency(remaining)}</span>
                    </div>
                  )}

                  {Number(invoice.paid_amount) > 0 && (
                    <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 mb-2 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
                    </div>
                  )}

                  {(invoice.status === 'open' || invoice.status === 'partial') && remaining > 0 && (
                    <button
                      onClick={() => openPayModal(invoice)}
                      className="w-full py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Banknote size={14} />
                      Pagar fatura
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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

      {/* Modal de Pagamento de Fatura */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => !paying && setShowPayModal(false)}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Pagar Fatura</h3>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 dark:text-gray-500 p-1"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {format(new Date(selectedInvoice.closing_date), "MMMM 'de' yyyy", { locale: ptBR })}
            </p>

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Valor</label>
              <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                <span className="text-gray-400 dark:text-gray-500 font-bold mr-2">R$</span>
                <input
                  type="text"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="bg-transparent w-full outline-none font-bold text-gray-800 dark:text-gray-200 text-lg"
                  placeholder="0,00"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Restante: {formatCurrency(Number(selectedInvoice.total_amount) - Number(selectedInvoice.paid_amount || 0))}
              </p>
            </div>

            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-2">Conta</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setPayAccountId(acc.id)}
                    className={`w-full p-3 flex items-center gap-3 rounded-xl transition-colors ${
                      payAccountId === acc.id
                        ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700'
                        : 'bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600'
                    }`}
                  >
                    <BankLogo color={acc.color} name={acc.name} size="sm" />
                    <span className={`font-medium text-sm ${payAccountId === acc.id ? 'text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {acc.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handlePayInvoice}
              disabled={paying || !payAccountId || !payAmount}
              className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {paying ? <Loader2 size={20} className="animate-spin" /> : null}
              {paying ? 'Pagando...' : 'Confirmar pagamento'}
            </button>
          </div>
        </div>
      )}

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

      {/* Modal de Ajuste de Limite */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowLimitModal(false)}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Ajustar Limite</h3>
              <button onClick={() => setShowLimitModal(false)} className="text-gray-400 dark:text-gray-500 p-1"><X size={20} /></button>
            </div>
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-2">Novo limite (R$)</label>
              <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                <span className="text-gray-400 dark:text-gray-500 font-bold mr-2">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newLimit}
                  onChange={handleLimitInputChange}
                  className="bg-transparent w-full outline-none font-bold text-gray-800 dark:text-gray-200 text-lg"
                  placeholder="0,00"
                />
              </div>
            </div>
            <button
              onClick={handleSaveLimit}
              disabled={limitSaving}
              className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50"
            >
              {limitSaving ? <Loader2 size={20} className="animate-spin" /> : 'Salvar'}
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