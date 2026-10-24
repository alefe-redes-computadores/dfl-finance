export type FinanceToastType =
  | 'success'
  | 'error'
  | 'info'
  | 'warning'

export interface FinanceToastItem {
  id: string
  message: string
  type: FinanceToastType
}

export const MAX_VISIBLE_TOASTS = 3

export function normalizeToastMessage(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function enqueueFinanceToast(
  current: FinanceToastItem[],
  incoming: FinanceToastItem
): FinanceToastItem[] {
  const message = normalizeToastMessage(incoming.message)

  if (!message) return current

  const candidate = {
    ...incoming,
    message
  }

  const distinct = current.filter(
    item => !(
      item.message === candidate.message &&
      item.type === candidate.type
    )
  )

  const combined = [...distinct, candidate]

  if (combined.length <= MAX_VISIBLE_TOASTS) {
    return combined
  }

  const retained = [...combined]

  while (retained.length > MAX_VISIBLE_TOASTS) {
    const removable = retained.findIndex(
      item => item.type === 'success' || item.type === 'info'
    )

    retained.splice(removable >= 0 ? removable : 0, 1)
  }

  // Quando um aviso informativo e descartado para preservar
  // erros e alertas, o estado visual nao mudou.
  // Reutilizar a identidade antiga evita renderizacao inutil.
  if (
    retained.length === current.length &&
    retained.every((item, index) => item === current[index])
  ) {
    return current
  }

  return retained
}
