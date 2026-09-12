'use client'

import {
  ArrowLeft,
  CloudOff,
  RefreshCw,
  WifiOff,
} from 'lucide-react'
import {
  useEffect,
  useState,
} from 'react'
import {
  useRouter,
} from 'next/navigation'

export default function OfflinePage() {
  const router =
    useRouter()

  const [
    isOnline,
    setIsOnline,
  ] = useState(false)

  useEffect(() => {
    const update =
      () => {
        setIsOnline(
          navigator.onLine
        )
      }

    update()

    window.addEventListener(
      'online',
      update
    )

    window.addEventListener(
      'offline',
      update
    )

    return () => {
      window.removeEventListener(
        'online',
        update
      )

      window.removeEventListener(
        'offline',
        update
      )
    }
  }, [])

  return (
    <main className="min-h-[100dvh] bg-gray-50 px-5 py-8 text-gray-900 dark:bg-slate-900 dark:text-gray-100">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center justify-center">
        <section className="w-full rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            {isOnline ? (
              <RefreshCw
                size={27}
              />
            ) : (
              <CloudOff
                size={27}
              />
            )}
          </div>

          <h1 className="text-xl font-bold tracking-tight">
            {isOnline
              ? 'Conexão restabelecida'
              : 'Esta tela ainda não está disponível offline'}
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
            {isOnline
              ? 'A internet voltou. Você pode retornar ao DFL Finance normalmente.'
              : 'Seus dados locais continuam preservados. As telas que já foram carregadas podem funcionar sem internet, e alterações locais ficam aguardando sincronização.'}
          </p>

          {!isOnline && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <WifiOff
                size={18}
                className="mt-0.5 shrink-0"
              />

              <p className="text-xs font-medium leading-5">
                Recursos que dependem de servidor, como IA, OCR e alguns imports, continuam exigindo conexão.
              </p>
            </div>
          )}

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() =>
                router.replace(
                  '/home'
                )
              }
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 text-sm font-bold text-white transition active:scale-[0.98] dark:bg-teal-500 dark:text-slate-950"
            >
              <ArrowLeft
                size={18}
              />
              Voltar para o app
            </button>

            {isOnline && (
              <button
                type="button"
                onClick={() =>
                  window.location.reload()
                }
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition active:scale-[0.98] dark:border-slate-700 dark:text-slate-200"
              >
                <RefreshCw
                  size={17}
                />
                Atualizar
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
