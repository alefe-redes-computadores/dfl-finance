'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NATIVE_CALLBACK_PROTOCOL = 'dfl:'
const NATIVE_CALLBACK_HOST = 'callback'

function parseNativeCallback(
  rawUrl: string,
): URL | null {
  let incomingUrl: URL

  try {
    incomingUrl = new URL(rawUrl)
  } catch {
    return null
  }

  if (
    incomingUrl.protocol !==
      NATIVE_CALLBACK_PROTOCOL ||
    incomingUrl.hostname !==
      NATIVE_CALLBACK_HOST
  ) {
    return null
  }

  return incomingUrl
}

export function useAuthDeepLink() {
  const router = useRouter()
  const [isProcessing, setIsProcessing] =
    useState(false)

  const lastProcessedUrlRef =
    useRef<string | null>(null)

  const processCallback = useCallback(
    async (rawUrl: string) => {
      const incomingUrl =
        parseNativeCallback(rawUrl)

      if (!incomingUrl) {
        return
      }

      /*
       * O Android pode entregar o mesmo deep-link por
       * getLaunchUrl() e appUrlOpen durante a inicialização.
       * O exchange PKCE não pode ser executado duas vezes.
       */
      if (
        lastProcessedUrlRef.current === rawUrl
      ) {
        return
      }

      lastProcessedUrlRef.current = rawUrl
      setIsProcessing(true)

      await Browser.close().catch(() => {})

      try {
        const code =
          incomingUrl.searchParams.get('code')

        if (code) {
          const { data, error } =
            await supabase.auth
              .exchangeCodeForSession(code)

          if (error) {
            console.error(
              'Erro no exchangeCodeForSession:',
              error.message,
            )

            setIsProcessing(false)

            router.replace(
              `/login?error=${encodeURIComponent(
                error.message,
              )}`,
            )
            return
          }

          if (data?.session) {
            setIsProcessing(false)
            router.replace('/home')
            return
          }
        }

        /*
         * Compatibilidade defensiva com callbacks antigos.
         * O fluxo oficial permanece PKCE.
         */
        const rawHash =
          incomingUrl.hash?.startsWith('#')
            ? incomingUrl.hash.substring(1)
            : incomingUrl.hash

        if (rawHash) {
          const hashParams =
            new URLSearchParams(rawHash)

          const accessToken =
            hashParams.get('access_token')

          const refreshToken =
            hashParams.get('refresh_token')

          if (accessToken && refreshToken) {
            const { data, error } =
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              })

            if (error) {
              console.error(
                'Erro no setSession:',
                error.message,
              )

              setIsProcessing(false)

              router.replace(
                `/login?error=${encodeURIComponent(
                  error.message,
                )}`,
              )
              return
            }

            if (data?.session) {
              setIsProcessing(false)
              router.replace('/home')
              return
            }
          }
        }

        const errorParam =
          incomingUrl.searchParams.get(
            'error_description',
          ) ||
          incomingUrl.searchParams.get('error')

        console.error(
          'Callback sem code/token válido:',
          rawUrl,
          errorParam,
        )

        setIsProcessing(false)

        router.replace(
          `/login${
            errorParam
              ? `?error=${encodeURIComponent(
                  errorParam,
                )}`
              : ''
          }`,
        )
      } catch (error) {
        console.error(
          'Erro ao processar deep link de callback:',
          error,
        )

        setIsProcessing(false)

        router.replace(
          '/login?error=callback_parse_failed',
        )
      }
    },
    [router],
  )

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return
    }

    let disposed = false

    /*
     * Cold-start:
     * se o Android abriu o processo diretamente pelo
     * dfl://callback, o evento pode ter acontecido antes
     * do React montar. getLaunchUrl cobre esse cenário.
     */
    void App.getLaunchUrl()
      .then((launch) => {
        if (
          !disposed &&
          launch?.url
        ) {
          return processCallback(launch.url)
        }

        return undefined
      })
      .catch((error) => {
        console.error(
          'Erro ao ler launch URL nativa:',
          error,
        )
      })

    const listenerPromise = App.addListener(
      'appUrlOpen',
      ({ url }) => {
        if (!disposed) {
          void processCallback(url)
        }
      },
    )

    return () => {
      disposed = true

      void listenerPromise
        .then((handle) => handle.remove())
        .catch(() => {})
    }
  }, [processCallback])

  return { isProcessing }
}
