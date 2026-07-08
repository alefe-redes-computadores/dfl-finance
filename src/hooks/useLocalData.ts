'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { liveQuery } from 'dexie'

type AllTables = 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications' | 'chat_history' | 'chat_sessions'

export function useLocalData<T>({
  table,
  filters = {},
  limit,
  orderBy = 'date',
  orderDir = 'desc',
}: {
  table: AllTables
  filters?: any
  limit?: number
  orderBy?: string
  orderDir?: 'asc' | 'desc'
}) {
  const { user } = useAuth()
  
  const [data, setData] = useState<T[] | null>(null) 
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  
  const lock = useRef(false)
  const filtersKey = JSON.stringify(filters)
  const reloadCount = useRef(0)

  // ============================================================
  // 🔥 1. REATIVIDADE LOCAL COM liveQuery
  // ============================================================
  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    const observable = liveQuery(async () => {
      const collection = db.table(table)
      let q = collection.where('user_id').equals(user.id)

      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q = q.and((i: any) => i[k] === v)
        }
      })

      let res = await q.toArray()

      if (orderBy && res.length > 0) {
        res = res.sort((a: any, b: any) => {
          const valA = a[orderBy] || ''
          const valB = b[orderBy] || ''
          
          if (orderBy === 'date' || orderBy === 'created_at' || orderBy === 'updated_at') {
            return orderDir === 'desc' 
              ? new Date(valB).getTime() - new Date(valA).getTime()
              : new Date(valA).getTime() - new Date(valB).getTime()
          }
          
          if (typeof valA === 'number' && typeof valB === 'number') {
            return orderDir === 'desc' ? valB - valA : valA - valB
          }
          
          return orderDir === 'desc' 
            ? String(valB).localeCompare(String(valA))
            : String(valA).localeCompare(String(valB))
        })
      }

      if (limit && limit > 0) {
        res = res.slice(0, limit)
      }

      return res
    })

    const subscription = observable.subscribe({
      next: (result: any) => {
        setData(result || [])
        setLoading(false)
      },
      error: (err) => {
        console.error(`Erro no liveQuery da tabela ${table}:`, err)
        setData([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [user?.id, table, filtersKey, limit, orderBy, orderDir, reloadCount.current])

  // ============================================================
  // 🔥 2. SINCRONIZAÇÃO COM A NUVEM
  // ============================================================
  useEffect(() => {
    if (!user?.id || lock.current) return
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
          await db.table(table).bulkPut(
            remoteData.map((r: any) => ({ ...r, sync_status: 'synced' }))
          )
        }
      } catch (err) {
        console.error(`Erro inesperado na sincronização de ${table}:`, err)
      } finally {
        lock.current = false
        setSyncing(false)
      }
    }

    sync()
  }, [user?.id, table])

  // ============================================================
  // 🔥 3. RELOAD DE VERDADE (FORÇA RELEITURA)
  // ============================================================
  const reload = useCallback(async () => {
    setLoading(true)
    
    // 🔥 Força o liveQuery a reagir incrementando o contador
    reloadCount.current += 1
    
    // 🔥 Também força uma sincronização manual
    if (user?.id && navigator.onLine) {
      try {
        const { data: remoteData, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', user.id)

        if (!error && remoteData && remoteData.length > 0) {
          await db.table(table).bulkPut(
            remoteData.map((r: any) => ({ ...r, sync_status: 'synced' }))
          )
        }
      } catch (err) {
        console.error('Erro no reload manual:', err)
      }
    }
    
    // Pequeno delay para garantir que o liveQuery reagiu
    await new Promise(resolve => setTimeout(resolve, 150))
    setLoading(false)
  }, [user?.id, table])

  return { 
    data: data || [], 
    loading: loading || data === null, 
    syncing, 
    reload 
  }
}