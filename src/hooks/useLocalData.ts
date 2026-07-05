'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useLocalSync } from './useLocalSync'

// ... (tipagens iguais às anteriores)

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

  const getLocalData = useCallback(async () => {
    if (!user?.id) return []
    const collection = db[table as keyof typeof db] as any
    if (!collection) return []
    const pFilters = JSON.parse(filterString)
    const pOrder = JSON.parse(orderString)
    let q = collection.where('user_id').equals(user.id)
    Object.entries(pFilters).forEach(([k, v]) => { if (v) q = q.and((item: any) => item[k] === v) })
    let res = await q.toArray()
    if (pOrder) {
      res = res.sort((a: any, b: any) => {
        const av = a[pOrder.field] ?? ''; const bv = b[pOrder.field] ?? ''; const dir = pOrder.direction === 'desc' ? -1 : 1
        return av > bv ? dir : av < bv ? -dir : 0
      })
    }
    return res as T[]
  }, [user?.id, table, filterString, orderString, limit])

  const syncWithSupabase = useCallback(async () => {
    if (!user?.id || !navigator.onLine) return
    setSyncing(true)

    try {
      const pFilters = JSON.parse(filterString)
      let query = supabase.from(table).select('*').eq('user_id', user.id)
      Object.entries(pFilters).forEach(([k, v]) => { if (v) query = query.eq(k, v) })

      const { data: supData, error: supErr } = await query
      if (supErr) throw supErr

      if (supData) {
        const tableRef = db[table as keyof typeof db] as any
        
        // MODO DETETIVE: Tenta salvar um por um para identificar o erro
        for (const item of supData) {
          try {
            await tableRef.put({
              ...item,
              sync_status: 'synced',
              sync_attempts: 0
            })
          } catch (putErr) {
            console.error(`❌ ERRO CRÍTICO AO SALVAR ${table}:`, item, putErr)
          }
        }
      }
    } catch (err: any) {
      console.error(`Erro na sincronização de ${table}:`, err)
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }, [user?.id, table, filterString])

  const reload = useCallback(async () => {
    if (!user?.id) return
    const localRes = await getLocalData()
    setData(localRes)
    if (navigator.onLine) {
        await syncWithSupabase()
        const refreshed = await getLocalData()
        setData(refreshed)
    }
    setLoading(false)
  }, [getLocalData, syncWithSupabase, user?.id])

  useEffect(() => { reload() }, [reload])
  
  // (Mantenha as funções create, update, remove e useEffect do Realtime como estavam antes)
  // ...
  
  return { data, loading, syncing, error, reload }
}
