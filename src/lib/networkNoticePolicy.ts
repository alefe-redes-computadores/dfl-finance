// V183 — Estado visual de rede, sem leituras remotas.
// Uma dispensa vale somente para o estado exato dispensado.

export type NetworkNoticeKind =
  | 'offline'
  | 'pending'
  | 'syncing'

export type NetworkNotice = {
  kind: NetworkNoticeKind
  message: string
  key: string
  pendingCount: number
}

export type NetworkNoticeInput = {
  isOnline: boolean
  pendingCount: number
  isSyncing?: boolean
}

export function getNetworkNotice(
  input: NetworkNoticeInput
): NetworkNotice | null {
  const pending = Number.isFinite(input.pendingCount)
    ? Math.max(0, Math.floor(input.pendingCount))
    : 0

  // Offline prevalece sobre qualquer indicador de envio.
  if (!input.isOnline) {
    return {
      kind: 'offline',
      message: pending > 0
        ? `Sem conexão. ${pending} alteração(ões) preservada(s) neste dispositivo.`
        : 'Sem conexão. Novas alterações serão preservadas neste dispositivo.',
      key: `offline:${pending}`,
      pendingCount: pending
    }
  }

  if (input.isSyncing) {
    return {
      kind: 'syncing',
      message: pending > 0
        ? `Conferindo sincronização de ${pending} item(ns)…`
        : 'Conferindo dados com o servidor…',
      key: `syncing:${pending}`,
      pendingCount: pending
    }
  }

  if (pending > 0) {
    return {
      kind: 'pending',
      message: `${pending} alteração(ões) aguardando confirmação remota.`,
      key: `pending:${pending}`,
      pendingCount: pending
    }
  }

  // Silêncio não é prova de sincronização completa.
  // O indicador de confirmação é responsabilidade do V180.
  return null
}

export function shouldShowNetworkNotice(
  notice: NetworkNotice | null,
  dismissedKey: string | null
): boolean {
  return Boolean(notice && notice.key !== dismissedKey)
}
