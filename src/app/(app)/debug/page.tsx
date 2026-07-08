'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function DebugPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const all = await db.table('transactions').toArray()
      console.log('📊 Transações encontradas:', all.length)
      setTransactions(all)
    } catch (err: any) {
      console.error('Erro ao carregar:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!user?.id) return
    if (!confirm(`⚠️ EXCLUIR PERMANENTEMENTE esta transação?\n\nIsso vai deletar do celular E da nuvem.`)) return

    setDeleting(id)
    setMessage(null)
    
    try {
      // 1. Deleta do IndexedDB (local)
      await db.table('transactions').delete(id)
      console.log('✅ Deletado do IndexedDB:', id)
      
      // 2. Deleta do Supabase (nuvem)
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Erro ao deletar do Supabase:', error)
        setMessage({ type: 'error', text: `Erro na nuvem: ${error.message}` })
      } else {
        console.log('✅ Deletado do Supabase:', id)
        setMessage({ type: 'success', text: '✅ Transação deletada do celular E da nuvem!' })
      }

      // 3. Recarrega a lista
      await loadData()
    } catch (err: any) {
      console.error('Erro:', err)
      setMessage({ type: 'error', text: `❌ Erro: ${err.message}` })
    } finally {
      setDeleting(null)
    }
  }

  const handleFixStatus = async (id: string) => {
    if (!user?.id) return
    if (!confirm(`Forçar status "done" para esta transação?`)) return

    setDeleting(id)
    setMessage(null)
    
    try {
      // 1. Atualiza local
      await db.table('transactions').update(id, { status: 'done' })
      
      // 2. Atualiza nuvem
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'done' })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        setMessage({ type: 'error', text: `Erro na nuvem: ${error.message}` })
      } else {
        setMessage({ type: 'success', text: '✅ Status atualizado para "done"!' })
      }

      await loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: `❌ Erro: ${err.message}` })
    } finally {
      setDeleting(null)
    }
  }

  const handleDeleteAllPending = async () => {
    if (!user?.id) return
    const pending = transactions.filter(t => t.status === 'pending')
    if (pending.length === 0) {
      setMessage({ type: 'error', text: 'Nenhuma transação pendente para deletar.' })
      return
    }
    if (!confirm(`⚠️ DELETAR TODAS as ${pending.length} transações pendentes?\n\nIsso vai deletar do celular E da nuvem.`)) return

    setDeleting('all')
    setMessage(null)
    
    try {
      let deletedCount = 0
      for (const tx of pending) {
        await db.table('transactions').delete(tx.id)
        await supabase
          .from('transactions')
          .delete()
          .eq('id', tx.id)
          .eq('user_id', user.id)
        deletedCount++
      }
      setMessage({ type: 'success', text: `✅ ${deletedCount} transações pendentes deletadas!` })
      await loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: `❌ Erro: ${err.message}` })
    } finally {
      setDeleting(null)
    }
  }

  const handleDeleteAll = async () => {
    if (!user?.id) return
    if (transactions.length === 0) {
      setMessage({ type: 'error', text: 'Nenhuma transação para deletar.' })
      return
    }
    if (!confirm(`⚠️ DELETAR TODAS as ${transactions.length} transações?\n\nIsso vai deletar do celular E da nuvem.`)) return

    setDeleting('all')
    setMessage(null)
    
    try {
      let deletedCount = 0
      for (const tx of transactions) {
        await db.table('transactions').delete(tx.id)
        await supabase
          .from('transactions')
          .delete()
          .eq('id', tx.id)
          .eq('user_id', user.id)
        deletedCount++
      }
      setMessage({ type: 'success', text: `✅ ${deletedCount} transações deletadas!` })
      await loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: `❌ Erro: ${err.message}` })
    } finally {
      setDeleting(null)
    }
  }

  // 🔥 Se estiver carregando, mostra status
  if (loading) {
    return (
      <div className="p-4 max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Carregando transações...</p>
          <p className="text-sm text-gray-400 mt-2">Verificando o banco de dados local</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-xl text-red-700 dark:text-red-400">
          <p className="font-bold">❌ Erro ao carregar</p>
          <p className="text-sm">{error}</p>
          <button 
            onClick={loadData}
            className="mt-3 bg-red-500 text-white px-4 py-2 rounded text-sm font-bold"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">🛠️ Debug - Transações</h1>
      
      {message && (
        <div className={`p-3 rounded mb-4 ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button 
          onClick={() => router.push('/home')}
          className="bg-teal-500 text-white px-4 py-2 rounded text-sm font-bold"
        >
          🏠 Voltar para Home
        </button>
        <button 
          onClick={loadData}
          className="bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold"
        >
          🔄 Recarregar
        </button>
        <button 
          onClick={handleDeleteAllPending}
          className="bg-orange-500 text-white px-4 py-2 rounded text-sm font-bold"
        >
          🗑️ Deletar pendentes
        </button>
        <button 
          onClick={handleDeleteAll}
          className="bg-red-500 text-white px-4 py-2 rounded text-sm font-bold"
        >
          💀 Deletar TODAS
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {transactions.length} transações no total • 
        {transactions.filter(t => t.status === 'pending').length} pendentes
      </p>

      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">🎉 Nenhuma transação!</p>
          <button 
            onClick={() => router.push('/home')}
            className="mt-4 bg-teal-500 text-white px-6 py-3 rounded-full font-bold"
          >
            Voltar para Home
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx: any) => {
            const isPending = tx.status === 'pending'
            const isDeleting = deleting === tx.id
            return (
              <div key={tx.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border ${isPending ? 'border-red-200 dark:border-red-800' : 'border-green-200 dark:border-green-800'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-200">
                      {tx.description || 'Sem descrição'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                      ID: {tx.id?.slice(0, 8)}...
                    </p>
                  </div>
                  <span className={`text-sm font-bold px-2 py-1 rounded ${isPending ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                    {tx.status || 'pending'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>Valor: R$ {tx.amount}</span>
                  <span>Data: {tx.date}</span>
                  <span>Tipo: {tx.type}</span>
                  <span>Conta: {tx.account_id?.slice(0, 8) || 'N/A'}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {isPending && (
                    <button 
                      onClick={() => handleFixStatus(tx.id)}
                      disabled={isDeleting}
                      className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-blue-600 disabled:opacity-50"
                    >
                      {isDeleting ? '⏳' : '✅ Forçar Pago'}
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(tx.id)}
                    disabled={isDeleting}
                    className="bg-red-500 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-red-600 disabled:opacity-50"
                  >
                    {isDeleting ? '⏳' : '🗑️ Excluir'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}