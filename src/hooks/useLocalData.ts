'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useLocalSync } from './useLocalSync'

type AllTables = 
  | 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' 
  | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' 
  | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications'

interface UseLocalDataOptions {
  table: AllTables
  filters?: Record<string, any>
  orderBy?: { field: string; direction?: 'asc' | 'desc' }
  limit?: number
  realtime?: boolean
}

const globalLastFetch: Record<string, number> = {}

export function useLocalData<T>({ table, filters = {}, orderBy, limit, realtime = true }: UseLocalDataOptions) {
  const { user } = useAuth()
  const { queueOperation } = useLocalSync()
  
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  const filterStr = JSON.stringify(filters || {})
  const orderStr = JSON.stringify(orderBy || null)

  const fetchLocal = useCallback(async () => {
    if (typeof window === 'undefined' || !user?.id) return []
    
    try {
      const collection = db[table as keyof typeof db] as any
      if (!collection) return []
      
      const pFilters = JSON.parse(filterStr)
      const pOrder = JSON.parse(orderStr)

      let q = collection.where('user_id').equals(user.id)
      Object.entries(pFilters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q = q.and((item: any) => item[k] === v)
        }
      })

      let res = await q.toArray()
      if (pOrder) {
        res = res.sort((a: any, b: any) => {
          const av = a[pOrder.field] ?? ''
          const bv = b[pOrder.field] ?? ''
          const dir = pOrder.direction === 'desc' ? -1 : 1
          return av > bv ? dir : av < bv ? -dir : 0
        })
      }
      if (limit && res.length > limit) res = res.slice(0, limit)
      return res as T[]
    } catch (err) {
      console.error(`Erro ao ler do Dexie [${table}]:`, err)
      return []
    }
  }, [user?.id, table, filterStr, orderStr, limit])

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      setLoading(true)
      
      const localData = await fetchLocal()
      if (isMounted) setData(localData)

      if (user?.id && typeof window !== 'undefined' && navigator.onLine) {
        const syncKey = `${table}-${filterStr}`
        
        if (Date.now() - (globalLastFetch[syncKey] || 0) > 5000) {
          globalLastFetch[syncKey] = Date.now()
          
          try {
            const pFilters = JSON.parse(filterStr)
            const pOrder = JSON.parse(orderStr)
            let query = supabase.from(table).select('*').eq('user_id', user.id)
            Object.entries(pFilters).forEach(([k, v]) => {
              if (v !== undefined && v !== null && v !== '') query = query.eq(k, v)
            })
            if (pOrder) query = query.order(pOrder.field, { ascending: pOrder.direction !== 'desc' })
            if (limit) query = query.limit(limit)

            const { data: supData, error: supErr } = await query
            
            if (!supErr && supData) {
              const tableRef = db[table as keyof typeof db] as any
              
              for (const item of supData) {
                try {
                  await tableRef.put({ ...item, sync_status: 'synced', sync_attempts: 0, last_sync_error: null })
                } catch (e) {
                  console.warn(`Ignorando erro ao salvar no Dexie [${table}]:`, e)
                }
              }
              
              const updated = await fetchLocal()
              if (isMounted) setData(updated)

              window.dispatchEvent(new CustomEvent('dfl-db-update', { detail: table }))
            }
          } catch (e) {
            console.error(`Erro no download do Supabase [${table}]:`, e)
          }
        }
      }
      if (isMounted) setLoading(false)
    }

    init()
    return () => { isMounted = false }
  }, [user?.id, table, filterStr, orderStr, limit, fetchLocal])

  useEffect(() => {
    const handler = (e: any) => { if (e.detail === table) fetchLocal().then(setData) }
    window.addEventListener('dfl-db-update', handler)
    return () => window.removeEventListener('dfl-db-update', handler)
  }, [table, fetchLocal])

  useEffect(() => {
    if (!realtime || !user?.id || typeof window === 'undefined') return
    const channel = supabase.channel(`rt-${table}-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: table, filter: `user_id=eq.${user.id}` }, () => {
      fetchLocal().then(setData)
    }).subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtime, user?.id, table])

  const create = useCallback(async (item: Omit<T, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return
    const now = new Date().toISOString()
    const newItem: any = { ...item, id: crypto.randomUUID(), user_id: user.id, created_at: now, updated_at: now, sync_status: 'pending', sync_attempts: 0 }
    const tableRef = db[table as keyof typeof db] as any
    await tableRef.add(newItem)
    await queueOperation(table, 'create', newItem.id, newItem)
    const res = await fetchLocal(); setData(res)
  }, [user?.id, table, queueOperation, fetchLocal])

  const update = useCallback(async (id: string, updates: Partial<T>) => {
    const tableRef = db[table as keyof typeof db] as any
    const existing = await tableRef.get(id)
    if (!existing) return
    const updatedItem = { ...existing, ...updates, updated_at: new Date().toISOString(), sync_status: 'pending' }
    await tableRef.put(updatedItem)
    await queueOperation(table, 'update', id, updatedItem)
    const res = await fetchLocal(); setData(res)
  }, [table, queueOperation, fetchLocal])

  const remove = useCallback(async (id: string) => {
    const tableRef = db[table as keyof typeof db] as any
    const existing = await tableRef.get(id)
    if (!existing) return
    await tableRef.delete(id)
    await queueOperation(table, 'delete', id, { id })
    const res = await fetchLocal(); setData(res)
  }, [table, queueOperation, fetchLocal])

  return { data, loading, syncing: false, error: null, reload: async () => { const res = await fetchLocal(); setData(res) }, create, update, remove }
}
