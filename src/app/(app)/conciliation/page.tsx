// src/app/(app)/conciliation/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, RefreshCw } from 'lucide-react'
import { useConciQueue } from '@/hooks/useConciQueue'
import { ConciCard } from '@/components/conciliation/ConciCard'
import { ConciProgress } from '@/components/conciliation/ConciProgress'
import { ConciSummary } from '@/components/conciliation/ConciSummary'
import { generateMockTransactions } from '@/lib/conciliationUtils'
import { useToast } from '@/contexts/ToastContext'

export default function ConciliationPage() {
  const router = useRouter()
  const { showToast } = useToast()
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
    getStats,
  } = useConciQueue()

  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadingPulse, setLoadingPulse] = useState(false)

  useEffect(() => {
    setLoadingPulse(true)

    const timer = setTimeout(() => {
      if (queue.length === 0 && !isComplete) {
        const mock = generateMockTransactions(6)
        reset(mock)
      }
      setIsLoading(false)
      setLoadingPulse(false)
    }, 600)

    return () => clearTimeout(timer)
  }, [])

  const handleApprove = (id: string) => {
    setIsProcessing(true)
    setLoadingPulse(true)

    setTimeout(() => {
      approve()
      showToast('Transação aprovada ✅', 'success')
      setIsProcessing(false)
      setLoadingPulse(false)
    }, 300)
  }

  const handleReject = (id: string) => {
    setIsProcessing(true)
    setLoadingPulse(true)

    setTimeout(() => {
      reject()
      showToast('Transação descartada ❌', 'info')
      setIsProcessing(false)
      setLoadingPulse(false)
    }, 300)
  }

  const handleReset = () => {
    setLoadingPulse(true)

    setTimeout(() => {
      const mock = generateMockTransactions(6)
      reset(mock)
      showToast('Fila reiniciada com novos dados 🔄', 'info')
      setLoadingPulse(false)
    }, 400)
  }

  const handleTapCard = (id: string) => {
    showToast('Edição em breve ✏️', 'info')
  }

  const handleImportCSV = () => {
    showToast('Importação de CSV em breve 📄', 'info')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-lg border border-gray-100 dark:border-slate-700/50 p-6 h-[400px] flex flex-col items-center justify-center gap-4 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="h-6 w-48 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-12 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      <header className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Conciliação
          </h1>
          <button
            onClick={handleImportCSV}
            className="p-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-full transition-colors"
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
          <div className="text-center text-gray-500 dark:text-gray-400 space-y-4">
            <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <RefreshCw size={32} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-lg font-medium">Nenhuma transação pendente</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Importe um arquivo CSV ou carregue dados de exemplo.
            </p>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-teal-600 text-white rounded-2xl font-bold hover:bg-teal-700 transition-colors active:scale-95"
            >
              Carregar dados de exemplo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}