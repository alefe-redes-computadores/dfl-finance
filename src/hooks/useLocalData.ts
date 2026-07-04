// src/hooks/useLocalData.ts
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useLocalSync } from './useLocalSync'

interface UseLocalDataOptions {
  table: 'transactions' | 'accounts' | 'categories' | 'debts'
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

  // ============================================================
  // BUSCAR DADOS LOCALMENTE
  // ============================================================
  const fetchLocal = useCallback(async () => {
    if (!user?.id) return []

    try {
      let collection = db[table as keyof typeof db] as any

      // Aplica filtros
      let query = collection.where('user_id').equals(user.id)

      // Filtros adicionais
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.and((item: any) => item[key] === value)
        }
      })

      let results = await query.toArray() as T[]

      // Ordenação
      if (orderBy) {
        results = results.sort((a: any, b: any) => {
          const aVal = a[orderBy.field] ?? ''
          const bVal = b[orderBy.field] ?? ''
          const direction = orderBy.direction === 'desc' ? -1 : 1
          return aVal > bVal ? direction : aVal < bVal ? -direction : 0
        })
      }

      // Limite
      if (limit && results.length > limit) {
        results = results.slice(0, limit)
      }

      return results
    } catch (err) {
      console.error(`Erro ao buscar ${table} localmente:`, err)
      return []
    }
  }, [user?.id, table, filters, orderBy, limit])

  // ============================================================
  // SINCRONIZAR COM SUPABASE (BACKGROUND)
  // ============================================================
  const syncWithSupabase = useCallback(async () => {
    if (!user?.id || !isOnline) return

    setSyncing(true)

    try {
      // Busca dados do Supabase
      let query = supabase
        .from(table)
        .select('*')
        .eq('user_id', user.id)

      // Aplica filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value)
        }
      })

      // Ordenação
      if (orderBy) {
        query = query.order(orderBy.field, {
          ascending: orderBy.direction !== 'desc',
        })
      }

      // Limite
      if (limit) {
        query = query.limit(limit)
      }

      const { data: supabaseData, error: supabaseError } = await query

      if (supabaseError) throw supabaseError

      if (supabaseData && supabaseData.length > 0) {
        // Atualiza o banco local
        const tableRef = db[table as keyof typeof db] as any

        for (const item of supabaseData) {
          await tableRef.put({
            ...item,
            sync_status: 'synced',
            sync_attempts: 0,
            last_sync_error: null,
          })
        }

        // Remove itens locais que não existem mais no Supabase
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
  }, [user?.id, isOnline, table, filters, orderBy, limit, fetchLocal])

  // ============================================================
  // RECARREGAR DADOS (LOCAL + SYNC)
  // ============================================================
  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Busca dados locais (instantâneo)
      const localData = await fetchLocal()
      setData(localData)

      // 2. Sincroniza em background (se online)
      if (isOnline) {
        await syncWithSupabase()
        // 3. Busca novamente após sincronização
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
  // CRIAR/ATUALIZAR/DELETAR (USANDO FILA)
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

    // Salva localmente
    const tableRef = db[table as keyof typeof db] as any
    await tableRef.add(newItem)

    // Adiciona à fila
    await queueOperation(table, 'create', newItem.id, newItem)

    // Atualiza a lista
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
  // EFETTO INICIAL
  // ============================================================
  useEffect(() => {
    reload()
  }, [reload])

  // ============================================================
  // REALTIME (ESCUTAR MUDANÇAS NO SUPABASE)
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
          // Quando houver mudança no Supabase, recarrega os dados
          reload()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [realtime, user?.id, table, reload])

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