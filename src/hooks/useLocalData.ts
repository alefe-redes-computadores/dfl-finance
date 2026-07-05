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

// 🛡️ CACHE GLOBAL: Impede que múltiplos componentes peçam a mesma coisa ao mesmo tempo
const globalSyncLocks: Record<string, boolean> = {}
const globalLastSync: Record<string, number> = {}

export function useLocalData<T>({ table, filters = {}, orderBy, limit, realtime = true }: UseLocalDataOptions) {
  const { user } = useAuth()
  const { queueOperation } = useLocalSync()
  
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterString = JSON.stringify(filters || {})
  const orderString = JSON.stringify(orderBy || null)

  const dataStringRef = useRef('[]')

  // Puxa do Dexie instantaneamente
  const getLocalData = useCallback(async () => {
    if (!user?.id) return []
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
  }, [user?.id, table, filterString, orderString, limit])

  // Atualiza só a tela local sem gastar internet
  const reloadLocalOnly = useCallback(async () => {
    const localRes = await getLocalData()
    const localStr = JSON.stringify(localRes)
    if (dataStringRef.current !== localStr) {
      dataStringRef.current = localStr
      setData(localRes)
    }
    setLoading(false)
  }, [getLocalData])

  const reload = useCallback(async () => {
    if (!user?.id) return
    
    await reloadLocalOnly()

    const syncKey = `${table}-${filterString}`
    
    // SISTEMA DE GUICHÊ: Só passa um componente por vez para a internet!
    if (navigator.onLine) {
      if (globalSyncLocks[syncKey]) return // Outro componente já está na internet, espere
      if (Date.now() - (globalLastSync[syncKey] || 0) < 5000) return // Cooldown anti-spam de 5s
      
      globalSyncLocks[syncKey] = true
      setSyncing(true)

      try {
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

          globalLastSync[syncKey] = Date.now()
          await reloadLocalOnly()

          // Grita para os outros componentes da tela atualizarem usando os dados já salvos
          window.dispatchEvent(new CustomEvent('dfl-sync-complete', { detail: { table } }))
        }
      } catch (err: any) {
        console.error(`Erro no useLocalData [${table}]:`, err)
        setError(err.message)
      } finally {
        globalSyncLocks[syncKey] = false
        setSyncing(false)
      }
    }
  }, [user?.id, table, filterString, orderString, limit, getLocalData, reloadLocalOnly])

  // Toca o carregamento na entrada
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filterString, orderString])

  // Escuta os outros componentes atualizarem e só pega a carona
  useEffect(() => {
    const handleSync = (e: any) => { if (e.detail.table === table) reloadLocalOnly() }
    window.addEventListener('dfl-sync-complete', handleSync)
    return () => window.removeEventListener('dfl-sync-complete', handleSync)
  }, [table, reloadLocalOnly])

  // Realtime seguro (Uma conexão por tabela)
  useEffect(() => {
    if (!realtime || !user?.id) return
    const channelName = `rt-${table}-${user.id}`
    const channel = supabase.channel(channelName).on('postgres_changes', { event: '*', schema: 'public', table: table, filter: `user_id=eq.${user.id}` }, () => {
      reload()
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
