'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Loader2, Check, Trash2, X, Calendar, RefreshCw,
  TrendingUp, TrendingDown, ArrowRightLeft, Building2, User,
  Wallet, ArrowDown, ArrowUp, AlertTriangle, Clock, CheckCircle2
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import BankLogo from '@/components/BankLogo'

// ============================================================
// SKELETON LOADER
// ============================================================
const LoanDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-6">
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full" />
      <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
      <div className="w-10" />
    </div>

    {/* Card Principal */}
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-4 w-36 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl p-3 bg-gray-100 dark:bg-slate-700">
            <div className="h-3 w-16 bg-gray-200 dark:bg-slate-600 rounded mx-auto mb-2" />
            <div className="h-5 w-20 bg-gray-200 dark:bg-slate-600 rounded mx-auto" />
          </div>
        ))}
      </div>
      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
        <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-1/2" />
      </div>
      <div className="h-3 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
    </div>

    {/* Histórico */}
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl mb-2">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 dark:bg-slate-600 rounded" />
            <div className="h-3 w-32 bg-gray-100 dark:bg-slate-600/50 rounded" />
          </div>
          <div className="w-6 h-6 bg-gray-200 dark:bg-slate-600 rounded" />
        </div>
      ))}
    </div>
  </div>
)

export default function LoanDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [loan, setLoan] = useState<any>(null)
  const [repayments, setRepayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Modal de pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [payAmount, setPayAmount] = useState('0,00')
  const [payAmountNum, setPayAmountNum] = useState(0)
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [payNote, setPayNote] = useState('')

  // Pull to refresh
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
      loadData().finally(() => setRefreshing(false))
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

  const loadData = useCallback(async () => {
    if (!id || !user?.id) return
    setLoading(true)

    const { data: loanData } = await supabase
      .from('loans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!loanData) {
      router.push('/loans')
      return
    }

    setLoan(loanData)

    const { data: repData } = await supabase
      .from('loan_repayments')
      .select('*')
      .eq('loan_id', id)
      .order('payment_date', { ascending: false })

    setRepayments(Array.isArray(repData) ? repData : [])
    setLoading(false)
  }, [id, user])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handlePayAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setPayAmount('0,00')
      setPayAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setPayAmountNum(num)
    setPayAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handlePayment = async () => {
    if (!user?.id || payAmountNum <= 0) return
    if (payAmountNum > Number(loan.remaining_amount)) {
      showToast('O valor não pode ser maior que o saldo devedor.', 'warning')
      return
    }

    setSaving(true)

    try {
      // 1. Criar transação de despesa no source_context
      const { data: sourceTx, error: sourceError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'expense',
          amount: payAmountNum,
          description: payNote || `Pagamento de empréstimo (${loan.source_context} → ${loan.dest_context})`,
          date: payDate,
          status: 'done',
          context: loan.source_context,
        })
        .select()
        .single()

      if (sourceError) throw sourceError

      // 2. Criar transação de receita no dest_context
      const { data: destTx, error: destError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'income',
          amount: payAmountNum,
          description: payNote || `Recebimento de empréstimo (${loan.source_context} → ${loan.dest_context})`,
          date: payDate,
          status: 'done',
          context: loan.dest_context,
        })
        .select()
        .single()

      if (destError) throw destError

      // 3. Registrar o pagamento
      const { error: repError } = await supabase
        .from('loan_repayments')
        .insert({
          loan_id: id,
          amount: payAmountNum,
          payment_date: payDate,
          source_transaction_id: sourceTx.id,
          dest_transaction_id: destTx.id,
        })

      if (repError) throw repError

      // 4. Atualizar o empréstimo
      const newRemaining = Number(loan.remaining_amount) - payAmountNum
      const newPaidInstallments = loan.paid_installments + 1
      const newStatus = newRemaining <= 0 ? 'completed' : 'active'

      await supabase
        .from('loans')
        .update({
          remaining_amount: newRemaining,
          paid_installments: newPaidInstallments,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      showToast('Pagamento registrado com sucesso!', 'success')
      setShowPaymentModal(false)
      setPayAmount('0,00')
      setPayAmountNum(0)
      setPayNote('')
      loadData()
    } catch (err: any) {
      showToast(`Erro ao registrar pagamento: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const getContextLabel = (ctx: string) => ctx === 'dfl' ? 'PJ' : 'PF'
  const getContextIcon = (ctx: string) =>
    ctx === 'dfl' ? <Building2 size={16} className="text-blue-500" /> : <User size={16} className="text-emerald-500" />

  // Skeleton enquanto carrega
  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-20 font-sans transition-colors duration-300">
        <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 sticky top-0 z-10 border-b border-gray-50 dark:border-slate-700">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-10" />
        </div>
        <LoanDetailSkeleton />
      </div>
    )
  }

  if (!loan) return null

  const progress = Number(loan.total_amount) > 0
    ? ((Number(loan.total_amount) - Number(loan.remaining_amount)) / Number(loan.total_amount)) * 100
    : 0
  const isCompleted = loan.status === 'completed'
  const isActive = loan.status === 'active'
  const daysUntilDue = loan.due_date ? differenceInDays(new Date(loan.due_date), new Date()) : null
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && isActive
  const isNearDue = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7 && isActive

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-32 font-sans transition-colors duration-300">
      {/* Pull to refresh */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 sticky top-0 z-10 border-b border-gray-50 dark:border-slate-700">
        <button onClick={() => router.push('/loans')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          {isCompleted && <CheckCircle2 size={18} className="text-emerald-500" />}
          {isOverdue && <AlertTriangle size={18} className="text-red-500" />}
          <h1 className="font-bold text-[17px] text-gray-800 dark:text-gray-100">Detalhes do Empréstimo</h1>
        </div>
        <div className="w-10" />
      </div>

      <div className="px-4 pt-4 space-y-4 animate-in fade-in duration-300">
        {/* Card Principal */}
        <div className={`bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border ${
          isOverdue ? 'border-red-200 dark:border-red-800' :
          isCompleted ? 'border-emerald-200 dark:border-emerald-800' :
          'border-gray-50 dark:border-slate-700'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isActive ? 'bg-teal-50 dark:bg-teal-900/30' :
              isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/30' :
              'bg-gray-100 dark:bg-slate-700'
            }`}>
              <ArrowRightLeft size={24} className={
                isActive ? 'text-teal-600 dark:text-teal-400' :
                isCompleted ? 'text-emerald-600 dark:text-emerald-400' :
                'text-gray-400'
              } />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-sm font-bold text-gray-800 dark:text-gray-200">
                  {getContextIcon(loan.source_context)}
                  {getContextLabel(loan.source_context)}
                </span>
                <ArrowRightLeft size={14} className="text-gray-400" />
                <span className="flex items-center gap-1 text-sm font-bold text-gray-800 dark:text-gray-200">
                  {getContextIcon(loan.dest_context)}
                  {getContextLabel(loan.dest_context)}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {loan.description || 'Empréstimo'} • {loan.paid_installments}/{loan.total_installments} parcelas
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Total</p>
              <p className="text-[18px] font-bold text-gray-800 dark:text-gray-200">{formatCurrency(Number(loan.total_amount))}</p>
            </div>
            <div className={`text-center rounded-xl p-3 ${
              isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/20' :
              isOverdue ? 'bg-red-50 dark:bg-red-900/20' :
              'bg-orange-50 dark:bg-orange-900/20'
            }`}>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Restante</p>
              <p className={`text-[18px] font-bold ${
                isCompleted ? 'text-emerald-600' :
                isOverdue ? 'text-red-500' :
                'text-orange-600'
              }`}>{formatCurrency(Number(loan.remaining_amount) || 0)}</p>
            </div>
          </div>

          <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
            <div className={`h-full rounded-full transition-all duration-700 ${
              isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'
            }`} style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>

          <div className="flex justify-between text-[11px]">
            <span className="text-gray-400 dark:text-gray-500 font-medium">{progress.toFixed(0)}% quitado</span>
            {isOverdue && (
              <span className="text-red-500 font-bold">Atrasado {Math.abs(daysUntilDue)} dia(s)</span>
            )}
            {isNearDue && (
              <span className="text-orange-500 font-bold">Vence em {daysUntilDue} dia(s)</span>
            )}
          </div>
        </div>

        {/* Botão de pagamento */}
        {isActive && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="w-full bg-teal-700 text-white py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-teal-700/20"
          >
            <ArrowUp size={16} />
            Registrar Pagamento
          </button>
        )}

        {/* Histórico de pagamentos */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
          <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Histórico de Pagamentos</h3>
          {repayments.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">Nenhum pagamento registrado.</p>
          ) : (
            <div className="space-y-2">
              {repayments.map(rep => (
                <div key={rep.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-emerald-600">
                        + {formatCurrency(Number(rep.amount) || 0)}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {format(new Date(rep.payment_date + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Pagamento */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 animate-in slide-in-from-bottom-10 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Registrar Pagamento</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 p-2"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Valor pago</label>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                  <span className="text-gray-400 dark:text-gray-500 font-bold">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={payAmount}
                    onChange={handlePayAmountChange}
                    className="bg-transparent text-lg font-bold text-gray-800 dark:text-gray-200 outline-none w-full"
                    placeholder="0,00"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Saldo devedor: {formatCurrency(Number(loan.remaining_amount) || 0)}</p>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Data do pagamento</label>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                  <Calendar size={16} className="text-gray-400" />
                  <input
                    type="date"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="bg-transparent text-sm font-bold text-gray-800 dark:text-gray-200 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Observação (opcional)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="Ex: Pagamento da parcela 1"
                  className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200"
                />
              </div>

              <button
                onClick={handlePayment}
                disabled={saving || payAmountNum <= 0}
                className="w-full bg-teal-700 text-white py-4 rounded-xl font-bold disabled:opacity-50 hover:bg-teal-800 transition-colors"
              >
                {saving ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
