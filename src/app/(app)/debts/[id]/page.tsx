'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Edit2, Loader2, Check, Trash2, X, Wallet, Calendar, MessageCircle, RefreshCw
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { formatCurrency } from '@/lib/utils'
import { useLocalData } from '@/hooks/useLocalData'
// 🔥 IMPORTAMOS O addToSyncQueue AQUI!
import { db, addToSyncQueue } from '@/lib/db' 

function DebtDetailContent() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { success, error } = useHapticFeedback()

  // Garante que o ID é uma string, mesmo que venha em array
  const debtId = Array.isArray(params.id) ? params.id[0] : params.id

  // ============================================================
  // 🔥 BUSCAS LOCAIS (INDEXEDDB)
  // ============================================================
  const { 
    data: localDebt, 
    loading: debtLoading, 
    reload: reloadDebt,
  } = useLocalData({
    table: 'debts' as any,
    filters: { id: debtId },
  })

  const { 
    data: localTransactions, 
    reload: reloadTransactions,
  } = useLocalData({
    table: 'transactions' as any,
    filters: { debt_id: debtId },
  })

  const debtData = (localDebt || [])[0] as any

  const { 
    data: localAccounts, 
    reload: reloadAccounts,
  } = useLocalData({
    table: 'accounts' as any,
    filters: { context: debtData?.context || 'dfl' },
  })

  // ============================================================
  // ESTADOS LOCAIS
  // ============================================================
  const [debt, setDebt] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
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

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
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

  // ============================================================
  // EFEITOS PARA ATUALIZAR ESTADOS
  // ============================================================
  useEffect(() => {
    if (localDebt && localDebt.length > 0) {
      const data = localDebt[0] as any
      setDebt(data)
      setWhatsAppMessage(`Olá ${data.person_name}, tudo bem? Preciso lembrar sobre o pagamento de ${formatCurrency(Number(data.total_amount))}. Você pode verificar?`)
    }
  }, [localDebt])

  useEffect(() => { if (localTransactions) setPayments(localTransactions) }, [localTransactions])
  useEffect(() => { if (localAccounts) setAccounts(localAccounts) }, [localAccounts])

  // ============================================================
  // HANDLERS DE AÇÃO COM FILA DE SINCRONIZAÇÃO APLICADA! 🔥
  // ============================================================
  const handleDeleteDebt = async () => {
    if (!user?.id) return
    if (!confirm('Tem certeza que deseja excluir este registro?')) return
    try {
      // 1. Apaga do celular
      await db.table('debts').delete(debtId)
      // 2. Coloca na fila para apagar da nuvem!
      await addToSyncQueue(user.id, 'debts', 'delete', debtId, { id: debtId })
      
      showToast('Dívida excluída.', 'info')
      router.push('/debts')
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const handleDeletePayment = async (paymentId: string, amount: number) => {
    if (!user?.id) return
    if (!confirm('Excluir este pagamento? O valor será removido do total pago.')) return

    try {
      // Apaga o pagamento e joga na fila
      await db.table('transactions').delete(paymentId)
      await addToSyncQueue(user.id, 'transactions', 'delete', paymentId, { id: paymentId })

      const updatedPayments = payments.filter(p => p.id !== paymentId)
      const totalPaid = updatedPayments.reduce((a, p) => a + (Number(p.amount) || 0), 0)

      const totalAmountCents = Math.round(Number(debt.total_amount) * 100)
      const totalPaidCents = Math.round(totalPaid * 100)
      const newStatus = totalPaidCents >= totalAmountCents ? 'paid' : totalPaidCents > 0 ? 'partial' : 'pending'

      const debtUpdates = { 
        status: newStatus,
        paid_amount: totalPaidCents / 100,
        updated_at: new Date().toISOString()
      }

      // Atualiza a dívida e joga na fila
      await db.table('debts').update(debtId, debtUpdates)
      await addToSyncQueue(user.id, 'debts', 'update', debtId, debtUpdates)

      // Atualiza a conta (se houver) e joga na fila
      const deletedPayment = payments.find(p => p.id === paymentId)
      if (deletedPayment?.account_id) {
        const account = accounts.find(a => a.id === deletedPayment.account_id)
        if (account) {
          const accUpdates = { balance: Number(account.balance) - amount }
          await db.table('accounts').update(deletedPayment.account_id, accUpdates)
          await addToSyncQueue(user.id, 'accounts', 'update', deletedPayment.account_id, accUpdates)
        }
      }

      showToast('Pagamento removido.', 'info')
      loadData()
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
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

    if (!user?.id || payAmountNum <= 0) {
      showToast('Digite um valor válido.', 'warning')
      error()
      return
    }

    const totalPaid = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0)
    const totalAmountCents = Math.round(Number(debt.total_amount) * 100)
    const totalPaidCents = Math.round(totalPaid * 100)
    const payAmountCents = Math.round(payAmountNum * 100)
    const remainingCents = totalAmountCents - totalPaidCents
    const remaining = remainingCents / 100

    if (payAmountCents > remainingCents) {
      showToast(`O valor máximo que pode ser pago é ${formatCurrency(remaining)}.`, 'warning')
      error()
      return
    }

    setIsSubmitting(true)

    try {
      const targetAccountId = payAccountId || debt.account_id || null
      const txId = crypto.randomUUID()
      
      const newTx = {
        id: txId,
        user_id: user.id,
        type: 'income',
        amount: payAmountNum,
        description: payNote || `Pagamento de ${debt.person_name}`,
        account_id: targetAccountId,
        debt_id: debtId,
        date: payDate,
        status: 'done',
        affects_balance: true,
        context: debt.context,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }

      // 1. Cria a transação e enfileira
      await db.table('transactions').add(newTx)
      await addToSyncQueue(user.id, 'transactions', 'create', txId, newTx)

      // 2. Atualiza a conta e enfileira
      if (targetAccountId) {
        const account = accounts.find(a => a.id === targetAccountId)
        if (account) {
          const accUpdates = { balance: Number(account.balance) + payAmountNum }
          await db.table('accounts').update(targetAccountId, accUpdates)
          await addToSyncQueue(user.id, 'accounts', 'update', targetAccountId, accUpdates)
        }
      }

      // 3. Atualiza a dívida e enfileira
      const newTotalPaidCents = totalPaidCents + payAmountCents
      const newStatus = newTotalPaidCents >= totalAmountCents ? 'paid' : 'partial'
      
      const debtUpdates = {
        status: newStatus,
        paid_amount: newTotalPaidCents / 100,
        updated_at: new Date().toISOString()
      }

      await db.table('debts').update(debtId, debtUpdates)
      await addToSyncQueue(user.id, 'debts', 'update', debtId, debtUpdates)

      success()
      showToast('✅ Pagamento registrado com sucesso!', 'success')

      setShowPaymentModal(false)
      setPayAmount('0,00')
      setPayAmountNum(0)
      setPayNote('')
      setPayAccountId('')
      loadData()
    } catch (err: any) {
      console.error('Erro ao registrar pagamento:', err)
      error()
      showToast(`❌ Erro: ${err.message || 'Erro desconhecido'}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendWhatsApp = () => {
    const number = whatsAppNumber.replace(/\D/g, '')
    if (!number) {
      showToast('Informe o número do WhatsApp.', 'warning')
      return
    }
    const url = `https://wa.me/55${number}?text=${encodeURIComponent(whatsAppMessage)}`
    window.open(url, '_blank')
    setShowWhatsAppModal(false)
  }

  // ============================================================
  // RENDERIZAÇÃO
  // ============================================================
  if (debtLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <Loader2 className="animate-spin text-teal-700" size={40} />
    </div>
  )

  if (!debt && !debtLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <p className="text-gray-500 dark:text-gray-400">Registro não encontrado.</p>
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
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-32 font-sans px-4 pt-6 transition-colors duration-300">

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

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/debts')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{debt.person_name}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowWhatsAppModal(true)} className="p-2 text-emerald-600 dark:text-emerald-400" title="Cobrar via WhatsApp">
            <MessageCircle size={20} />
          </button>
          <button onClick={() => router.push(`/debts/new?edit=${debt.id}`)} className="p-2 text-teal-700 dark:text-teal-400">
            <Edit2 size={20} />
          </button>
          <button onClick={handleDeleteDebt} className="p-2 text-red-500">
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${debt.color}20`, color: debt.color }}>
            <IconComp size={24} />
          </div>
          <div>
            <p className="font-bold text-[16px] text-gray-800 dark:text-gray-100">{debt.person_name}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {debt.description || 'Empréstimo'} • {debt.context === 'dfl' ? 'PJ' : 'PF'}
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
          <div className={`text-center rounded-xl p-3 ${remainingCents > 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">{remainingCents > 0 ? 'Falta' : 'Pago'}</p>
            <p className={`text-[15px] font-bold ${remainingCents > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{formatCurrency(Math.abs(remaining))}</p>
          </div>
        </div>

        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${isPaid ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-400 dark:text-gray-500 font-medium">{percent.toFixed(0)}% pago</span>
          {isPaid && <span className="text-emerald-600 font-bold">✅ Pago!</span>}
          {isOverdue && !isPaid && <span className="text-red-500 font-bold">Atrasado {Math.abs(daysUntilDue)} dia(s)</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {!isPaid && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="bg-teal-700 text-white py-3 rounded-full font-bold text-sm"
          >
            Registrar Pagamento
          </button>
        )}
        <button
          onClick={() => setShowWhatsAppModal(true)}
          className={`${isPaid ? 'col-span-2' : ''} bg-emerald-600 text-white py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2`}
        >
          <MessageCircle size={18} /> Cobrar via WhatsApp
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Histórico de Pagamentos</h3>
        {payments.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-4">Nenhum pagamento registrado.</p>
        ) : (
          <div className="space-y-2">
            {payments.map(pay => (
              <div key={pay.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl group">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-emerald-600">+ {formatCurrency(Number(pay.amount) || 0)}</p>
                    {pay.description && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">— {pay.description}</p>}
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    {format(new Date(pay.date + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
                <button
                  onClick={() => handleDeletePayment(pay.id, Number(pay.amount))}
                  className="p-2 text-red-400 hover:text-red-600 transition-colors"
                  title="Excluir pagamento"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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

// 🛡️ A CAPA PROTETORA ANTI-SSR
export default function DebtDetailPage() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])
  if (!isClient) return <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900" />
  return <DebtDetailContent />
}
