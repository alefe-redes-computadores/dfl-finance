'use client'

// ============================================================
// TELA DE DIAGNÓSTICO DE SYNC — VERSÃO 2 (TODAS AS TABELAS)
// ============================================================
// Acesse via: seuapp.com/debug-sync
// Agora verifica local x remoto para TODAS as tabelas usadas
// no pullRemoteChanges, não só accounts.
// ============================================================

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useLocalSync } from '@/hooks/useLocalSync'

// ✅ Lista completa de tabelas que o app sincroniza.
// OBS: hoje o pullRemoteChanges só busca 'transactions', 'accounts',
// 'categories', 'credit_cards' — as demais (debts, budgets, goals, etc.)
// nunca são puxadas da nuvem automaticamente. Esta tela testa TODAS
// pra deixar isso evidente no diagnóstico.
const TABLES = [
  'transactions',
  'accounts',
  'categories',
  'debts',
  'loans',
  'financings',
  'subscriptions',
  'tags',
  'contacts',
  'budgets',
  'goals',
  'credit_cards',
  'credit_invoices',
  'notifications',
] as const

type TableName = (typeof TABLES)[number]

// Tabelas que o pullRemoteChanges atual efetivamente busca
const PULLED_TABLES: TableName[] = ['transactions', 'accounts', 'categories', 'credit_cards']

interface TableDiag {
  table: TableName
  localCount: number
  remoteCount: number | null
  remoteError: string | null
  isPulled: boolean
}

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

  const [diags, setDiags] = useState<TableDiag[]>([])
  const [loading, setLoading] = useState(false)
  const [resyncMsg, setResyncMsg] = useState<string>('')
  const [sessionUserId, setSessionUserId] = useState<string>('(carregando...)')

  const loadDiagnostics = async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData?.session?.user?.id || user?.id
    setSessionUserId(uid || '(sem sessão)')

    if (!uid) {
      setLoading(false)
      return
    }

    const results: TableDiag[] = []

    for (const table of TABLES) {
      let localCount = 0
      try {
        localCount = await db.table(table).where('user_id').equals(uid).count()
      } catch (e) {
        // tabela pode não existir no Dexie local ainda
        localCount = -1
      }

      let remoteCount: number | null = null
      let remoteError: string | null = null
      try {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)

        if (error) {
          remoteError = `[${error.code}] ${error.message}`
        } else {
          remoteCount = count ?? 0
        }
      } catch (e: any) {
        remoteError = e.message
      }

      results.push({
        table,
        localCount,
        remoteCount,
        remoteError,
        isPulled: PULLED_TABLES.includes(table),
      })
    }

    setDiags(results)
    setLoading(false)
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

  const tablesWithSchemaError = diags.filter((d) => d.remoteError?.includes('42703'))
  const tablesWithRLSError = diags.filter(
    (d) => d.remoteError && (d.remoteError.toLowerCase().includes('permission') || d.remoteError.includes('42501'))
  )
  const tablesNotPulled = diags.filter((d) => !d.isPulled && (d.remoteCount || 0) > 0)
  const tablesOutOfSync = diags.filter(
    (d) => d.isPulled && d.remoteCount !== null && d.remoteCount !== d.localCount
  )

  return (
    <div className="min-h-screen bg-[#f6f7f8] px-4 py-6 dark:bg-slate-950">
      <h1 className="mb-1 text-[22px] font-bold text-gray-900 dark:text-gray-100">
        🔍 Diagnóstico de Sync — Todas as tabelas
      </h1>
      <p className="mb-5 text-[12px] text-gray-500 dark:text-gray-400">
        user_id: {sessionUserId}
      </p>

      <Section title="Conexão">
        <Row label="isOnline" value={isOnline} ok={isOnline} />
        <Row label="syncStatus" value={syncStatus} />
        <Row label="pendingCount" value={pendingCount} />
      </Section>

      <Section title="Comparação por tabela (local x remoto)">
        <div className="space-y-2">
          {diags.map((d) => {
            const mismatch = d.remoteCount !== null && d.remoteCount !== d.localCount
            return (
              <div
                key={d.table}
                className={`rounded-lg border p-2 ${
                  d.remoteError
                    ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10'
                    : mismatch
                    ? 'border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-900/10'
                    : 'border-gray-100 bg-gray-50 dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{d.table}</span>
                  <span className="text-[10px] opacity-60">
                    {d.isPulled ? 'puxada pelo sync' : 'NÃO puxada pelo sync'}
                  </span>
                </div>
                {d.remoteError ? (
                  <p className="mt-1 text-red-600 dark:text-red-400">{d.remoteError}</p>
                ) : (
                  <p className="mt-1">
                    local={d.localCount} • remoto={d.remoteCount}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Resumo automático">
        <div className="space-y-2">
          {tablesWithSchemaError.length > 0 && (
            <p className="text-red-500">
              🚫 Erro de schema (coluna faltando) em: {tablesWithSchemaError.map((d) => d.table).join(', ')}.
              Precisa adicionar a coluna que falta nessas tabelas.
            </p>
          )}

          {tablesWithRLSError.length > 0 && (
            <p className="text-red-500">
              🚫 Erro de permissão (RLS) em: {tablesWithRLSError.map((d) => d.table).join(', ')}.
              A policy de SELECT dessas tabelas está bloqueando o próprio dono dos dados.
            </p>
          )}

          {tablesNotPulled.length > 0 && (
            <p className="text-orange-600">
              ⚠️ Estas tabelas têm dados no Supabase mas o pullRemoteChanges NUNCA as busca (não
              estão na lista tablesToPull do useLocalSync): {tablesNotPulled.map((d) => d.table).join(', ')}.
              Isso é esperado até ampliarmos a lista — é código, não é bug de banco.
            </p>
          )}

          {tablesOutOfSync.length > 0 && (
            <p className="text-orange-600">
              ⚠️ Divergência local x remoto em tabelas que deveriam sincronizar:{' '}
              {tablesOutOfSync.map((d) => `${d.table} (local=${d.localCount}, remoto=${d.remoteCount})`).join(', ')}
            </p>
          )}

          {tablesWithSchemaError.length === 0 &&
            tablesWithRLSError.length === 0 &&
            tablesOutOfSync.length === 0 &&
            diags.length > 0 && (
              <p className="text-emerald-600">
                ✅ Nenhum erro de schema/RLS, e as tabelas puxadas pelo sync estão batendo.
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
          ⚡ Forçar ressync completo
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
