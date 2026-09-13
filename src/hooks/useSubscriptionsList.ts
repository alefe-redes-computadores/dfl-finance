// src/hooks/useSubscriptionsList.ts
'use client'

import {
  useLiveQuery,
} from 'dexie-react-hooks'
import {
  db,
} from '@/lib/db'
import {
  useAuth,
} from '@/lib/hooks/useAuth'

type SubscriptionContext =
  | 'dfl'
  | 'personal'

type SubscriptionStatus =
  | 'active'
  | 'paused'
  | 'cancelled'

export function useSubscriptionsList(
  context?: SubscriptionContext,
  status?: SubscriptionStatus
) {
  const {
    user,
  } = useAuth()

  const data =
    useLiveQuery(
      async () => {
        if (!user?.id) {
          return []
        }

        /*
         * Quando há contexto usamos o índice composto já
         * existente no Dexie v6. Isso evita carregar todas
         * as assinaturas do usuário para depois filtrar.
         */
        let items =
          context
            ? await db.subscriptions
                .where(
                  '[user_id+context]'
                )
                .equals([
                  user.id,
                  context,
                ])
                .toArray()
            : await db.subscriptions
                .where('user_id')
                .equals(user.id)
                .toArray()

        if (status) {
          items =
            items.filter(
              (item) =>
                item.status ===
                status
            )
        }

        return items.sort(
          (a, b) => {
            const aTime =
              a.updated_at
                ? Date.parse(
                    a.updated_at
                  )
                : 0

            const bTime =
              b.updated_at
                ? Date.parse(
                    b.updated_at
                  )
                : 0

            return (
              (Number.isFinite(
                bTime
              )
                ? bTime
                : 0) -
              (Number.isFinite(
                aTime
              )
                ? aTime
                : 0)
            )
          }
        )
      },
      [
        user?.id,
        context,
        status,
      ]
    )

  return {
    data: data ?? [],
    loading:
      data === undefined,
  }
}
