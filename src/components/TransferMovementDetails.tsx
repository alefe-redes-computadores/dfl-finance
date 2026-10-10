'use client'

import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRightLeft, Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { resolveTransferPair, transferRevision, correctTransferMovement, cancelTransferMovement, type TransferRevision } from '@/lib/transferMovementOperations'
import MoneyInput from '@/components/MoneyInput'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fieldClass = 'h-12 w-full rounded-2xl border border-gray-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white'
export default function TransferMovementDetails({ transactionId }: { transactionId: string }) {
  const { user } = useAuth(), router = useRouter(), { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState<'save' | 'cancel' | null>(null)
  const [draft, setDraft] = useState<{ groupId: string; expected: TransferRevision[]; from: string; to: string; amount: number; date: string; description: string } | null>(null)
  const data = useLiveQuery(async () => {
    if (!user?.id) return null
    const row = await db.transactions.get(transactionId)
    if (!row || row.user_id !== user.id) return { error: 'Movimento não encontrado.' }
    try {
      const rows = await db.transactions.where('user_id').equals(user.id)
        .filter(item => Boolean(row.transfer_group_id) && item.transfer_group_id === row.transfer_group_id).toArray()
      const pair = resolveTransferPair(rows)
      const accounts = await db.accounts.where('user_id').equals(user.id).toArray()
      return { pair, accounts, error: null }
    } catch (error: any) { return { error: error.message } }
  }, [transactionId, user?.id])
  useEffect(() => {
    if (!data || !('pair' in data) || !data.pair) return
    setDraft(current => current || {
      groupId: data.pair.outgoing.transfer_group_id!,
      expected: [data.pair.outgoing, data.pair.incoming].map(transferRevision),
      from: data.pair.outgoing.account_id!, to: data.pair.incoming.account_id!, amount: data.pair.outgoing.amount,
      date: data.pair.outgoing.date, description: data.pair.outgoing.description,
    })
  }, [data])
  const submit = async () => {
    if (!user?.id || !draft || !confirm || busyRef.current) return
    busyRef.current = true; setBusy(true)
    try {
      if (confirm === 'cancel') await cancelTransferMovement(user.id, draft.groupId, draft.expected)
      else await correctTransferMovement({ userId: user.id, groupId: draft.groupId, expected: draft.expected,
        fromAccountId: draft.from, toAccountId: draft.to, amount: draft.amount, date: draft.date, description: draft.description })
      success(); showToast(confirm === 'cancel' ? 'Transferência cancelada. Os saldos foram restaurados.' : 'Transferência corrigida nas duas contas.', 'success')
      router.replace('/transactions')
    } catch (error: any) { errorHaptic(); showToast(error.message || 'Não foi possível confirmar.', 'error') }
    finally { busyRef.current = false; setBusy(false); setConfirm(null) }
  }
  const accounts = data && 'accounts' in data ? data.accounts || [] : []
  const name = (id: string) => accounts.find(account => account.id === id)?.name || 'Conta indisponível'
  const choices = accounts.filter(account => !account.is_archived || account.id === draft?.from || account.id === draft?.to)
  return <main className="mx-auto min-h-[100dvh] max-w-md bg-[#f6f7f8] px-4 pb-32 pt-4 dark:bg-slate-950">
    <header className="mb-5 flex items-center gap-3"><button type="button" aria-label="Voltar para transações" onClick={() => router.replace('/transactions')} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 dark:text-white"><ArrowLeft size={20}/></button><h1 className="text-xl font-bold dark:text-white">Transferência</h1></header>
    <section className="rounded-3xl bg-white p-5 dark:bg-slate-900">
      <ArrowRightLeft className="mb-3 text-blue-500"/><p className="text-sm text-gray-500 dark:text-gray-400">Um movimento entre duas contas. A correção preserva as duas pernas e não cria receita ou despesa.</p>
      {!data ? <p className="mt-4 text-sm text-gray-400">Carregando movimento…</p> : data.error ? <p role="alert" className="mt-4 text-sm text-amber-600">{data.error}</p> : draft && <div className="mt-5 space-y-4">
        {(['from', 'to'] as const).map(key => <label key={key} className="block text-xs font-semibold text-gray-500">{key === 'from' ? 'Origem' : 'Destino'}<select disabled={busy} className={`${fieldClass} mt-1`} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })}>{choices.map(account => <option key={account.id} value={account.id}>{account.name} · {account.context === 'personal' ? 'Pessoal' : 'Empresa'}</option>)}</select></label>)}
        <label className="block text-xs font-semibold text-gray-500">Valor<MoneyInput disabled={busy} value={draft.amount} onChange={amount => setDraft({ ...draft, amount })} className={`${fieldClass} mt-1`}/></label>
        <label className="block text-xs font-semibold text-gray-500">Data<input disabled={busy} type="date" className={`${fieldClass} mt-1`} value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })}/></label>
        <label className="block text-xs font-semibold text-gray-500">Descrição<input disabled={busy} className={`${fieldClass} mt-1`} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })}/></label>
        <button type="button" disabled={busy || draft.amount <= 0 || draft.from === draft.to || !draft.date} onClick={() => setConfirm('save')} className="h-12 w-full rounded-2xl bg-teal-700 font-bold text-white disabled:opacity-50">Revisar correção</button>
        <button type="button" disabled={busy} onClick={() => setConfirm('cancel')} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 text-sm font-semibold text-red-500 disabled:opacity-50 dark:border-red-900"><Trash2 size={16}/>Cancelar movimento inteiro</button>
      </div>}
    </section>
    <ConfirmDialog open={Boolean(confirm)} busy={busy} tone={confirm === 'cancel' ? 'danger' : 'default'} title={confirm === 'cancel' ? 'Cancelar a transferência?' : 'Confirmar correção?'} description={confirm === 'cancel' ? 'As duas pernas serão removidas e o efeito original será devolvido às duas contas. A fila de sincronização preservará a exclusão até a confirmação remota.' : draft ? `${name(draft.from)} → ${name(draft.to)}: ${money(draft.amount)}. O efeito anterior será revertido e o novo aplicado nas duas contas.` : ''} confirmLabel={confirm === 'cancel' ? 'Cancelar transferência' : 'Corrigir transferência'} cancelLabel="Voltar" onCancel={() => setConfirm(null)} onConfirm={() => void submit()}/>
  </main>
}
