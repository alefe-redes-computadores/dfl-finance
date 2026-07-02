// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rotas exclusivas do contexto PJ (business)
const PJ_ROUTES = [
  '/financings',
  '/loans',
  '/subscriptions',
  '/import-invoice',
  '/reports/business',
  '/settings/business',
]

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Verifica se a rota atual é uma rota PJ
  const isPjRoute = PJ_ROUTES.some(route => pathname.startsWith(route))

  if (isPjRoute) {
    // Lê o appMode do cookie (definido no ContextProvider)
    const appMode = request.cookies.get('dfl_app_mode')?.value

    // Se for personal_only, redireciona para a home
    if (appMode === 'personal_only') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder (public assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$).*)',
  ],
}