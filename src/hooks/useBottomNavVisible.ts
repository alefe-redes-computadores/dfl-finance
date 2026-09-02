'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useBottomNavOverlay } from '@/contexts/BottomNavOverlayContext'

// ============================================================
// useBottomNavVisible
// ============================================================
// Fonte única de verdade sobre quando o BottomNav deve aparecer.
// Combina duas regras:
//  1) Rota (pathname) — algumas telas têm botão de ação próprio
//     e não devem mostrar o nav por baixo.
//  2) Overlay manual — componentes como o FAB podem forçar a
//     ocultação enquanto um modal próprio estiver aberto, mesmo
//     estando numa rota "visível" (ex: /home).
// ============================================================

const VISIBLE_ROUTES = ['/home', '/transactions', '/analysis', '/more']

// ✅ CORRIGIDO (bug real encontrado): a tela de edição de transação é
// /transactions/edit (confirmado pelo router.push em TransactionItem.tsx,
// que usa ?id= como query param). A entrada antiga apontava para
// /transactions/details, rota que não existe nesse fluxo — por isso o
// nav nunca escondia.
const HIDDEN_SUBROUTES = [
  '/transactions/new',
  '/transactions/details',
  '/transactions/edit',
  '/transactions/card-expense',
]

function matchesPath(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`)
}

export function useBottomNavVisible() {
  const pathname = usePathname() || ''
  const { hidden: overlayHidden } = useBottomNavOverlay()

  return useMemo(() => {
    if (overlayHidden) return false

    const matchesVisibleRoute = VISIBLE_ROUTES.some((r) => matchesPath(pathname, r))
    if (!matchesVisibleRoute) return false

    const matchesHiddenSubroute = HIDDEN_SUBROUTES.some((r) => matchesPath(pathname, r))
    return !matchesHiddenSubroute
  }, [pathname, overlayHidden])
}