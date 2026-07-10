import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Exemplo de lógica simples: se você tiver um token de autenticação no cookie
  // const token = request.cookies.get('sb-access-token')
  
  // Se quiser apenas que o middleware não interfira em nada por enquanto:
  return NextResponse.next()
}

// Configuração de rotas para o middleware ignorar arquivos estáticos
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
