'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Edit2, Loader2, Check, Trash2, Plus, X, Wallet, Calendar, User, MessageCircle,
  RefreshCw, AlertTriangle, Clock, ArrowUp, TrendingUp
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getDynamicIcon } from '@/lib/iconUtils'

// ============================================================
// SKELETON LOADER
// ============================================================
const DebtDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-6">
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full" />
      <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full" />
        <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full" />
        <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full" />
      </div>
    </div>

    {/* Card Principal */}
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-40 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl p-3 bg-gray-100 dark:bg-slate-700">
            <div className="h-3 w-12 bg-gray-200 dark:bg-slate-600 rounded mx-auto mb-2" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-slate-600 rounded mx-auto" />
          </div>
        ))}
      </div>
      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-2">
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

export default function DebtDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()

  const [debt, setDebt] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // WhatsApp
  const [whatsAppNumber, setWhatsAppNumber] = useState('')
  const [whatsAppMessage, setWhatsAppMessage] = useState('')

  // Pagamento
  const [payAmount, setPayAmount] = useState('0,00')
  const [payAmountNum, setPayAmountNum] = useState(0)
  const [payAccountId, setPayAccountId] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [showAccModal, setShowAccModal] = useState(false)

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

    const { data: debtData } = await supabase
      .from('debts')
      .select('*')
      .match({ id: id, user_id: user.id })
      .single()

    if (debtData) {
      setDebt(debtData)
      setWhatsAppMessage(`Olá ${debtData.person_name}, tudo bem? Preciso lembrar sobre o pagamento de R$ ${Number(debtData.total_amount).toFixed(2).replace('.', ',')}. Você pode verificar?`)
    }

    const { data: payData } = await supabase
      .from('transactions')
      .select('*')
      .eq('debt_id', id)
      .order('date', { ascending: false })

    setPayments(Array.isArray(payData) ? payData : [])

    const { data: accData } = await supabase
      .from('accounts')
      .select('id, name, color, balance')
      .match({ user_id: user.id, context: debtData?.context || 'dfl' })

    setAccounts(Array.isArray(accData) ? accData : [])
    setLoading(false)
  }, [id, user])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleDeleteDebt = async () => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return
    await supabase.from('debts').delete().eq('id', id)
    router.push('/debts')
  }

  const handleDeletePayment = async (paymentId: string, amount: number) => {
    if (!confirm('Excluir este pagamento? O valor será removido do total pago.')) return

    await supabase.from('transactions').delete().eq('id', paymentId)

    const updatedPayments = payments.filter(p => p.id !== paymentId)
    const totalPaid = updatedPayments.reduce((a, p) => a + (Number(p.amount) || 0), 0)
    const newStatus = totalPaid >= Number(debt.total_amount) ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'
    await supabase.from('debts').update({ status: newStatus }).eq('id', id)

    const deletedPayment = payments.find(p => p.id === paymentId)
    if (deletedPayment?.account_id) {
      const { data: acc } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', deletedPayment.account_id)
        .single()
      if (acc) {
        await supabase
          .from('accounts')
          .update({ balance: Number(acc.balance) - amount })
          .eq('id', deletedPayment.account_id)
      }
    }

    loadData()
  }

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
    if (isSubmitting) return
    if (!user?.id || payAmountNum <= 0) return

    const totalPaid = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0)
    const remaining = Number(debt.total_amount) - totalPaid

    if (payAmountNum > remaining) {
      alert(`O valor máximo que pode ser pago é ${formatCurrency(remaining)}.`)
      return
    }

    setIsSubmitting(true)
    setSaving(true)

    try {
      const idempotencyKey = crypto.randomUUID()

      const { error: txError } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'income',
        amount: payAmountNum,
        description: payNote || `Pagamento de ${debt.person_name}`,
        account_id: payAccountId || debt.account_id,
        debt_id: id,
        date: payDate,
        status: 'done',
        context: debt.context,
        idempotency_key: idempotencyKey,
      })

      if (txError) throw txError

      const targetAccountId = payAccountId || debt.account_id
      if (targetAccountId) {
        const { data: acc } = await supabase
          .from('accounts')
          .select('balance')
          .eq('id', targetAccountId)
          .single()

        if (acc) {
          await supabase
            .from('accounts')
            .update({ balance: Number(acc.balance) + payAmountNum })
            .eq('id', targetAccountId)
        }
      }

      const newTotalPaid = totalPaid + payAmountNum
      const newStatus = newTotalPaid >= Number(debt.total_amount) ? 'paid' : 'partial'
      await supabase.from('debts').update({ status: newStatus }).eq('id', id)

      setShowPaymentModal(false)
      setPayAmount('0,00')
      setPayAmountNum(0)
      setPayNote('')
      setPayAccountId('')
      loadData()
    } catch (err: any) {
      alert('Erro ao registrar pagamento: ' + err.message)
    } finally {
      setSaving(false)
      setIsSubmitting(false)
    }
  }

  const handleSendWhatsApp = () => {
    const number = whatsAppNumber.replace(/\D/g, '')
    if (!number) {
      alert('Informe o número do WhatsApp.')
      return
    }
    const url = `https://wa.me/55${number}?text=${encodeURIComponent(whatsAppMessage)}`
    window.open(url, '_blank')
    setShowWhatsAppModal(false)
  }

  // Skeleton enquanto carrega
  if (loading) return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-32 font-sans transition-colors duration-300">
      <DebtDetailSkeleton />
    </div>
  )

  if (!debt) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <p className="text-gray-500 dark:text-gray-400">Registro não encontrado.</p>
    </div>
  )

  const IconComp = getDynamicIcon(debt.icon || 'user')
  const totalPaid = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0)
  const remaining = Number(debt.total_amount) - totalPaid
  const percent = Number(debt.total_amount) > 0 ? (totalPaid / Number(debt.total_amount)) * 100 : 0
  const isPaid = debt.status === 'paid'
  const daysUntilDue = debt.due_date ? differenceInDays(new Date(debt.due_date), new Date()) : null
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && !isPaid
  const isNearDue = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7 && !isPaid

  const selectedAcc = accounts.find(a => a.id === payAccountId)

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-32 font-sans px-4 pt-6 transition-colors duration-300">
      
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
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/debts')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          {isPaid && <Check size={18} className="text-emerald-500" />}
          {isOverdue && <AlertTriangle size={18} className="text-red-500" />}
          {isNearDue && <Clock size={18} className="text-orange-500" />}
          <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{debt.person_name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowWhatsAppModal(true)} className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors" title="Cobrar via WhatsApp">
            <MessageCircle size={20} />
          </button>
          <button onClick={() => router.push(`/debts/new?edit=${debt.id}`)} className="p-2 text-teal-700 dark:text-teal-400 hover:text-teal-800 transition-colors">
            <Edit2 size={20} />
          </button>
          <button onClick={handleDeleteDebt} className="p-2 text-red-500 hover:text-red-600 transition-colors">
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Card Principal */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${debt.color}20`, color: debt.color }}>
            <IconComp size={24} />
          </div>
          <div>
            <p className="font-bold text-[16px] text-gray-800 dark:text-gray-100">{debt.person_name}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {debt.description || 'Empréstimo'} • {debt.context === 'dfl' ? 'DFL' : 'Pessoal'}
              {debt.due_date && ` • Vence ${format(new Date(debt.due_date), "dd/MM/yyyy")}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Total</p>
            <p className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{formatCurrency(Number(debt.total_amount))}</p>
          </div>
          <div className="text-center bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Pago</p>
            <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          </div>
          <div className={`text-center rounded-xl p-3 ${remaining > 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">{remaining > 0 ? 'Falta' : 'Troco'}</p>
            <p className={`text-[15px] font-bold ${remaining > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{formatCurrency(Math.abs(remaining))}</p>
          </div>
        </div>

        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              isPaid ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : isNearDue ? 'bg-orange-500' : 'bg-teal-500'
            }`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-400 dark:text-gray-500 font-medium">{percent.toFixed(0)}% pago</span>
          {isOverdue && <span className="text-red-500 font-bold">Atrasado {Math.abs(daysUntilDue)} dia(s)</span>}
          {isNearDue && <span className="text-orange-500 font-bold">Vence em {daysUntilDue} dia(s)</span>}
        </div>
      </div>

      {/* Botões de ação */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {!isPaid && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="bg-teal-700 text-white py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors active:scale-95"
          >
            <div className="flex items-center justify-center gap-2">
              <ArrowUp size={16} />
              Registrar Pagamento
            </div>
          </button>
        )}
        <button
          onClick={() => setShowWhatsAppModal(true)}
          className={`${isPaid ? 'col-span-2' : ''} bg-emerald-600 text-white py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors active:scale-95`}
        >
          <MessageCircle size={18} /> Cobrar via WhatsApp
        </button>
      </div>

      {/* Histórico de Pagamentos */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 animate-in fade-in duration-300">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Histórico de Pagamentos</h3>
        {payments.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-4">Nenhum pagamento registrado.</p>
        ) : (
          <div className="space-y-2">
            {payments.map(pay => (
              <div key={pay.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl group hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Check size={12} className="text-emerald-600" />
                    </div>
                    <p className="font-bold text-sm text-emerald-600">+ {formatCurrency(Number(pay.amount) || 0)}</p>
                    {pay.description && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">— {pay.description}</p>}
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 ml-7">
                    {format(new Date(pay.date + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
                <button
                  onClick={() => handleDeletePayment(pay.id, Number(pay.amount))}
                  className="p-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Excluir pagamento"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Pagamento (mantido igual) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Registrar Pagamento</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Valor recebido</label>
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
                <p className="text-[10px] text-gray-400 mt-1">Máximo: {formatCurrency(remaining)}</p>
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
                  placeholder="Ex: Pagamento parcial"
                  className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200"
                />
              </div>

              <button
                onClick={() => setShowAccModal(true)}
                className="w-full flex items-center justify-between bg-gray-50 dark:bg-slate-700 rounded-xl p-3"
              >
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-gray-400 dark:text-gray-500" />
                  <span className={`text-sm ${selectedAcc ? 'text-gray-800 dark:text-gray-200 font-bold' : 'text-gray-400 dark:text-gray-500'}`}>
                    {selectedAcc ? selectedAcc.name : 'Conta de destino (opcional)'}
                  </span>
                </div>
                <ChevronLeft size={16} className="text-gray-300 dark:text-gray-600 rotate-180" />
              </button>

              <button
                onClick={handlePayment}
                disabled={isSubmitting || payAmountNum <= 0}
                className="w-full bg-teal-700 text-white py-4 rounded-xl font-bold disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal WhatsApp (mantido igual) */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowWhatsAppModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Cobrar via WhatsApp</h3>
              <button onClick={() => setShowWhatsAppModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Número (DDD + número)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={whatsAppNumber}
                  onChange={e => setWhatsAppNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="11999999999"
                  className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Mensagem</label>
                <textarea
                  value={whatsAppMessage}
                  onChange={e => setWhatsAppMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200 resize-none"
                />
              </div>

              <button
                onClick={handleSendWhatsApp}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <MessageCircle size={20} /> Enviar Mensagem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Contas (mantido igual) */}
      {showAccModal && (
        <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Conta de destino</h3>
              <button onClick={() => setShowAccModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setPayAccountId(''); setShowAccModal(false) }}
                className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${!payAccountId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400"><Wallet size={20} /></div>
                <span className={`flex-1 text-left font-medium ${!payAccountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Nenhuma conta</span>
                {!payAccountId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              {accounts.map(acc => {
                const isActive = acc.id === payAccountId
                return (
                  <button
                    key={acc.id}
                    onClick={() => { setPayAccountId(acc.id); setShowAccModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: acc.color || '#14b8a6' }}>{acc.name.substring(0, 2).toUpperCase()}</div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}