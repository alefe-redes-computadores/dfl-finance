// src/components/admin/AdminSyncDiagnostics.tsx
'use client'

// ============================================================
// AdminSyncDiagnostics — Painel de diagnóstico de sincronização
// ============================================================
// Uso: importar e renderizar dentro da AdminSyncPage, junto com
// AdminStatus, SyncQueueTable, etc.
//
// import { AdminSyncDiagnostics } from '@/components/admin/AdminSyncDiagnostics'
// ...
// <AdminSyncDiagnostics />
//
// O que ele faz:
// - Compara, tabela por tabela, quantos registros existem no Dexie
//   (local) x no Supabase (remoto) para o usuário logado.
// - Detecta erros de schema (coluna faltando, ex: updated_at) e
//   erros de RLS (permissão negada) automaticamente.
// - Mostra o valor de lastPull salvo, útil pra saber se o pull
//   está "preso" numa data antiga.
// - Botão de ressincronização completa (limpa lastPull + repuxa tudo).
// ============================================================

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useLocalSync } from '@/hooks/useLocalSync'
import { SYNC_TABLES, type SyncTableName } from '@/lib/syncEngine'
import { RefreshCw, AlertTriangle, CheckCircle2, ShieldAlert, Zap } from 'lucide-react'

// A lista vem da mesma boundary usada pelo motor de pull para evitar
// divergência entre o diagnóstico e as tabelas realmente sincronizadas.
const TABLES = SYNC_TABLES

type TableName = SyncTableName

interface TableDiag {
  table: TableName
  localCount: number
  remoteCount: number | null
  remoteError: string | null
}

interface TransactionInspection {
  id: string
  context: string
  type: string
  amount: number
  description: string
  date: string
  status: string
  affects_balance: boolean | null
  account_id: string | null
  account_name: string | null
  category_id: string | null
  category_name: string | null
  credit_card_id: string | null
  debt_id: string | null
  goal_id: string | null
  recurring_group_id: string | null
  installment_index: number | null
  total_installments: number | null
  due_date: string | null
  paid: boolean | null
  paid_date: string | null
  created_at: string
  updated_at: string
  sync_status: string
}

interface TransactionDiff {
  localOnly: string[]
  remoteOnly: string[]
  localOnlyDetails: TransactionInspection[]
}

function Row({ label, value, ok }: { label: string; value: any; ok?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-gray-100 py-1.5 last:border-b-0 dark:border-slate-700/50">
      <span className="shrink-0 text-[12px] text-gray-500 dark:text-gray-400">{label}</span>
      <span
        className={`text-[12px] font-mono text-right ${
          ok === true
            ? 'text-emerald-600 dark:text-emerald-400'
            : ok === false
            ? 'text-red-500'
            : 'text-gray-800 dark:text-gray-200'
        }`}
      >
        {String(value)}
      </span>
    </div>
  )
}

export function AdminSyncDiagnostics() {
  const { user } = useAuth()
  const { isOnline, pendingCount, syncStatus, forceFullResync } = useLocalSync()

  const [diags, setDiags] = useState<TableDiag[]>([])
  const [loading, setLoading] = useState(false)
  const [resyncMsg, setResyncMsg] = useState<string>('')
  const [lastPullValue, setLastPullValue] = useState<string>('(vazio)')
  const [sessionUserId, setSessionUserId] = useState<string>('(carregando...)')
  const [transactionDiff, setTransactionDiff] =
    useState<TransactionDiff | null>(null)
  const [transactionDiffError, setTransactionDiffError] =
    useState<string | null>(null)

  const loadDiagnostics = async () => {
    setLoading(true)
    setTransactionDiff(null)
    setTransactionDiffError(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData?.session?.user?.id || user?.id
    setSessionUserId(uid || '(sem sessão)')

    if (uid && typeof window !== 'undefined') {
      setLastPullValue(localStorage.getItem(`dfl_last_pull_${uid}`) || '(nunca rodou / vazio)')
    }

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

      results.push({ table, localCount, remoteCount, remoteError })
    }

    const transactionDiag =
      results.find(
        (item) =>
          item.table ===
          'transactions'
      )

    if (
      transactionDiag &&
      transactionDiag.remoteError ===
        null &&
      transactionDiag.remoteCount !==
        null &&
      transactionDiag.remoteCount !==
        transactionDiag.localCount
    ) {
      try {
        const localRows =
          await db.transactions
            .where('user_id')
            .equals(uid)
            .toArray()

        const localIds =
          new Set(
            localRows
              .map((item: any) =>
                item?.id
              )
              .filter(
                (id: any): id is string =>
                  typeof id === 'string' &&
                  id.length > 0
              )
          )

        const {
          data: remoteRows,
          error: remoteIdsError,
        } =
          await supabase
            .from('transactions')
            .select('id')
            .eq('user_id', uid)

        if (remoteIdsError) {
          throw remoteIdsError
        }

        const remoteIds =
          new Set(
            (remoteRows || [])
              .map((item: any) =>
                item?.id
              )
              .filter(
                (id: any): id is string =>
                  typeof id === 'string' &&
                  id.length > 0
              )
          )

        const localOnly = Array.from(localIds).filter((id) => !remoteIds.has(id))
        const remoteOnly = Array.from(remoteIds).filter((id) => !localIds.has(id))
        const localOnlyRows = localRows.filter((item: any) => localOnly.includes(item.id))

        const accountIds = Array.from(new Set(localOnlyRows.map((item: any) => item.account_id).filter(Boolean)))
        const categoryIds = Array.from(new Set(localOnlyRows.map((item: any) => item.category_id).filter(Boolean)))
        const accounts = accountIds.length > 0 ? await db.accounts.bulkGet(accountIds) : []
        const categories = categoryIds.length > 0 ? await db.categories.bulkGet(categoryIds) : []
        const accountNames = new Map(accounts.filter(Boolean).map((item: any) => [item.id, item.name]))
        const categoryNames = new Map(categories.filter(Boolean).map((item: any) => [item.id, item.name]))

        const localOnlyDetails: TransactionInspection[] = localOnlyRows.map((item: any) => ({
          id: item.id,
          context: item.context,
          type: item.type,
          amount: Number(item.amount || 0),
          description: item.description || '(sem descrição)',
          date: item.date || '',
          status: item.status || '',
          affects_balance: typeof item.affects_balance === 'boolean' ? item.affects_balance : null,
          account_id: item.account_id || null,
          account_name: item.account_id ? accountNames.get(item.account_id) || null : null,
          category_id: item.category_id || null,
          category_name: item.category_id ? categoryNames.get(item.category_id) || null : null,
          credit_card_id: item.credit_card_id || null,
          debt_id: item.debt_id || null,
          goal_id: item.goal_id || null,
          recurring_group_id: item.recurring_group_id || null,
          installment_index: typeof item.installment_index === 'number' ? item.installment_index : null,
          total_installments: typeof item.total_installments === 'number' ? item.total_installments : null,
          due_date: item.due_date || null,
          paid: typeof item.paid === 'boolean' ? item.paid : null,
          paid_date: item.paid_date || null,
          created_at: item.created_at || '',
          updated_at: item.updated_at || '',
          sync_status: item.sync_status || '',
        }))

        setTransactionDiff({ localOnly, remoteOnly, localOnlyDetails })
      } catch (error: any) {
        setTransactionDiffError(
          error?.message ||
            'Falha ao comparar IDs de transactions.'
        )
      }
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

    const result = await forceFullResync()

    if (result.success) {
      setResyncMsg('Ressincronização concluída. Atualizando diagnóstico...')
    } else if (result.pendingCount > 0) {
      setResyncMsg(
        `Ressincronização parcial: ${result.pendingCount} item(ns) permanecem pendentes. Atualizando diagnóstico...`
      )
    } else if (!result.pullSuccess) {
      setResyncMsg(
        result.pullFailedTables.length > 0
          ? `Ressincronização parcial: ${result.pullFailedTables.length} tabela(s) falharam no recebimento. Atualizando diagnóstico...`
          : 'Ressincronização parcial: recebimento remoto incompleto. Atualizando diagnóstico...'
      )
    } else {
      setResyncMsg(
        'Ressincronização parcial: algumas operações precisam de nova tentativa. Atualizando diagnóstico...'
      )
    }

    await loadDiagnostics()

    setResyncMsg(
      result.success
        ? 'Diagnóstico atualizado após sincronização completa.'
        : 'Diagnóstico atualizado. Ainda existem pendências de sincronização.'
    )
  }

  const schemaErrors = diags.filter((d) => d.remoteError?.includes('42703'))
  const rlsErrors = diags.filter(
    (d) => d.remoteError && (d.remoteError.toLowerCase().includes('permission') || d.remoteError.includes('42501'))
  )
  const outOfSync = diags.filter((d) => d.remoteCount !== null && d.remoteCount !== d.localCount)

  return (
    <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">
            Diagnóstico de Sincronização
          </h2>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            Compara contagens do Dexie (local) e Supabase (remoto)
          </p>
        </div>
        <button
          onClick={loadDiagnostics}
          disabled={loading}
          className="shrink-0 rounded-[14px] bg-gray-100 dark:bg-slate-700 px-3 py-2 text-[12px] font-semibold text-gray-700 dark:text-gray-200 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      <div className="mb-4 rounded-[16px] bg-gray-50 dark:bg-slate-900/50 p-3">
        <Row label="isOnline" value={isOnline} ok={isOnline} />
        <Row label="syncStatus" value={syncStatus} />
        <Row label="pendingCount (fila local)" value={pendingCount} ok={pendingCount === 0} />
        <Row label="user_id (sessão)" value={sessionUserId} />
        <Row label="lastPull salvo" value={lastPullValue} />
      </div>

      <div className="mb-4 space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
        {diags.map((d) => {
          const mismatch = d.remoteCount !== null && d.remoteCount !== d.localCount
          return (
            <div
              key={d.table}
              className={`rounded-[12px] border px-3 py-2 text-[12px] font-mono ${
                d.remoteError
                  ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10'
                  : mismatch
                  ? 'border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-900/10'
                  : 'border-gray-100 bg-gray-50 dark:border-slate-700 dark:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-gray-800 dark:text-gray-200">
                <span>{d.table}</span>
                {!d.remoteError && (
                  <span className={mismatch ? 'text-orange-600' : 'text-emerald-600 dark:text-emerald-400'}>
                    {mismatch ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                  </span>
                )}
              </div>
              {d.remoteError ? (
                <p className="mt-0.5 text-red-600 dark:text-red-400">{d.remoteError}</p>
              ) : (
                <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                  local={d.localCount} • remoto={d.remoteCount}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {(schemaErrors.length > 0 || rlsErrors.length > 0 || outOfSync.length > 0) && (
        <div className="mb-4 space-y-2 rounded-[16px] border border-orange-200 bg-orange-50 p-3 text-[12px] dark:border-orange-900/40 dark:bg-orange-900/10">
          {schemaErrors.length > 0 && (
            <p className="text-red-600 dark:text-red-400">
              <ShieldAlert size={14} className="inline mr-1" /> Erro de schema (coluna faltando) em: {schemaErrors.map((d) => d.table).join(', ')}
            </p>
          )}
          {rlsErrors.length > 0 && (
            <p className="text-red-600 dark:text-red-400">
              <ShieldAlert size={14} className="inline mr-1" /> Erro de RLS/permissão em: {rlsErrors.map((d) => d.table).join(', ')}
            </p>
          )}
          {outOfSync.length > 0 && (
            <p className="text-orange-600 dark:text-orange-400">
              <AlertTriangle size={14} className="inline mr-1" /> Divergência de contagem local x remoto: {outOfSync.map((d) => `${d.table} (${d.localCount}/${d.remoteCount})`).join(', ')}
            </p>
          )}
        </div>
      )}

      {diags.length > 0 && schemaErrors.length === 0 && rlsErrors.length === 0 && outOfSync.length === 0 && (
        <p className="mb-4 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
          As contagens local e remota coincidem nas tabelas consultadas. Isso não prova igualdade de conteúdo.
        </p>
      )}

      {(transactionDiff ||
        transactionDiffError) && (
        <div className="mb-4 rounded-[16px] border border-sky-200 bg-sky-50 p-3 dark:border-sky-900/40 dark:bg-sky-900/10">
          <p className="text-[12px] font-semibold text-sky-700 dark:text-sky-300">
            Raio-X de transactions
          </p>

          {transactionDiffError ? (
            <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">
              {transactionDiffError}
            </p>
          ) : transactionDiff ? (
            <div className="mt-2 space-y-3">
              <div>
                <p className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                  Só no Dexie: {transactionDiff.localOnly.length}
                </p>
                {transactionDiff.localOnly.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {transactionDiff.localOnlyDetails.map((item) => (
                      <div key={`local-${item.id}`} className="rounded-[12px] border border-sky-200/70 bg-white/80 p-3 dark:border-sky-900/40 dark:bg-slate-950/40">
                        <p className="break-all font-mono text-[9px] text-gray-400 dark:text-gray-500">{item.id}</p>
                        <p className="mt-2 text-[12px] font-semibold text-gray-800 dark:text-gray-100">{item.description}</p>
                        <p className="mt-1 font-mono text-[11px] text-gray-600 dark:text-gray-300">
                          R$ {item.amount.toFixed(2).replace('.', ',')} • {item.date || '(sem data)'}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
                          <span>contexto: {item.context}</span><span>tipo: {item.type}</span>
                          <span>status: {item.status}</span><span>saldo: {String(item.affects_balance)}</span>
                          <span className="col-span-2 break-words">conta: {item.account_name || item.account_id || '—'}</span>
                          <span className="col-span-2 break-words">categoria: {item.category_name || item.category_id || '—'}</span>
                          <span className="col-span-2 break-all">recorrência: {item.recurring_group_id || '—'}{item.total_installments !== null ? ` • ${item.installment_index ?? '?'} / ${item.total_installments}` : ''}</span>
                          <span className="col-span-2 break-all">cartão: {item.credit_card_id || '—'}</span>
                          <span className="col-span-2 break-all">dívida: {item.debt_id || '—'}</span>
                          <span className="col-span-2 break-all">meta: {item.goal_id || '—'}</span>
                          <span>venc.: {item.due_date || '—'}</span><span>pago: {String(item.paid)}</span>
                          <span className="col-span-2">data pgto: {item.paid_date || '—'}</span>
                          <span className="col-span-2 break-all">criado: {item.created_at || '—'}</span>
                          <span className="col-span-2 break-all">atualizado: {item.updated_at || '—'}</span>
                          <span className="col-span-2">sync local: {item.sync_status || '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] text-gray-400">
                    Nenhum ID exclusivamente local.
                  </p>
                )}
              </div>

              <div>
                <p className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                  Só no Supabase: {transactionDiff.remoteOnly.length}
                </p>
                {transactionDiff.remoteOnly.length > 0 ? (
                  <div className="mt-1 max-h-28 overflow-y-auto rounded-[10px] bg-white/70 p-2 font-mono text-[10px] text-gray-600 dark:bg-slate-950/40 dark:text-gray-300">
                    {transactionDiff.remoteOnly.map(
                      (id) => (
                        <div
                          key={`remote-${id}`}
                          className="break-all"
                        >
                          {id}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] text-gray-400">
                    Nenhum ID exclusivamente remoto.
                  </p>
                )}
              </div>

              <p className="text-[10px] leading-4 text-gray-400 dark:text-gray-500">
                Diagnóstico somente leitura. Nenhum registro é criado, removido ou alterado.
              </p>
            </div>
          ) : null}
        </div>
      )}

      <button
        onClick={handleForceResync}
        className="w-full rounded-[16px] bg-teal-600 py-3 text-[13px] font-bold text-white active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <Zap size={16} /> Forçar ressincronização completa
      </button>

      {resyncMsg && (
        <p className="mt-2 text-center text-[11px] font-medium text-teal-600 dark:text-teal-400">
          {resyncMsg}
        </p>
      )}
    </div>
  )
}
