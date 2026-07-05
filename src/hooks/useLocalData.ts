// src/hooks/useLocalData.ts
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useLocalSync } from './useLocalSync'

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

interface UseLocalDataOptions {
  table: AllTables
  filters?: Record<string, any>
  orderBy?: { field: string; direction?: 'asc' | 'desc' }
  limit?: number
  realtime?: boolean
}

export function useLocalData<T>({
  table,
  filters = {},
  orderBy,
  limit,
  realtime = true,
}: UseLocalDataOptions) {
  const { user } = useAuth()
  const { isOnline, queueOperation } = useLocalSync()
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cache dos filtros serializados para evitar loops
  const filtersKey = useRef(JSON.stringify(filters))
  const orderByKey = useRef(JSON.stringify(orderBy))

  // ============================================================
  // BUSCAR DADOS LOCALMENTE (COM FILTROS DINÂMICOS)
  // ============================================================
  const fetchLocal = useCallback(async () => {
    if (!user?.id) return []

    try {
      let collection = db[table as keyof typeof db] as any

      if (!collection || !collection.where) {
        console.warn(`Tabela ${table} não encontrada no IndexedDB`)
        return []
      }

      let query = collection.where('user_id').equals(user.id)

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.and((item: any) => item[key] === value)
        }
      })

      let results = await query.toArray() as T[]

      if (orderBy) {
        results = results.sort((a: any, b: any) => {
          const aVal = a[orderBy.field] ?? ''
          const bVal = b[orderBy.field] ?? ''
          const direction = orderBy.direction === 'desc' ? -1 : 1
          return aVal > bVal ? direction : aVal < bVal ? -direction : 0
        })
      }

      if (limit && results.length > limit) {
        results = results.slice(0, limit)
      }

      return results
    } catch (err) {
      console.error(`Erro ao buscar ${table} localmente:`, err)
      return []
    }
  }, [user?.id, table, filtersKey.current, orderByKey.current, limit])

  // ============================================================
  // SINCRONIZAR COM SUPABASE (BACKGROUND)
  // ============================================================
  const syncWithSupabase = useCallback(async () => {
    if (!user?.id || !isOnline) return

    setSyncing(true)

    try {
      let query = supabase
        .from(table)
        .select('*')
        .eq('user_id', user.id)

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value)
        }
      })

      if (orderBy) {
        query = query.order(orderBy.field, {
          ascending: orderBy.direction !== 'desc',
        })
      }

      if (limit) {
        query = query.limit(limit)
      }

      const { data: supabaseData, error: supabaseError } = await query

      if (supabaseError) throw supabaseError

      if (supabaseData && supabaseData.length > 0) {
        const tableRef = db[table as keyof typeof db] as any

        for (const item of supabaseData) {
          await tableRef.put({
            ...item,
            sync_status: 'synced',
            sync_attempts: 0,
            last_sync_error: null,
          })
        }

        const localIds = (await fetchLocal()).map((item: any) => item.id)
        const supabaseIds = supabaseData.map((item: any) => item.id)
        const toRemove = localIds.filter((id: string) => !supabaseIds.includes(id))

        for (const id of toRemove) {
          await tableRef.delete(id)
        }
      }

      setError(null)
    } catch (err: any) {
      console.error(`Erro ao sincronizar ${table}:`, err)
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }, [user?.id, isOnline, table, filtersKey.current, orderByKey.current, limit, fetchLocal])

  // ============================================================
  // RECARREGAR DADOS
  // ============================================================
  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const localData = await fetchLocal()
      setData(localData)

      if (isOnline) {
        await syncWithSupabase()
        const updatedData = await fetchLocal()
        setData(updatedData)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchLocal, syncWithSupabase, isOnline])

  // ============================================================
  // CRUD COM FILA
  // ============================================================
  const create = useCallback(async (item: Omit<T, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return

    const now = new Date().toISOString()
    const newItem: any = {
      ...item,
      id: crypto.randomUUID(),
      user_id: user.id,
      created_at: now,
      updated_at: now,
      sync_status: 'pending',
      sync_attempts: 0,
    }

    const tableRef = db[table as keyof typeof db] as any
    await tableRef.add(newItem)
    await queueOperation(table, 'create', newItem.id, newItem)
    await reload()
  }, [user?.id, table, queueOperation, reload])

  const update = useCallback(async (id: string, updates: Partial<T>) => {
    const tableRef = db[table as keyof typeof db] as any
    const existing = await tableRef.get(id)

    if (!existing) return

    const updatedItem = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    }

    await tableRef.put(updatedItem)
    await queueOperation(table, 'update', id, updatedItem)
    await reload()
  }, [table, queueOperation, reload])

  const remove = useCallback(async (id: string) => {
    const tableRef = db[table as keyof typeof db] as any
    const existing = await tableRef.get(id)

    if (!existing) return

    await tableRef.delete(id)
    await queueOperation(table, 'delete', id, { id })
    await reload()
  }, [table, queueOperation, reload])

  // ============================================================
  // ATUALIZA CACHE DOS FILTROS
  // ============================================================
  useEffect(() => {
    const newFiltersKey = JSON.stringify(filters)
    const newOrderByKey = JSON.stringify(orderBy)

    if (newFiltersKey !== filtersKey.current || newOrderByKey !== orderByKey.current) {
      filtersKey.current = newFiltersKey
      orderByKey.current = newOrderByKey
      reload()
    }
  }, [JSON.stringify(filters), JSON.stringify(orderBy)])

  // ============================================================
  // EFETTO INICIAL
  // ============================================================
  useEffect(() => {
    reload()
  }, [table, user?.id])

  // ============================================================
  // REALTIME
  // ============================================================
  useEffect(() => {
    if (!realtime || !user?.id) return

    const channel = supabase
      .channel(`local-data-${table}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          reload()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [realtime, user?.id, table])

  return {
    data,
    loading,
    syncing,
    error,
    reload,
    create,
    update,
    remove,
  }
}