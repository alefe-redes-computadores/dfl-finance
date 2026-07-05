'use client'

import { useEffect, useState, useCallback } from 'react'
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

  // 1. BLINDAGEM DE FILTROS: Transforma em texto bruto (Não causa re-render)
  const filterString = JSON.stringify(filters || {})
  const orderString = JSON.stringify(orderBy || null)

  const fetchLocal = useCallback(async () => {
    if (!user?.id) return []

    try {
      const collection = db[table as keyof typeof db] as any
      if (!collection) return []

      const parsedFilters = JSON.parse(filterString)
      const parsedOrder = JSON.parse(orderString)

      let query = collection.where('user_id').equals(user.id)

      Object.entries(parsedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.and((item: any) => item[key] === value)
        }
      })

      let results = await query.toArray() as T[]

      if (parsedOrder) {
        results = results.sort((a: any, b: any) => {
          const aVal = a[parsedOrder.field] ?? ''
          const bVal = b[parsedOrder.field] ?? ''
          const direction = parsedOrder.direction === 'desc' ? -1 : 1
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
  }, [user?.id, table, filterString, orderString, limit])

  const syncWithSupabase = useCallback(async () => {
    if (!user?.id || !isOnline) return

    setSyncing(true)
    try {
      const parsedFilters = JSON.parse(filterString)
      const parsedOrder = JSON.parse(orderString)

      let query = supabase.from(table).select('*').eq('user_id', user.id)

      Object.entries(parsedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value)
        }
      })

      if (parsedOrder) {
        query = query.order(parsedOrder.field, {
          ascending: parsedOrder.direction !== 'desc',
        })
      }

      if (limit) query = query.limit(limit)

      const { data: supabaseData, error: supabaseError } = await query
      if (supabaseError) throw supabaseError

      const tableRef = db[table as keyof typeof db] as any

      if (supabaseData) {
        const itemsToPut = supabaseData.map((item: any) => ({
          ...item,
          sync_status: 'synced',
          sync_attempts: 0,
          last_sync_error: null,
        }))

        if (itemsToPut.length > 0) await tableRef.bulkPut(itemsToPut)

        const localResults = await fetchLocal()
        const localIds = localResults.map((item: any) => item.id)
        const supabaseIds = supabaseData.map((item: any) => item.id)
        
        const toRemove = localIds.filter((id: string) => !supabaseIds.includes(id))
        if (toRemove.length > 0) await tableRef.bulkDelete(toRemove)
      }
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }, [user?.id, isOnline, table, filterString, orderString, limit, fetchLocal])

  const reload = useCallback(async () => {
    if (!user?.id) return
    
    setLoading(data.length === 0)
    setError(null)

    try {
      const localData = await fetchLocal()
      // 2. BLINDAGEM DE ESTADO: Só atualiza se o conteúdo mudou! (Mata o loop em cascata)
      setData(prev => JSON.stringify(prev) === JSON.stringify(localData) ? prev : localData)
      setLoading(false)

      if (isOnline) {
        syncWithSupabase().then(async () => {
          const updatedData = await fetchLocal()
          setData(prev => JSON.stringify(prev) === JSON.stringify(updatedData) ? prev : updatedData)
        })
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }, [user?.id, fetchLocal, syncWithSupabase, isOnline, data.length])

  const create = useCallback(async (item: Omit<T, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return
    const now = new Date().toISOString()
    const newItem: any = {
      ...item, id: crypto.randomUUID(), user_id: user.id, created_at: now, updated_at: now, sync_status: 'pending', sync_attempts: 0,
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
    const updatedItem = { ...existing, ...updates, updated_at: new Date().toISOString(), sync_status: 'pending' }
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

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!realtime || !user?.id) return
    const channelName = `local-data-${table}-${user.id}-${Math.random().toString(36).substring(7)}`
    const channel = supabase.channel(channelName).on('postgres_changes', { event: '*', schema: 'public', table: table, filter: `user_id=eq.${user.id}` }, () => { reload() }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [realtime, user?.id, table, reload])

  return { data, loading, syncing, error, reload, create, update, remove }
}
