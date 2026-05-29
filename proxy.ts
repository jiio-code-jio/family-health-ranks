import { NextRequest, NextResponse } from 'next/server'
import { verifySession, session } from '@/lib/auth/jwt'

const PROTECTED_PREFIXES = ['/dashboard', '/leaderboard', '/profile', '/meal']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (!needsAuth) return NextResponse.next()

  const token = req.cookies.get(session.cookieName)?.value
  const valid = token ? await verifySession(token) : null
  if (!valid) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/leaderboard/:path*', '/profile/:path*', '/meal/:path*'],
}
