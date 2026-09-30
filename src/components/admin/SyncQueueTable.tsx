'use client'

import { useCallback, useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export function SyncQueueTable() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const loadQueue = useCallback(async () => {
    if (!user?.id) {
      setItems([])
      return
    }

    const queue = await db.syncQueue
      .where('user_id')
      .equals(user.id)
      .sortBy('created_at')

    setItems(queue)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      setItems([])
      return
    }

    const subscription = liveQuery(() =>
      db.syncQueue
        .where('user_id')
        .equals(user.id)
        .sortBy('created_at')
    ).subscribe({
      next: (queue) => setItems(queue),
      error: (error) => {
        console.error('SyncQueueTable: falha ao observar fila local:', error)
      },
    })

    return () => subscription.unsubscribe()
  }, [user?.id])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadQueue()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold dark:text-white">Fila de Sincronização</h2>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            Fila local do usuário atual, atualizada em tempo real.
          </p>
        </div>

        <button
          onClick={() => void handleRefresh()}
          disabled={refreshing || !user?.id}
          className="rounded-full p-2 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-slate-700"
          type="button"
          title="Atualizar fila"
          aria-label="Atualizar fila de sincronização"
        >
          <RefreshCw size={18} className={`text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Fila local vazia.
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-600/80 dark:text-emerald-400/70">
            Nenhuma alteração deste usuário aguarda envio.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium dark:text-white">{item.table}</p>
                  <p className="break-all text-xs text-gray-500">
                    ID: {item.record_id} • Op: {item.operation}
                  </p>
                </div>
                {item.attempts > 0 && (
                  <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" title="Tentativas registradas">
                    <AlertTriangle size={12} />
                    {item.attempts}
                  </div>
                )}
              </div>
              <div className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                Revisão {item.revision ?? 0}
                {item.last_attempt_at ? ` • Última tentativa: ${item.last_attempt_at}` : ''}
              </div>
              {item.last_error && (
                <p className="mt-2 break-words text-[11px] text-red-600 dark:text-red-400">
                  {item.last_error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
