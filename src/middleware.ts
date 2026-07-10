import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
  const isPjRoute = PJ_ROUTES.some(route => pathname.startsWith(route))

  if (isPjRoute) {
    const appMode = request.cookies.get('dfl_app_mode')?.value
    if (appMode === 'personal_only') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$).*)'],
}
