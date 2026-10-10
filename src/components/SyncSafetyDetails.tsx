'use client'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { syncFailurePresentation } from '@/lib/syncSafetyPresentation'
import Link from 'next/link'

/** Mounted only in the status modal. IndexedDB only; no remote polling. */
export default function SyncSafetyDetails() {
  const { user } = useAuth()
  const data = useLiveQuery(async () => {
    if (!user?.id) return null
    const [queue, outbox] = await Promise.all([
      db.syncQueue.where('user_id').equals(user.id).toArray(), db.financialOutbox.get(user.id),
    ])
    const errors = Array.from(new Set(queue.map(item => syncFailurePresentation(item.last_error)?.message).filter(Boolean)))
    return { pending: queue.length, outbox: Boolean(outbox), errors }
  }, [user?.id])
  if (!data) return null
  return <div className="mb-4 space-y-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
    {data.outbox && <p>Existe um lote preservado aguardando confirmação. Repetir a sincronização reutiliza sua identidade.</p>}
    {data.errors.map(message => <p key={message} role="status" className="rounded-xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{message}</p>)}
    {(data.pending > 0 || data.outbox) && <Link href="/data-safety" className="inline-flex min-h-11 items-center font-semibold text-teal-700 dark:text-teal-400">Preservar backup dos dados locais</Link>}
  </div>
}
