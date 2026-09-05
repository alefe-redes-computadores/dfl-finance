// src/components/admin/SyncQueueTable.tsx
'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/db'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export function SyncQueueTable() {
  const [items, setItems] = useState<any[]>([])

  const loadQueue = async () => {
    const queue = await db.syncQueue.toArray()
    setItems(queue)
  }

  useEffect(() => {
    void loadQueue()
  }, [])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="font-bold text-lg dark:text-white">Fila de Sincronização</h2>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            Diagnóstico somente leitura. Itens pendentes não são descartados manualmente.
          </p>
        </div>

        <button
          onClick={() => void loadQueue()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"
          type="button"
          title="Atualizar fila"
        >
          <RefreshCw size={18} className="text-gray-500" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-400 text-sm italic">Fila local vazia.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium dark:text-white">{item.table}</p>
                  <p className="text-xs text-gray-500 break-all">
                    ID: {item.record_id} • Op: {item.operation}
                  </p>
                </div>

                {item.attempts > 0 && (
                  <div
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                    title="Tentativas registradas"
                  >
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
                <p className="mt-2 text-[11px] text-red-600 dark:text-red-400 break-words">
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
