import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { buildAuthUrl, googleConfigured } from '@/lib/auth/google'

export const runtime = 'nodejs'

/** Short-lived cookie holding the CSRF state + post-login destination + tz. */
export const OAUTH_COOKIE = 'fhr_oauth'

/**
 * GET /api/auth/google/start?from=/dashboard&tz=Asia/Kolkata
 * Kicks off the Google OAuth redirect flow.
 */
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: 'google_not_configured' }, { status: 500 })
  }

  const url = req.nextUrl
  const from = sanitizeFrom(url.searchParams.get('from'))
  const tz = (url.searchParams.get('tz') ?? '').slice(0, 64)
  const state = randomBytes(16).toString('hex')

  const redirectUri = `${url.origin}/api/auth/google/callback`
  const authUrl = buildAuthUrl(redirectUri, state)

  const res = NextResponse.redirect(authUrl)
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, from, tz }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes — only needs to survive the round-trip to Google
  })
  return res
}

/** Only allow same-site absolute paths as the post-login destination. */
function sanitizeFrom(from: string | null): string {
  if (from && from.startsWith('/') && !from.startsWith('//')) return from
  return ''
}
