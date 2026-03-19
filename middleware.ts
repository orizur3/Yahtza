import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const APP_PASSWORD = process.env.APP_PASSWORD || 'changeme123'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }
  const auth = request.cookies.get('auth_token')?.value
  if (auth === APP_PASSWORD) return NextResponse.next()
  if (pathname === '/login') return NextResponse.next()
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
