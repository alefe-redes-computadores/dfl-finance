// src/app/(app)/conciliation/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload } from 'lucide-react'
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

  useEffect(() => {
    if (queue.length === 0 && !isComplete) {
      const mock = generateMockTransactions(6)
      reset(mock)
    }
    setIsLoading(false)
  }, [])

  const handleApprove = (id: string) => {
    setIsProcessing(true)
    approve()
    showToast('Transação aprovada ✅', 'success')
    setTimeout(() => setIsProcessing(false), 300)
  }

  const handleReject = (id: string) => {
    setIsProcessing(true)
    reject()
    showToast('Transação descartada ❌', 'info')
    setTimeout(() => setIsProcessing(false), 300)
  }

  const handleReset = () => {
    const mock = generateMockTransactions(6)
    reset(mock)
    showToast('Fila reiniciada 🔄', 'info')
  }

  const handleTapCard = (id: string) => {
    showToast('Edição em breve ✏️', 'info')
  }

  const handleImportCSV = () => {
    showToast('Importação de CSV em breve 📄', 'info')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-800 dark:text-gray-200"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Conciliação
          </h1>
          <button
            onClick={handleImportCSV}
            className="p-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-full transition-colors"
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

      {/* Área principal */}
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
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-lg">Nenhuma transação pendente</p>
            <button
              onClick={handleReset}
              className="mt-4 text-teal-600 hover:underline"
            >
              Carregar dados de exemplo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}