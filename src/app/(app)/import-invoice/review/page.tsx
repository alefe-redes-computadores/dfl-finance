'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, GitMerge, X } from 'lucide-react'

// Função local de formatação (evita import de @/lib/utils)
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

interface ExtractedTransaction {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
}

interface ReviewItem {
  imported: ExtractedTransaction
  matched: {
    id: string
    description: string
    amount: number
    date: string
    similarity: number
  }
  score: number
}

export default function ReviewImportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [newTrans] = useState<ExtractedTransaction[]>(() => {
    try {
      const data = searchParams.get('new')
      return data ? JSON.parse(atob(data)) : []
    } catch {
      return []
    }
  })
  const [review] = useState<ReviewItem[]>(() => {
    try {
      const data = searchParams.get('review')
      return data ? JSON.parse(atob(data)) : []
    } catch {
      return []
    }
  })
  const [duplicates] = useState<ExtractedTransaction[]>(() => {
    try {
      const data = searchParams.get('duplicates')
      return data ? JSON.parse(atob(data)) : []
    } catch {
      return []
    }
  })

  const [selectedNew, setSelectedNew] = useState<boolean[]>(newTrans.map(() => true))
  const [reviewDecisions, setReviewDecisions] = useState<('merge' | 'keep' | null)[]>(review.map(() => null))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleConfirm = async () => {
    setLoading(true)
    setMessage(null)

    const confirmedNew = newTrans.filter((_, i) => selectedNew[i])
    const mergedIds: string[] = []
    const keepTransactions: ExtractedTransaction[] = []

    review.forEach((item, i) => {
      if (reviewDecisions[i] === 'merge') {
        mergedIds.push(item.matched.id)
      } else if (reviewDecisions[i] === 'keep') {
        keepTransactions.push(item.imported)
      }
    })

    try {
      // Usa fetch direto para evitar import do supabase
      const response = await fetch('/api/confirm-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTransactions: [...confirmedNew, ...keepTransactions],
          mergedIds,
          context: 'pf',
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erro ao confirmar importação')
      }

      setMessage({
        type: 'success',
        text: `${confirmedNew.length + keepTransactions.length} adicionadas, ${mergedIds.length} mescladas, ${duplicates.length} ignoradas.`,
      })

      setTimeout(() => router.push('/home'), 1500)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  if (newTrans.length === 0 && review.length === 0 && duplicates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-gray-500">Nenhum dado de importação encontrado.</p>
        <button
          onClick={() => router.push('/home')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Voltar para Home
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-semibold">Revisar Importação</h1>
      </div>

      {/* Seção Novas */}
      <div className="border-l-4 border-l-emerald-500 bg-white rounded-lg shadow-sm">
        <div className="p-4">
          <h2 className="text-lg font-medium text-emerald-600 flex items-center gap-2">
            <Check className="w-5 h-5" /> Novas ({newTrans.length})
          </h2>
          {newTrans.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">Nenhuma transação nova detectada.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {newTrans.map((t, i) => (
                <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedNew[i]}
                    onChange={(e) => {
                      const updated = [...selectedNew]
                      updated[i] = e.target.checked
                      setSelectedNew(updated)
                    }}
                    className="rounded w-4 h-4"
                  />
                  <span className="flex-1">
                    {t.description} - {formatCurrency(t.amount)}{' '}
                    <span className="text-gray-400">({t.date})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Seção Revisão */}
      <div className="border-l-4 border-l-amber-500 bg-white rounded-lg shadow-sm">
        <div className="p-4">
          <h2 className="text-lg font-medium text-amber-600 flex items-center gap-2">
            <GitMerge className="w-5 h-5" /> Para Revisão ({review.length})
          </h2>
          {review.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">Nenhuma correspondência parcial.</p>
          ) : (
            <div className="mt-2 space-y-4">
              {review.map((item, i) => (
                <div key={i} className="border rounded-lg p-3 text-sm">
                  <div className="flex justify-between mb-2 gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-xs text-gray-400">Importada</p>
                      <p>{item.imported.description}</p>
                      <p className="text-gray-500">
                        {formatCurrency(item.imported.amount)} • {item.imported.date}
                      </p>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="font-medium text-xs text-gray-400">Existente</p>
                      <p>{item.matched.description}</p>
                      <p className="text-gray-500">
                        {formatCurrency(item.matched.amount)} • {item.matched.date}
                      </p>
                      <p className="text-xs text-gray-400">
                        Similaridade: {(item.score * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        const updated = [...reviewDecisions]
                        updated[i] = 'merge'
                        setReviewDecisions(updated)
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border ${
                        reviewDecisions[i] === 'merge'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <GitMerge className="w-3 h-3" /> Mesclar
                    </button>
                    <button
                      onClick={() => {
                        const updated = [...reviewDecisions]
                        updated[i] = 'keep'
                        setReviewDecisions(updated)
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border ${
                        reviewDecisions[i] === 'keep'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <X className="w-3 h-3" /> Manter Separadas
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Seção Duplicatas */}
      <div className="border-l-4 border-l-red-500 bg-white rounded-lg shadow-sm">
        <div className="p-4">
          <h2 className="text-lg font-medium text-red-600 flex items-center gap-2">
            <X className="w-5 h-5" /> Duplicatas Ignoradas ({duplicates.length})
          </h2>
          {duplicates.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">Nenhuma duplicata exata.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {duplicates.map((t, i) => (
                <p key={i} className="text-sm text-gray-500">
                  {t.description} - {formatCurrency(t.amount)} ({t.date})
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mensagem de feedback */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Botão Confirmar */}
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full py-3 text-base font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Processando...' : 'Confirmar Importação'}
      </button>
    </div>
  )
}