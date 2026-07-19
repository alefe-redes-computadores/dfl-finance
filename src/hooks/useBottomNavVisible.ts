'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'

// ============================================================
// useBottomNavVisible
// ============================================================
// Fonte única de verdade sobre quando o BottomNav deve aparecer.
// Usado tanto pelo <BottomNav /> (pra decidir se renderiza) quanto
// pelo <AppLayout /> (pra decidir se aplica o padding-bottom pb-20
// reservado pro nav). Assim os dois nunca ficam dessincronizados.
// ============================================================

const VISIBLE_ROUTES = ['/home', '/transactions', '/analysis', '/more']

// Sub-rotas de /transactions (ou de qualquer rota "visível") que têm seu
// PRÓPRIO botão fixo de ação (salvar transação, salvar edição, lançar
// cartão) e por isso não devem mostrar o BottomNav por cima.
const HIDDEN_SUBROUTES = [
  '/transactions/new',
  '/transactions/edit',
  '/transactions/card-expense',
]

function matchesPath(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`) || pathname.startsWith(`${route}?`)
}

export function useBottomNavVisible() {
  const pathname = usePathname() || ''

  return useMemo(() => {
    const matchesVisibleRoute = VISIBLE_ROUTES.some((r) => matchesPath(pathname, r))
    if (!matchesVisibleRoute) return false

    const matchesHiddenSubroute = HIDDEN_SUBROUTES.some((r) => matchesPath(pathname, r))
    return !matchesHiddenSubroute
  }, [pathname])
}
