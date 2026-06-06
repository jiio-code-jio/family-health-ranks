import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { signSession, session } from '@/lib/auth/jwt'
import { exchangeAndVerify } from '@/lib/auth/google'
import { OAUTH_COOKIE } from '../start/route'
import { log } from '@/lib/log'

export const runtime = 'nodejs'

/**
 * GET /api/auth/google/callback
 * Google redirects here with ?code & ?state. We verify the CSRF state, exchange
 * the code, upsert the user by google_sub, mint the fhr_session JWT, and bounce
 * to the dashboard (or /profile for first-timers).
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')

  if (url.searchParams.get('error')) return toLogin(url.origin, 'google_denied')
  if (!code || !stateParam) return toLogin(url.origin, 'missing_code')

  // Verify CSRF state against the short-lived cookie set in /start.
  const raw = req.cookies.get(OAUTH_COOKIE)?.value
  let stateData: { state?: string; from?: string; tz?: string } = {}
  try { stateData = raw ? JSON.parse(raw) : {} } catch { stateData = {} }
  if (!stateData.state || stateData.state !== stateParam) return toLogin(url.origin, 'bad_state')

  const redirectUri = `${url.origin}/api/auth/google/callback`
  let profile
  try {
    profile = await exchangeAndVerify(code, redirectUri)
  } catch (err) {
    log.error('auth.google', 'token exchange failed', { error: err instanceof Error ? err.message : String(err) })
    return toLogin(url.origin, 'exchange_failed')
  }

  const supabase = adminClient()

  // Look up an existing account by Google subject id.
  const { data: existing } = await supabase
    .from('users')
    .select('id, weight_kg')
    .eq('google_sub', profile.sub)
    .maybeSingle()

  let userId: string
  let needsProfile: boolean

  if (existing) {
    userId = existing.id
    needsProfile = existing.weight_kg == null
    // Keep email / avatar fresh on every login.
    await supabase
      .from('users')
      .update({ email: profile.email, avatar_url: profile.picture, updated_at: new Date().toISOString() })
      .eq('id', userId)
  } else {
    const tz = stateData.tz && stateData.tz.length > 0 ? stateData.tz : 'UTC'
    const { data: created, error: insErr } = await supabase
      .from('users')
      .insert({
        google_sub: profile.sub,
        email: profile.email,
        avatar_url: profile.picture,
        display_name: profile.name?.trim() || profile.email?.split('@')[0] || 'Member',
        timezone: tz,
      })
      .select('id')
      .single()
    if (insErr || !created) {
      log.error('auth.google', 'user insert failed', { error: insErr?.message ?? 'no_row' })
      return toLogin(url.origin, 'create_failed')
    }
    userId = created.id
    needsProfile = true
  }

  const token = await signSession(userId)
  const dest = needsProfile ? '/profile' : safeDest(stateData.from)

  const res = NextResponse.redirect(new URL(dest, url.origin))
  res.cookies.set(session.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: session.maxAgeSeconds,
  })
  // Clear the one-shot oauth state cookie.
  res.cookies.set(OAUTH_COOKIE, '', { path: '/', maxAge: 0 })

  log.info('auth.google', existing ? 'login' : 'signup', { user_id: userId })
  return res
}

function safeDest(from: string | undefined): string {
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/dashboard'
}

function toLogin(origin: string, reason: string): NextResponse {
  const u = new URL('/login', origin)
  u.searchParams.set('error', reason)
  return NextResponse.redirect(u)
}
