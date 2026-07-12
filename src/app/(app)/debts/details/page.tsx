'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Edit2, Loader2, Check, Trash2, X, Wallet, Calendar, MessageCircle, RefreshCw, AlertTriangle
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { formatCurrency } from '@/lib/utils'
import { useLocalData } from '@/hooks/useLocalData'
import { db } from '@/lib/db' 
import { useSafeDb } from '@/hooks/useSafeDb'
import Skeleton from '@/components/Skeleton'

function DebtDetailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { safeAdd, safeUpdate, safeDelete } = useSafeDb()

  const debtId = searchParams.get('id') as string

  const { data: localDebt, loading: debtLoading, reload: reloadDebt } = useLocalData({
    table: 'debts' as any,
    filters: { id: debtId },
  })

  const { data: localTransactions, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { debt_id: debtId },
  })

  const debtData = (localDebt || [])[0] as any

  const { data: localAccounts, reload: reloadAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context: debtData?.context || 'dfl' },
  })

  const [debt, setDebt] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [whatsAppNumber, setWhatsAppNumber] = useState('')
  const [whatsAppMessage, setWhatsAppMessage] = useState('')

  const [payAmount, setPayAmount] = useState('')
  const [payAmountNum, setPayAmountNum] = useState(0)
  const [payAccountId, setPayAccountId] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [showAccModal, setShowAccModal] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const loadData = useCallback(async () => {
    if (!debtId || !user?.id) return
    setLoadingPulse(true)
    try {
      await Promise.all([reloadDebt(), reloadTransactions(), reloadAccounts()])
    } catch (err) {
      console.error('Erro ao recarregar dados:', err)
    } finally {
      setLoadingPulse(false)
    }
  }, [debtId, user, reloadDebt, reloadTransactions, reloadAccounts])

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || debtLoading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      vibrate([10])
      loadData().finally(() => setRefreshing(false))
    }
  }

  const handleTouchEnd = () => { isPulling.current = false }

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
  }, [debtLoading, refreshing, loadData])

  useEffect(() => {
    if (localDebt && localDebt.length > 0) {
      const data = localDebt[0] as any
      setDebt(data)
      setWhatsAppMessage(`Olá ${data.person_name}, tudo bem? Preciso lembrar sobre o pagamento de ${formatCurrency(Number(data.total_amount))}. Você pode verificar?`)
    }
  }, [localDebt])

  useEffect(() => { if (localTransactions) setPayments(localTransactions) }, [localTransactions])
  useEffect(() => { if (localAccounts) setAccounts(localAccounts) }, [localAccounts])

  const handleDeleteDebt = async () => {
    if (!user?.id) return
    vibrate([10, 50])
    if (!confirm('Excluir este registro? Todos os pagamentos vinculados também serão excluídos.')) return
    try {
      await db.transaction('rw', db.debts, db.transactions, db.accounts, db.syncQueue, async () => {
        for (const payment of payments) {
          if (payment.account_id) {
            const account = await db.table('accounts').get(payment.account_id)
            if (account) {
              const reversedBalance = Number(account.balance) - Number(payment.amount)
              const result = await safeUpdate('accounts', payment.account_id, { balance: reversedBalance })
              if (!result.success) throw new Error(`Erro ao reverter conta: ${result.error}`)
            }
          }
          const result = await safeDelete('transactions', payment.id)
          if (!result.success) throw new Error(`Erro deletar pagamento: ${result.error}`)
        }

        const result = await safeDelete('debts', debtId)
        if (!result.success) throw new Error(`Erro ao excluir: ${result.error}`)
      })

      success()
      showToast('🗑️ Dívida excluída com sucesso.', 'success')
      router.push('/debts')
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, 'error')
    }
  }

  const handleDeletePayment = async (paymentId: string) => {
    if (!user?.id) return
    vibrate([10, 50])
    if (!confirm('Excluir pagamento? O valor será removido do total pago e descontado da conta.')) return

    try {
      await db.transaction('rw', db.transactions, db.debts, db.accounts, db.syncQueue, async () => {
        const payment = payments.find(p => p.id === paymentId)
        if (!payment) throw new Error('Pagamento não encontrado')

        if (payment.account_id) {
          const account = await db.table('accounts').get(payment.account_id)
          if (account) {
            const reversedBalance = Number(account.balance) - Number(payment.amount)
            const result = await safeUpdate('accounts', payment.account_id, { balance: reversedBalance })
            if (!result.success) throw new Error(`Erro ao reverter conta: ${result.error}`)
          }
        }

        const result = await safeDelete('transactions', paymentId)
        if (!result.success) throw new Error(`Erro deletar pagamento: ${result.error}`)

        const updatedPayments = payments.filter(p => p.id !== paymentId)
        const totalPaid = updatedPayments.reduce((a, p) => a + (Number(p.amount) || 0), 0)

        const totalAmountCents = Math.round(Number(debt.total_amount) * 100)
        const totalPaidCents = Math.round(totalPaid * 100)
        const newStatus = totalPaidCents >= totalAmountCents ? 'paid' : totalPaidCents > 0 ? 'partial' : 'pending'

        const debtResult = await safeUpdate('debts', debtId, { 
          status: newStatus,
          paid_amount: totalPaidCents / 100,
          updated_at: new Date().toISOString()
        })
        if (!debtResult.success) throw new Error(`Erro atualizar dívida: ${debtResult.error}`)
      })

      success()
      showToast('🗑️ Pagamento removido.', 'success')
      loadData()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, 'error')
    }
  }

  const handlePayAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setPayAmount('')
      setPayAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setPayAmountNum(num)
    setPayAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handlePayment = async () => {
    if (isSubmitting) return

    if (!user?.id || payAmountNum <= 0) {
      showToast('⚠️ Digite um valor válido.', 'warning')
      errorHaptic()
      return
    }

    const totalPaid = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0)
    const totalAmountCents = Math.round(Number(debt.total_amount) * 100)
    const totalPaidCents = Math.round(totalPaid * 100)
    const payAmountCents = Math.round(payAmountNum * 100)
    const remainingCents = totalAmountCents - totalPaidCents
    const remaining = remainingCents / 100

    if (payAmountCents > remainingCents) {
      showToast(`⚠️ O valor máximo que pode ser pago é ${formatCurrency(remaining)}.`, 'warning')
      errorHaptic()
      return
    }

    setIsSubmitting(true)

    try {
      const targetAccountId = payAccountId || debt.account_id || null
      const txId = crypto.randomUUID()
      
      const newTx = {
        id: txId, user_id: user.id, type: 'income', amount: payAmountNum,
        description: payNote || `Pagamento de ${debt.person_name}`,
        account_id: targetAccountId, debt_id: debtId, date: payDate,
        status: 'done', affects_balance: true, context: debt.context,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        sync_status: 'pending', sync_attempts: 0,
      }

      await db.transaction('rw', db.transactions, db.accounts, db.debts, db.syncQueue, async () => {
        const txResult = await safeAdd('transactions', newTx)
        if (!txResult.success) throw new Error(`Erro ao criar pagamento: ${txResult.error}`)

        if (targetAccountId) {
          const account = await db.table('accounts').get(targetAccountId)
          if (account) {
            const newBalance = Number(account.balance) + payAmountNum
            const accResult = await safeUpdate('accounts', targetAccountId, { balance: newBalance })
            if (!accResult.success) throw new Error(`Erro ao atualizar conta: ${accResult.error}`)
          }
        }

        const newTotalPaidCents = totalPaidCents + payAmountCents
        const newStatus = newTotalPaidCents >= totalAmountCents ? 'paid' : 'partial'
        
        const debtResult = await safeUpdate('debts', debtId, {
          status: newStatus,
          paid_amount: newTotalPaidCents / 100,
          updated_at: new Date().toISOString()
        })
        if (!debtResult.success) throw new Error(`Erro atualizar dívida: ${debtResult.error}`)
      })

      success()
      showToast('✅ Pagamento registrado com sucesso!', 'success')
      setShowPaymentModal(false)
      setPayAmount('')
      setPayAmountNum(0)
      setPayNote('')
      setPayAccountId('')
      loadData()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendWhatsApp = () => {
    const number = whatsAppNumber.replace(/\D/g, '')
    if (!number) {
      showToast('⚠️ Informe o número do WhatsApp.', 'warning')
      errorHaptic()
      return
    }
    vibrate([10])
    const url = `https://wa.me/55${number}?text=${encodeURIComponent(whatsAppMessage)}`
    window.open(url, '_blank')
    setShowWhatsAppModal(false)
  }

  if (debtLoading) return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors">
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
        <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
      </div>
      <div className="flex-1 px-4 pt-6"><Skeleton count={4} /></div>
    </div>
  )

  if (!debt && !debtLoading) return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900">
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
        <button onClick={() => router.back()} className="p-2 rounded-full bg-gray-100 dark:bg-slate-800"><ChevronLeft size={24} /></button>
        <h1 className="text-lg font-black mt-4">Registro não encontrado</h1>
      </div>
    </div>
  )

  const IconComp = getDynamicIcon(debt?.icon || 'user')
  const totalPaid = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0)
  const totalAmountCents = Math.round(Number(debt?.total_amount || 0) * 100)
  const totalPaidCents = Math.round(totalPaid * 100)
  const remainingCents = totalAmountCents - totalPaidCents
  const remaining = remainingCents / 100

  const percent = totalAmountCents > 0 ? (totalPaidCents / totalAmountCents) * 100 : 0
  const isPaid = debt?.status === 'paid' || remainingCents <= 0

  const daysUntilDue = debt?.due_date ? differenceInDays(new Date(debt.due_date), new Date()) : null
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && !isPaid

  const selectedAcc = accounts.find(a => a.id === payAccountId)

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 font-sans transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50"><div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]" /></div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.1)] rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 shadow-sm px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { vibrate([5]); router.back(); }} className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100 truncate max-w-[150px]">{debt.person_name}</h1>
          </div>
          <div className="flex gap-1">
            <button onClick={() => { vibrate([5]); setShowWhatsAppModal(true); }} className="p-2.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 active:scale-95 transition-all">
              <MessageCircle size={18} />
            </button>
            <button onClick={() => { vibrate([5]); router.push(`/debts/new?edit=${debt.id}`); }} className="p-2.5 rounded-full bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 active:scale-95 transition-all">
              <Edit2 size={18} />
            </button>
            <button onClick={handleDeleteDebt} className="p-2.5 rounded-full bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 active:scale-95 transition-all">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-4 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <div className="flex items-center gap-4 mb-6 mt-1">
            <div className="w-14 h-14 rounded-[18px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${debt.color}15`, color: debt.color }}>
              <IconComp size={24} />
            </div>
            <div>
              <p className="font-black text-[18px] text-gray-800 dark:text-gray-100 leading-tight">{debt.person_name}</p>
              <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                {debt.description || 'Empréstimo'} • {debt.context === 'dfl' ? 'Empresa' : 'Pessoal'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="text-center bg-gray-50 dark:bg-slate-700/40 rounded-[20px] p-3.5 border border-gray-100 dark:border-slate-700/50">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">Total</p>
              <p className="text-[15px] font-black text-gray-800 dark:text-gray-200">{formatCurrency(Number(debt.total_amount))}</p>
            </div>
            <div className="text-center bg-emerald-50 dark:bg-emerald-500/10 rounded-[20px] p-3.5 border border-emerald-100 dark:border-emerald-500/20">
              <p className="text-[10px] text-emerald-600/70 font-bold uppercase tracking-widest mb-1">Pago</p>
              <p className="text-[15px] font-black text-emerald-600">{formatCurrency(totalPaid)}</p>
            </div>
            <div className={`text-center rounded-[20px] p-3.5 border ${remainingCents > 0 ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${remainingCents > 0 ? 'text-orange-600/70' : 'text-emerald-600/70'}`}>{remainingCents > 0 ? 'Falta' : 'Status'}</p>
              <p className={`text-[15px] font-black ${remainingCents > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{remainingCents > 0 ? formatCurrency(Math.abs(remaining)) : '✅ Pago'}</p>
            </div>
          </div>

          <div className="w-full bg-gray-100 dark:bg-slate-700/50 rounded-full h-2.5 overflow-hidden mb-2 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${isPaid ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between items-center mt-2">
            <span className="text-[12px] font-bold text-gray-500">{percent.toFixed(0)}% pago</span>
            {isOverdue && !isPaid && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} /> Atrasado {Math.abs(daysUntilDue)} dia(s)
              </span>
            )}
            {!isOverdue && !isPaid && debt.due_date && (
              <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5"><Calendar size={12}/> Vence {format(new Date(debt.due_date), "dd/MM")}</span>
            )}
          </div>
        </div>

        {!isPaid && (
          <button
            onClick={() => { vibrate([5]); setShowPaymentModal(true); }}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[15px] shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Wallet size={18} />
            Registrar Recebimento
          </button>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 mb-4">Histórico de Pagamentos</h3>
          {payments.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock size={20} className="text-gray-400" />
              </div>
              <p className="text-gray-400 dark:text-gray-500 text-[13px] font-medium">Nenhum pagamento registrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map(pay => (
                <div key={pay.id} className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-700/40 rounded-[20px] transition-colors border border-gray-100 dark:border-slate-700/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-[15px] text-emerald-600">+ {formatCurrency(Number(pay.amount) || 0)}</p>
                    </div>
                    <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                      {format(new Date(pay.date + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
                      {pay.description && ` • ${pay.description}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeletePayment(pay.id)}
                    className="p-2 text-gray-400 hover:text-red-500 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-all active:scale-90 shadow-sm border border-gray-100 dark:border-slate-700"
                    title="Excluir pagamento"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Registrar Pagamento - Bottom Sheet */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowPaymentModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Registrar Recebimento</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Valor recebido</label>
                <div className="flex items-center gap-2">
                  <span className="text-[18px] text-gray-400 font-medium">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={payAmount}
                    onChange={handlePayAmountChange}
                    className="w-full bg-transparent text-[24px] font-black text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                    placeholder="0,00"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] font-bold text-emerald-600/70 mt-2">Máximo permitido: {formatCurrency(remaining)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Data</label>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400 shrink-0" />
                    <input
                      type="date"
                      value={payDate}
                      onChange={e => setPayDate(e.target.value)}
                      className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none w-full"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4 flex flex-col justify-center cursor-pointer active:scale-95 transition-transform" onClick={() => setShowAccModal(true)}>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Destino</label>
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-gray-400 shrink-0" />
                    <span className={`text-[13px] font-bold truncate ${selectedAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                      {selectedAcc ? selectedAcc.name : 'Nenhuma conta'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Observação (opcional)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="Ex: Pagamento da 1ª parcela"
                  className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                />
              </div>
            </div>

            <button
              onClick={() => { vibrate([10, 50]); handlePayment(); }}
              disabled={isSubmitting || payAmountNum <= 0}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] disabled:opacity-50 shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              {isSubmitting ? 'Processando...' : 'Confirmar Recebimento'}
            </button>
          </div>
        </div>
      )}

      {/* Modal WhatsApp - Bottom Sheet */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowWhatsAppModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Cobrar via WhatsApp</h3>
              <button onClick={() => setShowWhatsAppModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Número (DDD + Número)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={whatsAppNumber}
                  onChange={e => setWhatsAppNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="34999999999"
                  className="w-full bg-transparent text-[18px] font-bold text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                  autoFocus
                />
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Mensagem</label>
                <textarea
                  value={whatsAppMessage}
                  onChange={e => setWhatsAppMessage(e.target.value)}
                  rows={4}
                  className="w-full bg-transparent text-[14px] font-medium text-gray-800 dark:text-gray-200 outline-none resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600 leading-relaxed"
                />
              </div>
            </div>

            <button
              onClick={handleSendWhatsApp}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <MessageCircle size={20} />
              Enviar Mensagem
            </button>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Conta para Pagamento */}
      {showAccModal && (
        <div className="fixed inset-0 z-[700] flex items-end justify-center" onClick={() => setShowAccModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Selecionar Conta</h3>
              <button onClick={() => setShowAccModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => { vibrate([5]); setPayAccountId(''); setShowAccModal(false); }}
                className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${!payAccountId ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent'}`}
              >
                <div className="w-12 h-12 rounded-[16px] flex items-center justify-center bg-white dark:bg-slate-800 text-gray-400 shadow-sm"><Wallet size={20} /></div>
                <span className={`flex-1 text-left text-[15px] font-bold ${!payAccountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Nenhuma (Apenas registrar)</span>
                {!payAccountId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              
              {accounts.map(acc => {
                const isActive = acc.id === payAccountId
                return (
                  <button
                    key={acc.id}
                    onClick={() => { vibrate([5]); setPayAccountId(acc.id); setShowAccModal(false); }}
                    className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center text-white text-[14px] font-black shadow-sm" style={{ backgroundColor: acc.color || '#14b8a6' }}>
                      {acc.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
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

export default function DebtDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900" />} >
      <DebtDetailContent />
    </Suspense>
  )
}
