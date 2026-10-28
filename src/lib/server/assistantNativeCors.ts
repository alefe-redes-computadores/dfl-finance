/**
 * Fronteira HTTP entre o WebView Android e a API Vercel.
 *
 * O APK Capacitor usa https://localhost como origem.
 * CORS não substitui autenticação: POST exige JWT Supabase.
 *
 * Nunca usar "*" ou liberar outras origens automaticamente.
 */
const ANDROID_ORIGIN = 'https://localhost'

function isAndroidOrigin(request: Request): boolean {
  return request.headers.get('origin') === ANDROID_ORIGIN
}

function addVary(headers: Headers, fields: string) {
  const previous = headers.get('Vary') || ''
  const existing = previous
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

  for (const field of fields.split(',').map((x) => x.trim())) {
    if (!existing.some((x) => x.toLowerCase() === field.toLowerCase())) {
      existing.push(field)
    }
  }

  headers.set('Vary', existing.join(', '))
}

export function assistantNativePreflight(
  request: Request
): Response {
  if (!isAndroidOrigin(request)) {
    return new Response(null, {
      status: 403,
      headers: {
        Vary: 'Origin',
        'Cache-Control': 'no-store',
      },
    })
  }

  const method = (
    request.headers.get('access-control-request-method') ||
    ''
  ).toUpperCase()

  if (method !== 'POST') {
    return new Response(null, {
      status: 405,
      headers: {
        Vary: 'Origin, Access-Control-Request-Method',
        'Cache-Control': 'no-store',
      },
    })
  }

  const requestedHeaders = (
    request.headers.get('access-control-request-headers') ||
    ''
  )
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)

  const permittedHeaders = new Set([
    'authorization',
    'content-type',
  ])

  if (requestedHeaders.some((x) => !permittedHeaders.has(x))) {
    return new Response(null, {
      status: 400,
      headers: {
        Vary: 'Origin, Access-Control-Request-Headers',
        'Cache-Control': 'no-store',
      },
    })
  }

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': ANDROID_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '600',
      'Cache-Control': 'no-store',
      Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
    },
  })
}

export function withAssistantNativeCors(
  request: Request,
  response: Response
): Response {
  if (!isAndroidOrigin(request)) {
    return response
  }

  response.headers.set(
    'Access-Control-Allow-Origin',
    ANDROID_ORIGIN
  )

  addVary(response.headers, 'Origin')

  return response
}
