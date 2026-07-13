// src/hooks/useLocalSync.ts
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db, addToSyncQueue, getPendingSyncItems, removeFromSyncQueue, markSyncFailed } from '@/lib/db'
import { useToast } from '@/contexts/ToastContext'
// 🔥 IMPORTANDO O HOOK DE ADMIN
import { useIsAdmin } from '@/hooks/useAdmin'

type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline'

type AllTables = 
  | 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' 
  | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' 
  | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications'

export function useLocalSync() {
  const { user } = useAuth()
  const { showToast } = useToast()
  // 🔥 BUSCA O STATUS DE ADMIN DO USUÁRIO
  const { isAdmin } = useIsAdmin()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingCount, setPendingCount] = useState(0)
  const isSyncing = useRef(false)

  // 🔥 GERADOR DE LOG DIRETO NA TELA DO CELULAR (APENAS PARA ADMIN)
  const renderLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    // 🔥 SEGURANÇA: SE NÃO FOR ADMIN, NÃO INJETA A CAIXINHA
    if (!isAdmin) return
    if (typeof window === 'undefined') return
    
    let box = document.getElementById('screen-debug-console')
    if (!box) {
      box = document.createElement('div')
      box.id = 'screen-debug-console'
      box.style.position = 'fixed'
      box.style.bottom = '85px'
      box.style.left = '12px'
      box.style.right = '12px'
      box.style.maxHeight = '160px'
      box.style.overflowY = 'auto'
      box.style.backgroundColor = 'rgba(15, 23, 42, 0.95)'
      box.style.color = '#fff'
      box.style.fontFamily = 'monospace'
      box.style.fontSize = '11px'
      box.style.padding = '10px'
      box.style.borderRadius = '14px'
      box.style.zIndex = '999999'
      box.style.border = '1px solid rgba(255,255,255,0.1)'
      box.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)'
      document.body.appendChild(box)
    }
    const line = document.createElement('div')
    line.style.marginBottom = '4px'
    line.style.color = type === 'error' ? '#f87171' : type === 'success' ? '#4ade80' : '#e2e8f0'
    line.innerText = `> ${msg}`
    box.appendChild(line)
    box.scrollTop = box.scrollHeight
  }

  const updatePendingCount = useCallback(async () => {
    if (!user?.id) return
    const items = await getPendingSyncItems(user.id)
    setPendingCount(items.length)
  }, [user?.id])

  const processSyncQueue = useCallback(async () => {
    renderLog('Iniciando processSyncQueue...', 'info')
    
    if (!user?.id) { renderLog('Cancelado: Usuário sem ID logado', 'error'); return }
    if (isSyncing.current) { renderLog('Cancelado: Já existe uma fila rodando', 'info'); return }
    if (!isOnline) { renderLog('Cancelado: Dispositivo detectado como Offline', 'error'); return }

    isSyncing.current = true
    setSyncStatus('syncing')

    try {
      renderLog('Buscando itens pendentes no Dexie...', 'info')
      const items = await getPendingSyncItems(user.id)
      renderLog(`Dexie retornou ${items.length} itens pendentes.`, 'info')

      if (items.length === 0) {
        setSyncStatus(isOnline ? 'online' : 'offline')
        isSyncing.current = false
        renderLog('Nenhum item pendente. Sincronismo concluído.', 'success')
        return
      }

      for (const item of items) {
        renderLog(`Processando ${item.operation} na tabela [${item.table}]... (tentativa ${(item.attempts || 0) + 1})`, 'info')
        
        try {
          // 🔥 CORRIGIDO: Verifica se o item já tentou mais de 3 vezes
          const attempts = item.attempts || 0
          if (attempts >= 3) {
            renderLog(`⚠️ Item ${item.id} atingiu limite de 3 tentativas. Removendo da fila para desbloquear.`, 'error')
            console.error(`⚠️ [SYNC] Item corrompido removido da fila: ${item.table}/${item.record_id} após ${attempts} tentativas.`)
            await removeFromSyncQueue(item.id)
            await updatePendingCount()
            continue
          }

          const { table, operation, record_id, data } = item
          
          let supabaseTable: string = table
          if (table === 'credit_cards') supabaseTable = 'credit_cards'
          if (table === 'credit_invoices') supabaseTable = 'credit_invoices'

          const supabaseClient = supabase.from(supabaseTable)
          let error = null

          if (operation === 'delete') {
            renderLog(`Disparando DELETE para ID: ${record_id}`, 'info')
            const res = await supabaseClient.delete().eq('id', record_id)
            error = res.error
          } else {
            renderLog(`Disparando UPSERT para ID: ${record_id} (payload contém ID: ${!!data?.id})`, 'info')
            // 🔥 CORRIGIDO: Garante que o data tenha o ID para o upsert
            const payload = data?.id ? data : { ...data, id: record_id }
            const res = await supabaseClient.upsert(payload, { onConflict: 'id' })
            error = res.error
          }

          if (error) {
            renderLog(`Erro Supabase: ${error.message} (Código: ${error.code})`, 'error')
            console.error(`❌ [SYNC] Erro no item ${item.id}: ${error.message}`, error)
            throw new Error(error.message)
          }

          renderLog(`Sucesso no ID ${record_id}. Removendo da fila local...`, 'success')
          console.log(`✅ [SYNC] Item ${item.id} sincronizado com sucesso.`)
          await removeFromSyncQueue(item.id)
          await updatePendingCount()

        } catch (err: any) {
          renderLog(`Falha no item: ${err.message}`, 'error')
          console.error(`❌ [SYNC] Falha no item ${item.id}:`, err)
          
          // 🔥 CORRIGIDO: Incrementa attempts e marca como failed
          const newAttempts = (item.attempts || 0) + 1
          await markSyncFailed(item.id, err.message)
          
          // 🔥 CORRIGIDO: Se atingiu 3 tentativas, remove da fila para não travar
          if (newAttempts >= 3) {
            renderLog(`⚠️ Item ${item.id} atingiu limite de 3 tentativas. Removendo da fila.`, 'error')
            console.error(`⚠️ [SYNC] Item removido após 3 falhas: ${item.table}/${item.record_id}`)
            await removeFromSyncQueue(item.id)
            await updatePendingCount()
          }
        }
      }

      await updatePendingCount()
      if (pendingCount === 0) setSyncStatus(isOnline ? 'online' : 'offline')

    } catch (err: any) {
      renderLog(`Erro crítico na fila: ${err?.message}`, 'error')
      console.error('❌ [SYNC] Erro crítico:', err)
    } finally {
      isSyncing.current = false
      renderLog('Ciclo de sincronização finalizado.', 'info')
    }
  }, [user?.id, isOnline, pendingCount, updatePendingCount])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setSyncStatus('online')
      renderLog('🌐 Rede detectou conexão reestabelecida.', 'success')
      processSyncQueue()
    }
    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('offline')
      renderLog('📡 Rede detectou queda de conexão.', 'error')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (isOnline) processSyncQueue()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [processSyncQueue])

  const queueOperation = useCallback(async (table: AllTables, operation: 'create' | 'update' | 'delete', recordId: string, data: any) => {
    if (!user?.id) return
    await addToSyncQueue(user.id, table, operation, recordId, data)
    await updatePendingCount()
    if (isOnline) processSyncQueue()
  }, [user?.id, isOnline, updatePendingCount, processSyncQueue])

  const forceSync = useCallback(async () => {
    renderLog('Ação manual: Forçar Sincronismo acionado.', 'info')
    if (!isOnline) {
      showToast('📡 Sem conexão.', 'warning')
      return
    }
    await processSyncQueue()
  }, [isOnline, processSyncQueue])

  const refreshPendingCount = useCallback(async () => {
    await updatePendingCount()
  }, [updatePendingCount])

  return { syncStatus, isOnline, pendingCount, isSyncing: isSyncing.current, queueOperation, forceSync, refreshPendingCount }
}