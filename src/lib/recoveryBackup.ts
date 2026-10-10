import { db } from '@/lib/db'
export const RECOVERY_BACKUP_VERSION = 2
const TABLES = ['transactions','accounts','categories','debts','loans','financings','subscriptions','tags','contacts','budgets','goals','credit_cards','credit_invoices'] as const
export interface RecoveryBackup {
  format: 'dfl-finance-recovery'; version: number; exported_at: string; user_id: string
  context: 'dfl' | 'personal'; scope?: 'user'; tables: Record<string, any[]>; counts: Record<string, number>
  syncQueue?: any[]; financialOutbox?: any[]
}
/** A consistent snapshot of BOTH contexts: cross-context transfers must not lose a leg. */
export async function createRecoveryBackup(userId: string, context: 'dfl' | 'personal'): Promise<RecoveryBackup> {
  if (!userId) throw new Error('Sessão indisponível.')
  return db.transaction('r', [...TABLES.map(name => db.table(name)), db.syncQueue, db.financialOutbox], async () => {
    const tables: Record<string, any[]> = {}, counts: Record<string, number> = {}
    for (const name of TABLES) {
      tables[name] = await db.table(name).where('user_id').equals(userId).toArray()
      counts[name] = tables[name].length
    }
    const syncQueue = await db.syncQueue.where('user_id').equals(userId).toArray()
    const outbox = await db.financialOutbox.get(userId)
    return { format: 'dfl-finance-recovery', version: RECOVERY_BACKUP_VERSION,
      exported_at: new Date().toISOString(), user_id: userId, context, scope: 'user',
      tables, counts, syncQueue, financialOutbox: outbox ? [outbox] : [] }
  })
}
export function validateRecoveryBackup(value: unknown, userId: string, context: 'dfl' | 'personal') {
  const backup = value as RecoveryBackup
  if (!backup || backup.format !== 'dfl-finance-recovery' || ![1,2].includes(backup.version)) throw new Error('Backup incompatível.')
  if (backup.user_id !== userId) throw new Error('Este backup pertence a outro usuário.')
  if (backup.version === 1 && backup.context !== context) throw new Error('Este backup pertence a outro contexto.')
  if (backup.version === 2 && backup.scope !== 'user') throw new Error('Escopo do backup inválido.')
  for (const name of TABLES) {
    if (!Array.isArray(backup.tables?.[name])) throw new Error(`Backup inválido: ${name}.`)
    const ids = new Set<string>()
    for (const row of backup.tables[name]) {
      if (!row?.id || typeof row.id !== 'string' || row.user_id !== userId ||
        !['dfl','personal'].includes(row.context) || (backup.version === 1 && row.context !== context) || ids.has(row.id)) {
        throw new Error(`Registro inválido em ${name}.`)
      }
      ids.add(row.id)
    }
  }
  if (backup.version === 2) {
    for (const list of [backup.syncQueue, backup.financialOutbox]) {
      if (!Array.isArray(list) || list.some(row => row?.user_id !== userId)) throw new Error('Fila de recuperação inválida.')
    }
  }
  return backup
}
export function downloadRecoveryBackup(backup: RecoveryBackup, prefix = 'dfl-finance-backup') {
  if (typeof window === 'undefined') return
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = `${prefix}-${backup.version === 2 ? 'completo' : backup.context}-${backup.exported_at.slice(0,19).replace(/[:T]/g,'-')}.json`
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
}
/** Importing an old balance is not a financial operation and cannot be safely reenqueued. */
export async function restoreRecoveryBackup(raw: unknown, userId: string, context: 'dfl' | 'personal'): Promise<{ restored: number; exportedAt: string }> {
  validateRecoveryBackup(raw, userId, context)
  throw new Error('Restauração automática bloqueada: um snapshot não pode sobrescrever saldo e fila. Preserve o backup para recuperação assistida.')
}
