'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Edit2, Trash2, Loader2, Home, Car, Briefcase,
  Calendar, Clock, AlertTriangle, CheckCircle, Plus, RefreshCw,
  ArrowDown, X, Check, Image, Paperclip
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'

// ============================================================
// SKELETON LOADER
// ============================================================
const FinancingDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-6 space-y-4">
    <div className="flex items-center justify-between mb-6">
      <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full" />
      <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
      <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full" />
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
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
        <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
      </div>
      <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded ml-auto" />
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-50 dark:border-slate-700 last:border-b-0">
          <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-2.5 w-1/2 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
          <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  </div>
)

export default function FinancingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [financing, setFinancing] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [paidInstallments, setPaidInstallments] = useState(0)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [payAmount, setPayAmount] = useState('0,00')
  const [payAmountNum, setPayAmountNum] = useState(0)
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [payNote, setPayNote] = useState('')

  // ============================================================
  // 🔥 BUSCAS LOCAIS (INDEXEDDB)
  // ============================================================
  const { data: localFinancings, loading: financingsLoading, reload: reloadFinancings } = useLocalData({
    table: 'financings',
    filters: { id: id as string },
    realtime: true,
  })

  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions',
    filters: { financing_id: id as string },
    orderBy: { field: 'date', direction: 'desc' },
    realtime: true,
  })

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
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

  // ============================================================
  // LOAD DATA
  // ============================================================
  const loadData = useCallback(async () => {
    if (!id || !user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
      await Promise.all([reloadFinancings(), reloadTransactions()])

      const financingData = (localFinancings || [])[0]
      if (!financingData) {
        router.push('/financings')
        return
      }
      setFinancing(financingData)

      const txs = localTransactions || []
      setPayments(txs)

      const paid = txs
        .filter((tx: any) => tx.type === 'expense' && tx.status === 'done')
        .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)

      const installmentValue = Number(financingData.installment_value)
      const paidCount = installmentValue > 0 ? Math.floor(paid / installmentValue) : 0
      setPaidInstallments(Math.min(paidCount, Number(financingData.total_installments)))
    } catch (err) {
      console.error('Erro ao carregar financiamento:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [id, user, localFinancings, localTransactions, router])

  useEffect(() => { loadData() }, [loadData])

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleDelete = async () => {
    if (!confirm('Excluir este financiamento?')) return
    try {
      const { remove } = useLocalData({ table: 'financings' })
      await remove(id as string)
      showToast('Financiamento excluído.', 'info')
      router.push('/financings')
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const handlePayment = async () => {
    if (!user?.id || payAmountNum <= 0) {
      showToast('Digite um valor válido.', 'warning')
      return
    }

    const installmentValue = Number(financing.installment_value)
    if (payAmountNum !== installmentValue) {
      showToast(`O valor da parcela é ${formatCurrency(installmentValue)}.`, 'warning')
      return
    }

    const totalPaid = paidInstallments + 1
    if (totalPaid > Number(financing.total_installments)) {
      showToast('Todas as parcelas já foram pagas.', 'warning')
      return
    }

    try {
      const { create } = useLocalData({ table: 'transactions' })
      await create({
        user_id: user.id,
        context: context || 'dfl',
        type: 'expense',
        amount: payAmountNum,
        description: payNote || `Parcela ${totalPaid}/${financing.total_installments} - ${financing.name}`,
        date: payDate,
        status: 'done',
        affects_balance: true,
        financing_id: id,
      })

      const { update } = useLocalData({ table: 'financings' })
      await update(id as string, {
        current_installment: totalPaid,
        next_due_date: addMonths(new Date(payDate), 1).toISOString().split('T')[0],
      })

      showToast('Parcela registrada!', 'success')
      setShowPaymentModal(false)
      setPayAmount('0,00')
      setPayAmountNum(0)
      setPayNote('')
      loadData()
    } catch (err: any) {
      showToast(`Erro ao registrar: ${err.message}`, 'error')
    }
  }

  const addMonths = (date: Date, months: number) => {
    const d = new Date(date)
    d.setMonth(d.getMonth() + months)
    return d
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

  const getAttachmentIcon = (url: string | null) => {
    if (!url) return null
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)
    if (isImage) return <Image size={12} className="text-blue-500 shrink-0" />
    return <Paperclip size={12} className="text-gray-500 shrink-0" />
  }

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading) return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-20 font-sans transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}
      <FinancingDetailSkeleton />
    </div>
  )

  if (!financing) return null

  const IconComp = getDynamicIcon(financing.icon || 'home')
  const totalInstallments = Number(financing.total_installments)
  const percent = totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0
  const isCompleted = paidInstallments >= totalInstallments
  const isOverdue = financing.next_due_date && differenceInDays(new Date(financing.next_due_date), new Date()) < 0 && !isCompleted
  const remainingInstallments = totalInstallments - paidInstallments

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-20 font-sans px-4 pt-6 transition-colors duration-300">
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
        <button onClick={() => router.push('/financings')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{financing.name}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/financings/new?edit=${financing.id}`)} className="p-2 text-gray-400 hover:text-teal-600 transition-colors">
            <Edit2 size={18} />
          </button>
          <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex justify-center mb-4">
        <span className={`text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
          isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
          isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
          'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
        }`}>
          {isCompleted && <CheckCircle size={10} />}
          {isOverdue && <AlertTriangle size={10} />}
          {isCompleted ? 'Quitado' : isOverdue ? 'Atrasado' : `${percent.toFixed(0)}%`}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${financing.color}20`, color: financing.color }}>
            <IconComp size={24} />
          </div>
          <div>
            <p className="font-bold text-[16px] text-gray-800 dark:text-gray-100">{financing.name}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {formatCurrency(Number(financing.installment_value))} • {totalInstallments} parcelas
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Valor</p>
            <p className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{formatCurrency(Number(financing.installment_value))}</p>
          </div>
          <div className="text-center bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Pagas</p>
            <p className="text-[15px] font-bold text-emerald-600">{paidInstallments}</p>
          </div>
          <div className={`text-center rounded-xl p-3 ${remainingInstallments > 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">{remainingInstallments > 0 ? 'Faltam' : 'Quitado'}</p>
            <p className={`text-[15px] font-bold ${remainingInstallments > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{remainingInstallments}</p>
          </div>
        </div>

        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'
            }`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <p className={`text-[11px] font-medium text-right ${isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
          {percent.toFixed(0)}% pago
        </p>
      </div>

      {!isCompleted && (
        <button
          onClick={() => setShowPaymentModal(true)}
          className="w-full bg-teal-700 text-white py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-teal-700/20 mb-4"
        >
          <Plus size={16} />
          Pagar Parcela {paidInstallments + 1}/{totalInstallments}
        </button>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 animate-in fade-in duration-300">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Histórico de Pagamentos</h3>
        {payments.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">Nenhum pagamento registrado.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((tx: any, index: number) => {
              const attachmentIcon = getAttachmentIcon(tx.receipt_url)
              return (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-3 ${
                    index !== payments.length - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-500">
                      <ArrowDown size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate">{tx.description || 'Parcela'}</p>
                        {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{format(new Date(tx.date), "dd 'de' MMM yyyy", { locale: ptBR })}</p>
                    </div>
                  </div>
                  <p className="text-[14px] font-bold text-red-500 flex-shrink-0">
                    - {formatCurrency(Number(tx.amount) || 0)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Pagamento */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 animate-in slide-in-from-bottom-10 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Pagar Parcela</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 p-2"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Valor da parcela</label>
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
                <p className="text-[10px] text-gray-400 mt-1">Valor esperado: {formatCurrency(Number(financing.installment_value))}</p>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Data</label>
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
                  placeholder="Ex: Parcela {n}/{total}"
                  className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200"
                />
              </div>

              <button
                onClick={handlePayment}
                disabled={payAmountNum <= 0}
                className="w-full bg-teal-700 text-white py-4 rounded-xl font-bold disabled:opacity-50 hover:bg-teal-800 transition-colors"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}