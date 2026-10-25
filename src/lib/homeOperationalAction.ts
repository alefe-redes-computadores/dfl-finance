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
      reason: Number.isFinite(input.available) && input.available < 0
        ? 'Há itens para revisar e compromissos acima do saldo. Confira a Inbox primeiro.'
        : 'Existem informações que precisam de conferência'
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
    reason: Number.isFinite(input.available)
      ? 'Acompanhar compromissos futuros, sem considerá-los dinheiro disponível'
      : 'Valores operacionais indisponíveis; consulte o planejamento sem presumir saldo confirmado'
  }
}
