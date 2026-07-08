'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { useRouter } from 'next/navigation'

export default function DebugPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deletedId, setDeletedId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const all = await db.table('transactions').toArray()
    setTransactions(all)
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm(`Excluir transação ${id} permanentemente?`)) {
      await db.table('transactions').delete(id)
      setDeletedId(id)
      await loadData()
    }
  }

  const handleFixStatus = async (id: string) => {
    if (confirm(`Forçar status "done" para esta transação?`)) {
      await db.table('transactions').update(id, { status: 'done' })
      await loadData()
    }
  }

  if (loading) return <div className="p-4">Carregando...</div>

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">🛠️ Debug - Transações</h1>
      
      {deletedId && (
        <div className="bg-green-100 p-3 rounded mb-4">
          ✅ Transação {deletedId} excluída!
        </div>
      )}

      <button 
        onClick={() => router.push('/home')}
        className="bg-teal-500 text-white px-4 py-2 rounded mb-4"
      >
        Voltar para Home
      </button>

      <div className="space-y-2">
        {transactions.map((tx: any) => (
          <div key={tx.id} className="bg-white dark:bg-slate-800 p-3 rounded border border-gray-200 dark:border-slate-700">
            <p className="font-bold">{tx.description || 'Sem descrição'}</p>
            <p className="text-sm text-gray-500">ID: {tx.id}</p>
            <p className="text-sm">Status: <span className={tx.status === 'done' ? 'text-green-600' : 'text-orange-500'}>{tx.status}</span></p>
            <p className="text-sm">Valor: R$ {tx.amount}</p>
            <p className="text-sm">Conta ID: {tx.account_id || 'N/A'}</p>
            <div className="flex gap-2 mt-2">
              <button 
                onClick={() => handleFixStatus(tx.id)}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
              >
                Forçar Pago
              </button>
              <button 
                onClick={() => handleDelete(tx.id)}
                className="bg-red-500 text-white px-3 py-1 rounded text-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {transactions.length === 0 && (
        <p className="text-gray-500 text-center py-8">Nenhuma transação encontrada.</p>
      )}
    </div>
  )
}
