'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { liveQuery } from 'dexie'

type AllTables = 
  | 'transactions' 
  | 'accounts' 
  | 'categories' 
  | 'debts' 
  | 'loans' 
  | 'financings' 
  | 'subscriptions' 
  | 'tags' 
  | 'contacts' 
  | 'budgets' 
  | 'goals' 
  | 'credit_cards' 
  | 'credit_invoices' 
  | 'notifications' 
  | 'chat_history' 
  | 'chat_sessions'

interface UseLocalDataProps {
  table: AllTables
  filters?: Record<string, any>
  limit?: number
  orderBy?: string
  orderDir?: 'asc' | 'desc'
}

export function useLocalData<T = any>({
  table,
  filters = {},
  limit,
  orderBy = 'date',
  orderDir = 'desc',
}: UseLocalDataProps) {
  const { user } = useAuth()

  // 🔥 A MÁGICA DO FLICKER: Começa como null em vez de array vazio
  const [data, setData] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // Contador que força o useEffect do liveQuery a rodar de novo
  const [reloadTick, setReloadTick] = useState(0)

  const lock = useRef(false)
  const filtersKey = JSON.stringify(filters)

  // ============================================================
  // 1. REATIVIDADE LOCAL COM liveQuery (DEXIE)
  // ============================================================
  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    const observable = liveQuery(async () => {
      const collection = db.table(table)
      let query = collection.where('user_id').equals(user.id)

      // Aplica filtros dinâmicos
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.and((item: any) => item[key] === value)
        }
      })

      let results = await query.toArray()

      // Ordenação em memória
      if (orderBy && results.length > 0) {
        results = results.sort((a: any, b: any) => {
          const valA = a[orderBy] ?? ''
          const valB = b[orderBy] ?? ''

          if (orderBy === 'date' || orderBy === 'created_at' || orderBy === 'updated_at') {
            const timeA = new Date(valA).getTime() || 0
            const timeB = new Date(valB).getTime() || 0
            return orderDir === 'desc' ? timeB - timeA : timeA - timeB
          }

          if (typeof valA === 'number' && typeof valB === 'number') {
            return orderDir === 'desc' ? valB - valA : valA - valB
          }

          return orderDir === 'desc'
            ? String(valB).localeCompare(String(valA))
            : String(valA).localeCompare(String(valB))
        })
      }

      // Aplica o limite, se existir
      if (limit && limit > 0) {
        results = results.slice(0, limit)
      }

      return results as T[]
    })

    const subscription = observable.subscribe({
      next: (result) => {
        setData(result || [])
        setLoading(false)
      },
      error: (err) => {
        console.error(`[LocalData] Erro no liveQuery da tabela ${table}:`, err)
        setData([]) // Evita quebrar a tela em caso de falha de leitura
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [user?.id, table, filtersKey, limit, orderBy, orderDir, reloadTick])

  // ============================================================
  // 2. SINCRONIZAÇÃO COM A NUVEM (PULL SERVER -> LOCAL)
  //
  // Proteção contra "Efeito Rebote": Impede que dados do Supabase
  // sobrescrevam edições locais que ainda estão com sync_status
  // 'pending' ou 'failed' na fila de sincronização.
  // ============================================================
  useEffect(() => {
    if (!user?.id || lock.current) return
    if (typeof window !== 'undefined' && !window.navigator.onLine) return

    lock.current = true
    setSyncing(true)

    async function syncPull() {
      try {
        const { data: remoteData, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', user!.id)

        if (error) {
          console.error(`[LocalData] Erro ao buscar ${table} do Supabase:`, error)
          return
        }

        if (remoteData && remoteData.length > 0) {
          let pendingIds = new Set<string>()
          
          try {
            const pendingLocal = await db.table(table)
              .where('sync_status')
              .anyOf(['pending', 'failed'])
              .primaryKeys()
            
            pendingIds = new Set(pendingLocal as string[])
          } catch (e) {
            console.warn(`[LocalData] Índice 'sync_status' ausente ou inacessível em ${table}:`, e)
          }

          // Só sobrescreve se o ID não estiver na lista de edições locais pendentes
          const safeToOverwrite = pendingIds.size > 0
            ? remoteData.filter((record: any) => !pendingIds.has(record.id))
            : remoteData

          if (safeToOverwrite.length > 0) {
            await db.table(table).bulkPut(
              safeToOverwrite.map((record: any) => ({ ...record, sync_status: 'synced' }))
            )
          }
        }
      } catch (err) {
        console.error(`[LocalData] Erro inesperado na sincronização de ${table}:`, err)
      } finally {
        lock.current = false
        setSyncing(false)
      }
    }

    syncPull()
  }, [user?.id, table])

  // ============================================================
  // 3. FUNÇÃO RELOAD MANUAL
  // Força o efeito do liveQuery a remontar a subscription
  // ============================================================
  const reload = useCallback(async () => {
    setLoading(true)
    setReloadTick(t => t + 1)
    await new Promise(resolve => setTimeout(resolve, 60))
  }, [])

  return {
    data: data || [],
    loading: loading || data === null,
    syncing,
    reload
  }
}
