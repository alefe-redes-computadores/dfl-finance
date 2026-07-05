'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useLocalSync } from './useLocalSync'

type AllTables = 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications'

export function useLocalData<T>({ table, filters = {}, limit }: { table: AllTables, filters?: any, limit?: number }) {
  const { user } = useAuth()
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const lock = useRef(false)

  const fetchData = useCallback(async () => {
    if (!user?.id) return
    const collection = db.table(table)
    let q = collection.where('user_id').equals(user.id)
    
    // Aplica filtros simples
    Object.entries(filters).forEach(([k, v]) => { if (v) q = q.and((i: any) => i[k] === v) })
    
    const res = await q.toArray()
    setData(res)
    setLoading(false)
  }, [user?.id, table, JSON.stringify(filters)])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Sincronização passiva (apenas 1 vez por carregamento)
  useEffect(() => {
    if (!user?.id || lock.current || !navigator.onLine) return
    lock.current = true
    
    async function sync() {
      const { data: remoteData } = await supabase.from(table).select('*').eq('user_id', user.id)
      if (remoteData) {
        const tableRef = db.table(table)
        await tableRef.bulkPut(remoteData.map(r => ({...r, sync_status: 'synced'})))
        fetchData()
      }
      lock.current = false
    }
    sync()
  }, [user?.id, table])

  return { data, loading, reload: fetchData }
}
