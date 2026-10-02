'use client'

import { useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'

type AuthSnapshot = {
  user: any | null
  loading: boolean
}

const SERVER_SNAPSHOT: AuthSnapshot = {
  user: null,
  loading: true,
}

let snapshot: AuthSnapshot = SERVER_SNAPSHOT
let initialized = false
let authSubscription: { unsubscribe: () => void } | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function setSnapshot(next: AuthSnapshot) {
  if (
    snapshot.user?.id === next.user?.id &&
    snapshot.user === next.user &&
    snapshot.loading === next.loading
  ) {
    return
  }

  snapshot = next
  emit()
}

function readCachedUser() {
  if (typeof window === 'undefined') return null

  try {
    const storageKey = Object.keys(window.localStorage).find(
      (key) => key.startsWith('sb-') && key.endsWith('-auth-token')
    )

    if (!storageKey) return null

    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    return parsed?.user ?? null
  } catch (error) {
    console.error('Erro ao ler autenticação offline:', error)
    return null
  }
}

function ensureAuthRuntime() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  const cachedUser = readCachedUser()

  /*
   * Local-first: se existe sessão persistida, liberamos a primeira pintura
   * imediatamente. O getSession abaixo confirma/atualiza a sessão sem
   * transformar rede lenta em tela de carregamento infinita.
   */
  if (cachedUser) {
    setSnapshot({
      user: cachedUser,
      loading: false,
    })
  }

  void supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      /*
       * Offline + sessão vazia não derruba uma identidade local válida.
       */
      if (!window.navigator.onLine && !session && snapshot.user) {
        if (snapshot.loading) {
          setSnapshot({ user: snapshot.user, loading: false })
        }
        return
      }

      setSnapshot({
        user: session?.user ?? cachedUser ?? null,
        loading: false,
      })
    })
    .catch((error) => {
      console.error('Falha ao restaurar sessão:', error)
      setSnapshot({
        user: snapshot.user ?? cachedUser,
        loading: false,
      })
    })

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    /*
     * Eventos vazios durante perda de rede não deslogam o usuário.
     */
    if (!window.navigator.onLine && !session && snapshot.user) {
      return
    }

    setSnapshot({
      user: session?.user ?? null,
      loading: false,
    })
  })

  authSubscription = data.subscription
}

function subscribe(listener: () => void) {
  ensureAuthRuntime()
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  ensureAuthRuntime()
  return snapshot
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT
}

export function useAuth() {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )
}

/*
 * Mantido somente para diagnóstico/testes futuros.
 * A assinatura é singleton e não é desmontada por consumidores individuais.
 */
export function getAuthRuntimeDiagnostics() {
  return {
    initialized,
    hasSubscription: Boolean(authSubscription),
    listenerCount: listeners.size,
  }
}
