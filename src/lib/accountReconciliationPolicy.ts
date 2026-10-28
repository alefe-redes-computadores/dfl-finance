/**
 * R398 — Proteção de contas durante reconciliação.
 *
 * Uma conta é protegida quando possui operação local
 * pendente na fila ou integra um lote financeiro atômico
 * ainda não confirmado.
 *
 * Funções puras. Sem acesso a banco ou rede.
 */

export type ProtectedAccountEntry = {
  table: string
  record_id: string
}

export function protectedReconciliationAccountIds(
  queue: readonly ProtectedAccountEntry[],
  outboxQueue: readonly ProtectedAccountEntry[] = []
): Set<string> {
  const protectedIds = new Set<string>()

  for (const item of [...queue, ...outboxQueue]) {
    if (
      item.table === 'accounts' &&
      typeof item.record_id === 'string' &&
      item.record_id.length > 0
    ) {
      protectedIds.add(item.record_id)
    }
  }

  return protectedIds
}

export function canReconcileAccount(
  accountId: string,
  protectedIds: ReadonlySet<string>
): boolean {
  return !protectedIds.has(accountId)
}
