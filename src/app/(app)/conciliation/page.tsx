// src/app/(app)/conciliation/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, RefreshCw, Loader2 } from 'lucide-react'
import { useConciQueue } from '@/hooks/useConciQueue'
import { ConciCard } from '@/components/conciliation/ConciCard'
import { ConciProgress } from '@/components/conciliation/ConciProgress'
import { ConciSummary } from '@/components/conciliation/ConciSummary'
import { useToast } from '@/contexts/ToastContext'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useLocalData } from '@/hooks/useLocalData'
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

  // 🔥 DADOS REAIS: Busca transações pendentes do banco local
  const { data: pendingTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext, status: 'pending' },
  })

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

  // 🔥 Inicializa a fila com dados reais
  useEffect(() => {
    const initQueue = async () => {
      setLoadingPulse(true)
      setIsLoading(true)

      try {
        await reloadTransactions()
        
        if (pendingTransactions && pendingTransactions.length > 0) {
          reset(pendingTransactions)
        } else {
          // Se não houver pendentes, mostra estado vazio
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
  }, [effectiveContext])

  const handleApprove = (id: string) => {
    setIsProcessing(true)
    setLoadingPulse(true)

    // 🔥 Simula o processamento assíncrono sem travar a UI
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

  // 🔥 Navegação fixa: router.push('/more') em vez de router.back()
  const handleGoBack = () => {
    router.push('/more')
  }

  if (isLoading || txLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-lg border border-slate-100 dark:border-slate-700/50 p-6 h-[400px] flex flex-col items-center justify-center gap-4 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-12 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      <header className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={handleGoBack}
            className="p-2 -ml-2 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors active:scale-[0.95]"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Conciliação
          </h1>
          <button
            onClick={handleImportCSV}
            className="p-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-full transition-colors active:scale-[0.95]"
            title="Importar CSV"
          >
            <Upload size={20} />
          </button>
        </div>

        {!isComplete && total > 0 && (
          <div className="max-w-md mx-auto mt-3">
            <ConciProgress
              current={currentIndex + 1}
              total={total}
              approved={approved}
              rejected={rejected}
            />
          </div>
        )}
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        {isComplete ? (
          <ConciSummary
            total={queue.length}
            approved={approved}
            rejected={rejected}
            onReset={handleReset}
          />
        ) : current ? (
          <div className="w-full">
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
          <div className="text-center text-slate-500 dark:text-slate-400 space-y-4">
            <div className="w-20 h-20 mx-auto bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <RefreshCw size={32} className="text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-lg font-medium">Nenhuma transação pendente</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {pendingTransactions && pendingTransactions.length > 0 
                ? 'Todas as transações já foram conciliadas! 🎉'
                : 'Nenhuma transação pendente para conciliar.'}
            </p>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-teal-600 text-white rounded-2xl font-bold hover:bg-teal-700 transition-colors active:scale-[0.95] shadow-md shadow-teal-600/20"
            >
              Recarregar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
// ✅ Refatoração Premium Finalizada — Dados Reais + Navegação Fixa