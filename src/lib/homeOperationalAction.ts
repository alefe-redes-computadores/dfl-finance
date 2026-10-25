// V207 — Somente recomenda destinos. Nao executa operacoes.
export function homeOperationalAction(input: {
  available: number
  reviewCount: number
  hidden: boolean
}) {
  if (input.hidden) {
    return {
      label: 'Ver contas',
      href: '/accounts',
      reason: 'Valores protegidos'
    }
  }

  if (input.reviewCount > 0) {
    return {
      label: 'Revisar Inbox',
      href: '/conciliation',
      reason: 'Existem informações que precisam de conferência'
    }
  }

  if (Number.isFinite(input.available) && input.available < 0) {
    return {
      label: 'Conferir contas',
      href: '/accounts',
      reason: 'Compromissos imediatos acima do saldo'
    }
  }

  return {
    label: 'Ver planejamento',
    href: '/planning',
    reason: 'Acompanhar compromissos futuros'
  }
}
