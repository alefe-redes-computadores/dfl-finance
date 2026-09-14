// src/lib/runtime/apiUrl.ts
import { Capacitor } from '@capacitor/core'

const SERVER_ORIGIN_ENV = 'NEXT_PUBLIC_DFL_SERVER_ORIGIN'

function normalizeServerOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')

  let parsed: URL

  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error(
      `${SERVER_ORIGIN_ENV} precisa ser uma URL absoluta HTTPS válida.`,
    )
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(
      `${SERVER_ORIGIN_ENV} precisa usar HTTPS.`,
    )
  }

  if (
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `${SERVER_ORIGIN_ENV} deve conter somente a origem do servidor, sem caminho, query ou hash.`,
    )
  }

  return parsed.origin
}

export function isNativeRuntime(): boolean {
  return Capacitor.isNativePlatform()
}

export function getServerOrigin(): string | null {
  const configured =
    process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN

  if (!configured?.trim()) {
    return null
  }

  return normalizeServerOrigin(configured)
}

/**
 * Resolve endpoints que continuam hospedados no runtime Next/Vercel.
 *
 * Web/PWA:
 *   mantém URL relativa e same-origin.
 *
 * Capacitor:
 *   usa explicitamente NEXT_PUBLIC_DFL_SERVER_ORIGIN.
 *
 * Assim o aplicativo nativo não depende da origem interna do WebView
 * para alcançar OCR, IA, importação e demais Route Handlers.
 */
export function resolveApiUrl(path: string): string {
  if (
    !path.startsWith('/api/') &&
    !path.startsWith('/_api/')
  ) {
    throw new Error(
      `Endpoint server-side inválido: ${path}`,
    )
  }

  if (!isNativeRuntime()) {
    return path
  }

  const serverOrigin = getServerOrigin()

  if (!serverOrigin) {
    throw new Error(
      `${SERVER_ORIGIN_ENV} não configurada para o runtime nativo.`,
    )
  }

  return new URL(path, `${serverOrigin}/`).toString()
}
