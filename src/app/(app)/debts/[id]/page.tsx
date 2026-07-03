'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Loader2, Check, Trash2, X, Calendar, RefreshCw,
  TrendingUp, TrendingDown, ArrowLeftRight, Building2, User,
  Wallet, Clock, AlertTriangle, CheckCircle2, Edit3, Plus
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { formatCurrency } from '@/lib/utils'

// ============================================================
// SKELETON LOADER (CORES SUAVES)
// ============================================================
const DebtDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-6 space-y-4">
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-28 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
        <div className="h-7 w-24 bg-gray-200 dark:bg-slate-700 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-3 bg-gray-100 dark:bg-slate-700 text-center">
          <div className="h-3 w-16 bg-gray-200 dark:bg-slate-600 rounded mx-auto mb-2" />
          <div className="h-6 w-24 bg-gray-200 dark:bg-slate-600 rounded mx-auto" />
        </div>
        <div className="rounded-xl p-3 bg-gray-100 dark:bg-slate-700 text-center">
          <div className="h-3 w-16 bg-gray-200 dark:bg-slate-600 rounded mx-auto mb-2" />
          <div className="h-6 w-24 bg-gray-200 dark:bg-slate-600 rounded mx-auto" />
        </div>
      </div>
      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
        <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-1/2" />
      </div>
      <div className="h-3 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      {[1, 2, 3].map((i) => (
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

export default function DebtDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { context, appMode } = useContext_()
  const { showToast } = useToast()

  const [debt, setDebt] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [payAmount, setPayAmount] = useState('0,00')
  const [payAmountNum, setPayAmountNum] = useState(0)
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [payNote, setPayNote] = useState('')

  const [showDeleteModal, setShowDeleteModal] = useState(false)

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
    setLoadingPulse(true)

    const { data: debtData } = await supabase
      .from('debts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!debtData) {
      router.push('/debts')
      return
    }

    setDebt(debtData)

    const { data: payData } = await supabase
      .from('transactions')
      .select('*')
      .eq('debt_id', id)
      .eq('user_id', user.id)
      .eq('type', 'income')
      .order('date', { ascending: false })

    setPayments(Array.isArray(payData) ? payData : [])
    setLoading(false)
    setLoadingPulse(false)
  }, [id, user])

  useEffect(() => { loadData() }, [loadData])

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

  // 🔧 CORREÇÃO: Função para buscar uma conta padrão do contexto atual
  const getDefaultAccount = async (): Promise<string | null> => {
    if (!user?.id || !context) return null

    const { data, error } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    return data.id
  }

  const handlePayment = async () => {
    if (!user?.id) {
      showToast('Usuário não autenticado.', 'error')
      return
    }

    if (!context) {
      showToast('Selecione um contexto (PF ou PJ) antes de registrar.', 'warning')
      return
    }

    if (payAmountNum <= 0) {
      showToast('Digite um valor válido.', 'warning')
      return
    }

    const remaining = Number(debt.total_amount) - Number(debt.paid_amount || 0)
    if (payAmountNum > remaining) {
      showToast('Valor excede o saldo devedor.', 'warning')
      return
    }

    setSaving(true)

    try {
      // Buscar uma conta padrão para o contexto atual
      const accountId = await getDefaultAccount()
      if (!accountId) {
        showToast('Nenhuma conta encontrada para este contexto. Crie uma conta primeiro.', 'warning')
        setSaving(false)
        return
      }

      // Buscar uma categoria padrão para receitas
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('context', context)
        .eq('type', 'income')
        .limit(1)
        .single()

      const categoryId = categoryData?.id || null

      // 1. Registrar pagamento como transação (receita)
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          context: context,
          type: 'income',
          amount: payAmountNum,
          description: payNote || `Pagamento da dívida - ${debt.person_name}`,
          date: payDate,
          status: 'done',
          affects_balance: true,
          debt_id: id,
          account_id: accountId,
          category_id: categoryId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (txError) throw txError

      // 2. Atualizar dívida
      const newPaid = Number(debt.paid_amount || 0) + payAmountNum
      const newStatus = newPaid >= Number(debt.total_amount) ? 'paid' : 'partial'

      await supabase
        .from('debts')
        .update({
          paid_amount: newPaid,
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
      console.error('Erro ao registrar pagamento:', err)
      showToast(`Erro ao registrar pagamento: ${err.message || 'Erro desconhecido'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setSaving(true)
    try {
      await supabase.from('debts').delete().eq('id', id)
      showToast('Dívida excluída.', 'info')
      router.push('/debts')
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    } finally {
      setSaving(false)
      setShowDeleteModal(false)
    }
  }

  const getStatusConfig = (status: string, dueDate: string) => {
    if (status === 'paid') return { label: 'Pago', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' }
    if (status === 'cancelled') return { label: 'Cancelado', icon: AlertTriangle, color: 'text-gray-500 bg-gray-100 dark:bg-slate-700' }
    const daysUntilDue = differenceInDays(new Date(dueDate), new Date())
    if (daysUntilDue < 0) return { label: `Atrasado ${Math.abs(daysUntilDue)}d`, icon: AlertTriangle, color: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400' }
    if (daysUntilDue <= 7) return { label: `Vence em ${daysUntilDue}d`, icon: Clock, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400' }
    return { label: 'Em dia', icon: CheckCircle2, color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400' }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-20 font-sans transition-colors duration-300">
        <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 sticky top-0 z-10 border-b border-gray-50 dark:border-slate-700">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-10" />
        </div>
        <DebtDetailSkeleton />
      </div>
    )
  }

  if (!debt) return null

  const IconComp = getDynamicIcon(debt.icon || 'user')
  const progress = Number(debt.total_amount) > 0
    ? ((Number(debt.paid_amount || 0) / Number(debt.total_amount)) * 100)
    : 0
  const statusConfig = getStatusConfig(debt.status, debt.due_date)
  const isActive = debt.status !== 'paid' && debt.status !== 'cancelled'
  const remaining = Number(debt.total_amount) - Number(debt.paid_amount || 0)

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-32 font-sans transition-colors duration-300">
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

      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 sticky top-0 z-10 border-b border-gray-50 dark:border-slate-700">
        <button onClick={() => router.push('/debts')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <statusConfig.icon size={18} className={statusConfig.color.split(' ')[0]} />
          <h1 className="font-bold text-[17px] text-gray-800 dark:text-gray-100 truncate max-w-[180px]">
            {debt.person_name || 'Dívida'}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push(`/debts/${id}/edit`)}
            className="p-2 text-gray-400 hover:text-teal-600 transition-colors"
          >
            <Edit3 size={18} />
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 animate-in fade-in duration-300">
        <div className={`bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border ${
          debt.status === 'paid' ? 'border-emerald-200 dark:border-emerald-800' :
          debt.status === 'cancelled' ? 'border-gray-200 dark:border-gray-700' :
          'border-gray-50 dark:border-slate-700'
        }`}>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${debt.color || '#14b8a6'}20`, color: debt.color || '#14b8a6' }}>
              <IconComp size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-[17px] text-gray-800 dark:text-gray-200 truncate">
                  {debt.person_name}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap ${statusConfig.color}`}>
                  <statusConfig.icon size={12} />
                  {statusConfig.label}
                </span>
              </div>
              {debt.description && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {debt.description}
                </p>
              )}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                <Calendar size={10} />
                {format(new Date(debt.due_date), "dd 'de' MMM yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Total</p>
              <p className="text-[18px] font-bold text-gray-800 dark:text-gray-200">{formatCurrency(Number(debt.total_amount))}</p>
            </div>
            <div className={`text-center rounded-xl p-3 ${
              remaining <= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' :
              debt.status === 'cancelled' ? 'bg-gray-50 dark:bg-slate-700' :
              'bg-orange-50 dark:bg-orange-900/20'
            }`}>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Restante</p>
              <p className={`text-[18px] font-bold ${
                remaining <= 0 ? 'text-emerald-600' :
                debt.status === 'cancelled' ? 'text-gray-500' :
                'text-orange-600'
              }`}>{formatCurrency(Math.max(remaining, 0))}</p>
            </div>
          </div>

          <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
            <div className={`h-full rounded-full transition-all duration-700 ${
              debt.status === 'paid' ? 'bg-emerald-500' :
              debt.status === 'cancelled' ? 'bg-gray-400' :
              'bg-teal-500'
            }`} style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>

          <div className="flex justify-between text-[11px]">
            <span className="text-gray-400 dark:text-gray-500 font-medium">{Math.min(progress, 100).toFixed(0)}% pago</span>
            <span className="text-gray-400 dark:text-gray-500 font-medium">
              {formatCurrency(Number(debt.paid_amount || 0))} / {formatCurrency(Number(debt.total_amount))}
            </span>
          </div>
        </div>

        {isActive && remaining > 0 && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="w-full bg-teal-700 text-white py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-teal-700/20"
          >
            <Plus size={16} />
            Registrar Pagamento
          </button>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
          <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-gray-400" />
            Histórico de Pagamentos
          </h3>
          {payments.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">
              Nenhum pagamento registrado.
            </p>
          ) : (
            <div className="space-y-2">
              {payments.map(pay => (
                <div key={pay.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-emerald-600">
                        + {formatCurrency(Number(pay.amount) || 0)}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {format(new Date(pay.date + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  {pay.description && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 max-w-[120px] truncate">
                      {pay.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 animate-in slide-in-from-bottom-10 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Registrar Pagamento</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 p-2 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Valor pago</label>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                  <span className="text-gray-400 dark:text-gray-500 font-bold">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={payAmount}
                    onChange={handlePayAmountChange}
                    className="bg-transparent text-lg font-bold text-gray-800 dark:text-gray-200 outline-none w-full"
                    placeholder="0,00"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Saldo devedor: {formatCurrency(Math.max(remaining, 0))}</p>
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
                  placeholder="Ex: Pagamento parcial da dívida"
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

      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-[90%] max-w-sm rounded-2xl p-6 animate-in fade-in-zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2 text-center">Excluir Dívida?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              Essa ação não pode ser desfeita. Os pagamentos vinculados também serão removidos.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}