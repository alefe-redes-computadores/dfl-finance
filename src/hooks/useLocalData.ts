'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

type AllTables = 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications'

export function useLocalData<T>({
  table,
  filters = {},
  limit,
}: {
  table: AllTables
  filters?: any
  limit?: number
}) {
  const { user } = useAuth()
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const lock = useRef(false)
  const filtersKey = JSON.stringify(filters)

  const fetchData = useCallback(async () => {
    if (!user?.id) return

    try {
      const collection = db.table(table)
      let q = collection.where('user_id').equals(user.id)

      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q = q.and((i: any) => i[k] === v)
        }
      })

      let res = await q.toArray()

      if (limit) {
        res = res.slice(0, limit)
      }

      setData(res)
    } catch (err) {
      console.error(`Erro ao ler ${table} do IndexedDB:`, err)
      setData([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, table, filtersKey, limit])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ============================================================
  // SINCRONIZAÇÃO INICIAL (1x por tabela+usuário, com trava segura)
  // ============================================================
  useEffect(() => {
    if (!user?.id) return
    if (lock.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    lock.current = true
    setSyncing(true)

    async function sync() {
      try {
        const { data: remoteData, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', user!.id)

        if (error) {
          console.error(`Erro ao sincronizar ${table} do Supabase:`, error)
          return
        }

        if (remoteData && remoteData.length > 0) {
          const tableRef = db.table(table)
          await tableRef.bulkPut(
            remoteData.map((r: any) => ({ ...r, sync_status: 'synced' }))
          )
        }

        // Recarrega do IndexedDB depois de sincronizar,
        // mesmo se remoteData vier vazio (para não travar loading)
        await fetchData()
      } catch (err) {
        console.error(`Erro inesperado na sincronização de ${table}:`, err)
      } finally {
        // 🔑 CRÍTICO: lock.current = false SEMPRE executa,
        // mesmo se sync() lançar exceção antes de chegar aqui
        lock.current = false
        setSyncing(false)
      }
    }


    sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, table])

  return { data, loading, syncing, reload: fetchData }
}