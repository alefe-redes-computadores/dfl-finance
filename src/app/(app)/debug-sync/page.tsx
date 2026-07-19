'use client'

// ============================================================
// TELA DE DIAGNÓSTICO DE SYNC — SEM PRECISAR DE CONSOLE
// ============================================================
// Acesse via: seuapp.com/debug-sync
// Mostra tudo que precisamos saber direto na tela do celular:
// - navigator.onLine
// - user.id da sessão atual
// - lastPull salvo no localStorage
// - conteúdo local do Dexie (accounts, transactions, etc)
// - resultado de uma query direta ao Supabase (com erro visível, se houver)
// ============================================================

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useLocalSync } from '@/hooks/useLocalSync'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-[16px] border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400">
        {title}
      </h2>
      <div className="text-[12px] font-mono whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, ok }: { label: string; value: any; ok?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-gray-100 py-1.5 last:border-b-0 dark:border-slate-700/50">
      <span className="shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
      <span
        className={`text-right ${
          ok === true ? 'text-emerald-600 dark:text-emerald-400' : ok === false ? 'text-red-500' : ''
        }`}
      >
        {String(value)}
      </span>
    </div>
  )
}

export default function DebugSyncPage() {
  const { user } = useAuth()
  const { isOnline, pendingCount, syncStatus, forceFullResync } = useLocalSync()

  const [localAccounts, setLocalAccounts] = useState<any[]>([])
  const [localTransactionsCount, setLocalTransactionsCount] = useState<number>(0)
  const [lastPullValue, setLastPullValue] = useState<string>('(vazio)')
  const [remoteAccounts, setRemoteAccounts] = useState<any[] | null>(null)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [sessionUserId, setSessionUserId] = useState<string>('(carregando...)')
  const [loading, setLoading] = useState(false)
  const [resyncMsg, setResyncMsg] = useState<string>('')

  const loadDiagnostics = async () => {
    setLoading(true)
    setRemoteError(null)

    try {
      // 1. Sessão real do Supabase (pode ser diferente do useAuth em casos de dessincronia)
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr) {
        setSessionUserId(`ERRO: ${sessionErr.message}`)
      } else {
        setSessionUserId(sessionData?.session?.user?.id || '(sem sessão)')
      }

      const uid = sessionData?.session?.user?.id || user?.id

      // 2. lastPull salvo
      if (uid && typeof window !== 'undefined') {
        const key = `dfl_last_pull_${uid}`
        setLastPullValue(localStorage.getItem(key) || '(nunca rodou / vazio)')
      }

      // 3. Dados locais no Dexie
      if (uid) {
        const accs = await db.table('accounts').where('user_id').equals(uid).toArray()
        setLocalAccounts(accs)

        const txCount = await db.table('transactions').where('user_id').equals(uid).count()
        setLocalTransactionsCount(txCount)
      }

      // 4. Query direta ao Supabase — pra ver se o dado existe lá e se RLS deixa ler
      if (uid) {
        const { data, error } = await supabase
          .from('accounts')
          .select('id, user_id, context, name, balance, updated_at')
          .eq('user_id', uid)

        if (error) {
          setRemoteError(`[${error.code}] ${error.message}`)
        } else {
          setRemoteAccounts(data)
        }
      }
    } catch (err: any) {
      setRemoteError(`Erro inesperado: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDiagnostics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const handleForceResync = async () => {
    setResyncMsg('Ressincronizando...')
    await forceFullResync()
    setResyncMsg('Concluído! Recarregando diagnóstico...')
    await loadDiagnostics()
    setResyncMsg('✅ Diagnóstico atualizado.')
  }

  const handleClearLastPull = () => {
    const uid = sessionUserId
    if (uid && uid.startsWith('(')) return
    localStorage.removeItem(`dfl_last_pull_${uid}`)
    setResyncMsg('lastPull removido do localStorage. Toque em "Recarregar diagnóstico".')
    loadDiagnostics()
  }

  return (
    <div className="min-h-screen bg-[#f6f7f8] px-4 py-6 dark:bg-slate-950">
      <h1 className="mb-1 text-[22px] font-bold text-gray-900 dark:text-gray-100">
        🔍 Diagnóstico de Sync
      </h1>
      <p className="mb-5 text-[12px] text-gray-500 dark:text-gray-400">
        Tudo que precisamos saber, direto na tela — sem console.
      </p>

      <Section title="1. Conexão e sessão">
        <Row label="navigator.onLine (hook)" value={isOnline} ok={isOnline} />
        <Row label="syncStatus" value={syncStatus} />
        <Row label="pendingCount (fila local)" value={pendingCount} />
        <Row label="user.id (useAuth)" value={user?.id || '(nenhum)'} ok={!!user?.id} />
        <Row label="user.id (supabase.auth.getSession)" value={sessionUserId} ok={sessionUserId === user?.id} />
      </Section>

      <Section title="2. lastPull salvo no localStorage">
        <Row label="dfl_last_pull_<uid>" value={lastPullValue} />
      </Section>

      <Section title="3. Dados LOCAIS (Dexie / IndexedDB)">
        <Row label="accounts encontradas localmente" value={localAccounts.length} ok={localAccounts.length > 0} />
        <Row label="transactions encontradas localmente" value={localTransactionsCount} />
        {localAccounts.length > 0 && (
          <div className="mt-2 space-y-1">
            {localAccounts.map((a) => (
              <div key={a.id} className="rounded bg-gray-50 p-2 dark:bg-slate-900">
                {a.name} • context={String(a.context)} • saldo={a.balance} • sync_status={a.sync_status}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="4. Dados REMOTOS (query direta ao Supabase)">
        {remoteError ? (
          <Row label="ERRO" value={remoteError} ok={false} />
        ) : (
          <>
            <Row
              label="accounts encontradas no Supabase"
              value={remoteAccounts === null ? '(carregando...)' : remoteAccounts.length}
              ok={remoteAccounts !== null && remoteAccounts.length > 0}
            />
            {remoteAccounts && remoteAccounts.length > 0 && (
              <div className="mt-2 space-y-1">
                {remoteAccounts.map((a) => (
                  <div key={a.id} className="rounded bg-gray-50 p-2 dark:bg-slate-900">
                    {a.name} • context={String(a.context)} • saldo={a.balance} • updated_at={a.updated_at}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="5. Diagnóstico automático">
        <div className="space-y-1">
          {remoteAccounts !== null && remoteAccounts.length === 0 && !remoteError && (
            <p className="text-orange-600">
              ⚠️ O Supabase não retornou NENHUMA conta pra esse user_id. Ou as contas foram
              criadas com outro user_id, ou não existem mesmo.
            </p>
          )}
          {remoteError && remoteError.toLowerCase().includes('permission') && (
            <p className="text-red-500">
              🚫 Erro de permissão — quase certeza que é RLS bloqueando o SELECT na tabela accounts.
            </p>
          )}
          {remoteAccounts && remoteAccounts.length > 0 && localAccounts.length === 0 && (
            <p className="text-red-500">
              🚫 Os dados EXISTEM no Supabase mas NÃO estão no Dexie local. O pull não está
              trazendo — provavelmente o lastPull ainda está "travando" a busca, ou o pull não
              está sendo chamado. Toque em "Forçar ressync completo" abaixo.
            </p>
          )}
          {remoteAccounts && localAccounts.length > 0 && remoteAccounts.length !== localAccounts.length && (
            <p className="text-orange-600">
              ⚠️ Quantidade diferente entre remoto ({remoteAccounts.length}) e local (
              {localAccounts.length}). Sync parcial.
            </p>
          )}
          {remoteAccounts &&
            localAccounts.length > 0 &&
            remoteAccounts.length === localAccounts.length &&
            remoteAccounts.length > 0 && (
              <p className="text-emerald-600">
                ✅ Local e remoto batem. Se a tela de contas ainda está vazia, o problema é no
                filtro do useLocalData (contexto/effectiveContext) — não é mais sync.
              </p>
            )}
          {sessionUserId !== '(carregando...)' && sessionUserId !== user?.id && (
            <p className="text-red-500">
              🚫 O user.id da sessão do Supabase é DIFERENTE do user.id que o useAuth está usando
              no app. Isso sozinho já explica tudo.
            </p>
          )}
        </div>
      </Section>

      <div className="mt-6 space-y-3">
        <button
          onClick={loadDiagnostics}
          disabled={loading}
          className="w-full rounded-[16px] bg-gray-800 py-3 text-[14px] font-bold text-white active:scale-[0.98] disabled:opacity-50 dark:bg-slate-700"
        >
          {loading ? 'Carregando...' : '🔄 Recarregar diagnóstico'}
        </button>

        <button
          onClick={handleForceResync}
          className="w-full rounded-[16px] bg-teal-600 py-3 text-[14px] font-bold text-white active:scale-[0.98]"
        >
          ⚡ Forçar ressync completo (limpa lastPull + repuxa tudo)
        </button>

        <button
          onClick={handleClearLastPull}
          className="w-full rounded-[16px] border border-gray-300 bg-white py-3 text-[14px] font-bold text-gray-700 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200"
        >
          🗑️ Apenas limpar lastPull
        </button>

        {resyncMsg && (
          <p className="text-center text-[12px] font-medium text-teal-600 dark:text-teal-400">
            {resyncMsg}
          </p>
        )}
      </div>
    </div>
  )
}
