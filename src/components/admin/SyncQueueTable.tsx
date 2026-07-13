'use client'

import { useEffect, useState } from 'react'
import { db, removeFromSyncQueue } from '@/lib/db'
import { Trash2, RefreshCw } from 'lucide-react'

export function SyncQueueTable() {
  const [items, setItems] = useState<any[]>([])

  const loadQueue = async () => {
    const queue = await db.sync_queue.toArray()
    setItems(queue)
  }

  useEffect(() => {
    loadQueue()
  }, [])

  const handleDelete = async (id: number) => {
    await removeFromSyncQueue(id)
    loadQueue() // Recarrega a lista
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg dark:text-white">Fila de Sincronização</h2>
        <button onClick={loadQueue} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">
          <RefreshCw size={18} className="text-gray-500" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-400 text-sm italic">Fila vazia. Tudo sincronizado!</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700">
              <div>
                <p className="text-sm font-medium dark:text-white">{item.table}</p>
                <p className="text-xs text-gray-500">ID: {item.record_id} • Op: {item.operation}</p>
              </div>
              <button 
                onClick={() => handleDelete(item.id)}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
