'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, RefreshCw, Loader2 } from 'lucide-react'
import { useConciQueue } from '@/hooks/useConciQueue'
import { ConciCard } from '@/components/conciliation/ConciCard'
import { ConciProgress } from '@/components/conciliation/ConciProgress'
import { ConciSummary } from '@/components/conciliation/ConciSummary'
import { useToast } from '@/contexts/ToastContext'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useTransactionsList } from '@/hooks/useTransactionsList' // ✅ HOOK ESPECÍFICO
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'

export default function ConciliationPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { effectiveContext } = useContext_()
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadingPulse, setLoadingPulse] = useState(false)

  // ✅ HOOK ESPECÍFICO
  const { data: allTransactions, loading: txLoading } = useTransactionsList(effectiveContext)

  // ✅ FILTRA PENDENTES EM MEMÓRIA
  const pendingTransactions = (allTransactions || []).filter((tx: any) => tx.status === 'pending')

  const {
    queue,
    current,
    currentIndex,
    total,
    approved,
    rejected,
    isComplete,
    approve,
    reject,
    reset,
  } = useConciQueue()

  useEffect(() => {
    const initQueue = async () => {
      setLoadingPulse(true)
      setIsLoading(true)

      try {
        if (pendingTransactions && pendingTransactions.length > 0) {
          reset(pendingTransactions)
        } else {
          reset([])
        }
      } catch (err) {
        console.error('Erro ao carregar transações pendentes:', err)
        showToast('❌ Erro ao carregar transações pendentes', 'error')
      } finally {
        setIsLoading(false)
        setLoadingPulse(false)
      }
    }

    initQueue()
  }, [effectiveContext, pendingTransactions])

  const handleApprove = (id: string) => {
    setIsProcessing(true)
    setLoadingPulse(true)

    setTimeout(() => {
      approve()
      showToast('✅ Transação aprovada!', 'success')
      setIsProcessing(false)
      setLoadingPulse(false)
    }, 300)
  }

  const handleReject = (id: string) => {
    setIsProcessing(true)
    setLoadingPulse(true)

    setTimeout(() => {
      reject()
      showToast('🔄 Transação descartada', 'info')
      setIsProcessing(false)
      setLoadingPulse(false)
    }, 300)
  }

  const handleReset = () => {
    setLoadingPulse(true)

    setTimeout(() => {
      if (pendingTransactions && pendingTransactions.length > 0) {
        reset(pendingTransactions)
        showToast('🔄 Fila reiniciada com dados reais', 'info')
      } else {
        reset([])
        showToast('📭 Nenhuma transação pendente disponível', 'info')
      }
      setLoadingPulse(false)
    }, 400)
  }

  const handleTapCard = (id: string) => {
    showToast('✏️ Edição em breve', 'info')
  }

  const handleImportCSV = () => {
    showToast('📄 Importação de CSV em breve', 'info')
  }

  const handleGoBack = () => {
    router.push('/more')
  }

  // 🔥 LOADING STATE ATUALIZADO
  if (isLoading || txLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-6 h-[400px] flex flex-col items-center justify-center gap-4 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-12 w-40 bg-slate-200 dark:bg-slate-700 rounded-[16px]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900 flex flex-col">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {/* 🔥 HEADER UNIFICADO */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="max-w-md mx-auto rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleGoBack}
              className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <h1 className="text-[20px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Conciliação
              </h1>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                Revise transações pendentes
              </p>
            </div>

            <button
              onClick={handleImportCSV}
              className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors active:scale-[0.98]"
              title="Importar CSV"
            >
              <Upload size={18} />
            </button>
          </div>

          {!isComplete && total > 0 && (
            <div className="mt-4">
              <ConciProgress
                current={currentIndex + 1}
                total={total}
                approved={approved}
                rejected={rejected}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {isComplete ? (
          <div className="w-full max-w-md">
            <ConciSummary
              total={queue.length}
              approved={approved}
              rejected={rejected}
              onReset={handleReset}
            />
          </div>
        ) : current ? (
          <div className="w-full max-w-md">
            <ConciCard
              transaction={current}
              onApprove={handleApprove}
              onReject={handleReject}
              onTap={handleTapCard}
              isLast={currentIndex === total - 1}
              isLoading={isProcessing}
            />
          </div>
        ) : (
          <div className="w-full max-w-md">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-6 text-center">
              <div className="w-16 h-16 mx-auto bg-gray-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                <RefreshCw size={28} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">
                Nenhuma transação pendente
              </p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1 mb-5">
                {pendingTransactions && pendingTransactions.length > 0
                  ? 'Todas as transações já foram conciliadas! 🎉'
                  : 'Nenhuma transação pendente para conciliar.'}
              </p>
              <button
                onClick={handleReset}
                className="px-6 py-3.5 bg-teal-600 text-white rounded-[20px] font-bold hover:bg-teal-700 transition-colors active:scale-[0.98] shadow-lg shadow-teal-600/20"
              >
                Recarregar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}