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

export function useLocalData<T>({ table, filters = {}, orderBy, limit, realtime = true }: UseLocalDataOptions) {
  const { user } = useAuth()
  const { queueOperation } = useLocalSync()
  
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 1. Filtros estáticos: Blindagem contra o React recriar objetos ao clicar na tela
  const filterString = JSON.stringify(filters || {})
  const orderString = JSON.stringify(orderBy || null)

  const dataStringRef = useRef('[]')
  const isSyncingRef = useRef(false)

  const reload = useCallback(async () => {
    if (!user?.id) return

    // Leitura instantânea e limpa do banco offline (Dexie)
    const getLocalData = async () => {
      const collection = db[table as keyof typeof db] as any
      if (!collection) return []

      const pFilters = JSON.parse(filterString)
      const pOrder = JSON.parse(orderString)

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
    }

    try {
      // ATUALIZA A TELA (OFFLINE FIRST)
      const localRes = await getLocalData()
      const localStr = JSON.stringify(localRes)
      
      // Só gasta processador da tela se os dados REALMENTE mudaram
      if (dataStringRef.current !== localStr) {
        dataStringRef.current = localStr
        setData(localRes)
      }
      setLoading(false)

      // SINCRONIZA O SUPABASE NO FUNDO (Cadeado: Só roda se tiver internet e não estiver já rodando)
      if (navigator.onLine && !isSyncingRef.current) {
        isSyncingRef.current = true
        setSyncing(true)

        const pFilters = JSON.parse(filterString)
        const pOrder = JSON.parse(orderString)
        let query = supabase.from(table).select('*').eq('user_id', user.id)
        
        Object.entries(pFilters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') query = query.eq(k, v)
        })
        if (pOrder) query = query.order(pOrder.field, { ascending: pOrder.direction !== 'desc' })
        if (limit) query = query.limit(limit)

        const { data: supData, error: supErr } = await query
        if (supErr) throw supErr

        if (supData) {
          const tableRef = db[table as keyof typeof db] as any
          const itemsToPut = supData.map(i => ({ ...i, sync_status: 'synced', sync_attempts: 0, last_sync_error: null }))
          
          if (itemsToPut.length > 0) await tableRef.bulkPut(itemsToPut)

          const newLocal = await getLocalData()
          const localIds = newLocal.map((i: any) => i.id)
          const supIds = supData.map(i => i.id)
          
          const toRemove = localIds.filter((id: string) => !supIds.includes(id))
          if (toRemove.length > 0) await tableRef.bulkDelete(toRemove)

          const finalLocal = await getLocalData()
          const finalStr = JSON.stringify(finalLocal)
          if (dataStringRef.current !== finalStr) {
            dataStringRef.current = finalStr
            setData(finalLocal)
          }
        }
        
        isSyncingRef.current = false
        setSyncing(false)
      }
    } catch (err: any) {
      console.error(`Erro no useLocalData [${table}]:`, err)
      setError(err.message)
      isSyncingRef.current = false
      setSyncing(false)
      setLoading(false)
    }
  }, [user?.id, table, filterString, orderString, limit]) // 🛡️ Zero dependências perigosas!

  // 2. A MÁGICA: A trava do ESLint que proíbe o loop infinito ao clicar na tela
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filterString, orderString]) 

  // 3. CANAL DE REALTIME BLINDADO (Sem zumbis)
  useEffect(() => {
    if (!realtime || !user?.id) return
    
    const channelName = `rt-${table}-${user.id}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: table, filter: `user_id=eq.${user.id}` }, () => {
        reload()
      })
      .subscribe()
      
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtime, user?.id, table])

  // CRUD OTIMIZADO
  const create = useCallback(async (item: Omit<T, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return
    const now = new Date().toISOString()
    const newItem: any = { ...item, id: crypto.randomUUID(), user_id: user.id, created_at: now, updated_at: now, sync_status: 'pending', sync_attempts: 0 }
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

  return { data, loading, syncing, error, reload, create, update, remove }
}
