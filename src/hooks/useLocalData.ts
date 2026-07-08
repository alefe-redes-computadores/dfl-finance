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

  // 🔥 A MÁGICA DO FLICKER: Começa como null em vez de array vazio
  const [data, setData] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // 🔥 Contador que força o useEffect do liveQuery a rodar de novo
  // quando reload() é chamado manualmente.
  const [reloadTick, setReloadTick] = useState(0)

  const lock = useRef(false)
  const filtersKey = JSON.stringify(filters)

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

      // Aplica filtros
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q = q.and((i: any) => i[k] === v)
        }
      })

      let res = await q.toArray()

      // Ordenação em memória
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
        setData(result || []) // Alimenta os dados reais
        setLoading(false) // Libera a tela
      },
      error: (err) => {
        console.error(`Erro no liveQuery da tabela ${table}:`, err)
        setData([]) // Em caso de erro, devolve vazio para não quebrar a tela
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
    // 🔥 reloadTick entra nas dependências: incrementar ele força o Dexie
    // a reabrir a subscription e reler o IndexedDB do zero.
  }, [user?.id, table, filtersKey, limit, orderBy, orderDir, reloadTick])

  // ============================================================
  // 🔥 2. SINCRONIZAÇÃO COM A NUVEM (PULL)
  //
  // BUG DO "EFEITO REBOTE" — CORRIGIDO
  //
  // Antes: o bulkPut sobrescrevia TODO registro local com o que
  // vinha do Supabase, incondicionalmente — mesmo que o registro
  // local tivesse uma edição feita pelo usuário ainda não
  // confirmada no servidor (sync_status: 'pending' ou 'failed').
  //
  // Isso cria uma corrida: você edita uma categoria -> grava local
  // como 'pending' -> ANTES do push (useOfflineQueue) confirmar no
  // Supabase, algum componente remonta -> este pull dispara -> traz
  // a versão AINDA ANTIGA do servidor -> bulkPut sobrescreve sua
  // edição local -> zumbi "renasce".
  //
  // Agora: antes do bulkPut, buscamos localmente quais IDs dessa
  // tabela estão com sync_status 'pending' ou 'failed' (ou seja,
  // têm uma escrita local que ainda não foi confirmada como
  // sincronizada) e excluímos esses IDs do que vem do servidor.
  // Um registro pendente só volta a ser sobrescrito pelo pull
  // depois que o push confirmar sync_status: 'synced'.
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
          // 🔥 Descobre quais registros locais têm edição pendente
          // (ainda não confirmada no servidor) para NÃO sobrescrevê-los.
          let pendingIds = new Set<string>()
          try {
            const pendingLocal = await db.table(table)
              .where('sync_status')
              .anyOf(['pending', 'failed'])
              .primaryKeys()
            pendingIds = new Set(pendingLocal as string[])
          } catch (e) {
            // Se a tabela não tiver índice em sync_status por algum
            // motivo, cai para "sem proteção" nesse ciclo, mas não
            // quebra a sincronização.
            console.warn(`Não foi possível checar sync_status pendente em ${table}:`, e)
          }

          const safeToOverwrite = pendingIds.size > 0
            ? remoteData.filter((r: any) => !pendingIds.has(r.id))
            : remoteData

          if (safeToOverwrite.length > 0) {
            await db.table(table).bulkPut(
              safeToOverwrite.map((r: any) => ({ ...r, sync_status: 'synced' }))
            )
          }
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
  // 🔥 3. FUNÇÃO RELOAD (agora de verdade)
  // ============================================================
  const reload = useCallback(async () => {
    // Força o efeito do liveQuery a desmontar/remontar a subscription,
    // o que reabre uma leitura fresca no IndexedDB.
    setLoading(true)
    setReloadTick(t => t + 1)
    await new Promise(resolve => setTimeout(resolve, 60))
  }, [])

  // 🔥 O PULO DO GATO:
  // Se data for null, significa que o liveQuery ainda não rodou a primeira vez.
  return {
    data: data || [],
    loading: loading || data === null,
    syncing,
    reload
  }
}
