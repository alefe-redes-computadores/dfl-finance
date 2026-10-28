/**
 * R399 — valida confirmação remota antes do ACK local.
 *
 * Sem operações no banco, chamadas de rede ou mutações.
 */

export type AtomicAckItem = {
  table: string
  record_id: string
  operation: string
}

export type AtomicAckEnvelope = {
  id: string
  items: readonly AtomicAckItem[]
}

export function validateAtomicAck(
  envelope: AtomicAckEnvelope,
  response: {
    batch_id?: unknown
    status?: unknown
    versions?: unknown
    accounts?: unknown
  } | null | undefined
): void {
  if (
    !response ||
    response.batch_id !== envelope.id ||
    response.status !== 'committed'
  ) {
    throw new Error(
      'Confirmação remota não corresponde ao lote.'
    )
  }

  const versions = response.versions
  const accounts = response.accounts

  if (
    !versions ||
    typeof versions !== 'object' ||
    Array.isArray(versions)
  ) {
    throw new Error(
      'Confirmação remota sem versões verificáveis.'
    )
  }

  const versionMap =
    versions as Record<string, unknown>

  const accountMap =
    accounts &&
    typeof accounts === 'object' &&
    !Array.isArray(accounts)
      ? accounts as Record<string, unknown>
      : {}

  const seen = new Set<string>()

  for (const item of envelope.items) {
    const key = `${item.table}/${item.record_id}`

    if (seen.has(key)) {
      throw new Error(
        'Lote contém registro duplicado.'
      )
    }
    seen.add(key)

    if (
      !Object.prototype.hasOwnProperty.call(
        versionMap, key
      )
    ) {
      throw new Error(
        'Confirmação remota incompleta.'
      )
    }

    const version = versionMap[key]

    if (
      version !== null &&
      (typeof version !== 'string' ||
        version.length === 0)
    ) {
      throw new Error(
        'Versão remota inválida.'
      )
    }

    if (
      item.table === 'accounts' &&
      item.operation !== 'delete'
    ) {
      const account = accountMap[item.record_id]

      if (
        !account ||
        typeof account !== 'object' ||
        Array.isArray(account)
      ) {
        throw new Error(
          'Conta sem confirmação remota.'
        )
      }

      const balance =
        (account as { balance?: unknown }).balance

      if (
        balance === null ||
        balance === undefined ||
        balance === '' ||
        !Number.isFinite(Number(balance))
      ) {
        throw new Error(
          'Saldo remoto não verificável.'
        )
      }
    }
  }
}
