import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { signSession, session } from '@/lib/auth/jwt'
import { generateCode } from '@/lib/auth/code'
import { hashCode } from '@/lib/auth/code-hash'
import { log } from '@/lib/log'

export const runtime = 'nodejs'

const Body = z.object({
  token: z.string().min(8).max(64),
  display_name: z.string().trim().min(1).max(40),
  timezone: z.string().min(1).max(64).default('UTC'),
})

/**
 * POST /api/join — redeem a family invite link and create a brand-new account.
 *
 * Public (no session). The invite gates entry; on success we mint a fresh
 * participation code (stored hashed, never shown — recovery is via admin
 * regenerate) and sign the new user straight in. They land on /profile to fill
 * in body stats, exactly like a seeded user's first login.
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const supabase = adminClient()

  // Validate the invite: must exist and not be disabled.
  const { data: invite } = await supabase
    .from('invites')
    .select('id, used_count')
    .eq('token', body.token)
    .eq('disabled', false)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'invalid_invite' }, { status: 401 })
  }

  // Mint a unique participation code (retry once on the unlikely hash collision).
  // We return the plaintext code to the client ONCE — this is the only moment
  // we ever have it. The user should save it; recovery is "reset & reveal" from
  // the profile page while still logged in.
  let userId: string | null = null
  let plainCode = ''
  for (let attempt = 0; attempt < 2 && !userId; attempt++) {
    const code = generateCode()
    const { data, error } = await supabase
      .from('users')
      .insert({
        display_name: body.display_name,
        timezone: body.timezone,
        participation_code_hash: hashCode(code),
      })
      .select('id')
      .single()
    if (data) { userId = data.id; plainCode = code; break }
    if (error && !error.message.includes('participation_code_hash')) {
      log.error('join', 'user insert failed', { error: error.message })
      return NextResponse.json({ error: 'could_not_create' }, { status: 500 })
    }
  }
  if (!userId) return NextResponse.json({ error: 'could_not_create' }, { status: 500 })

  // Best-effort usage counter (family scale — a tiny race here is harmless).
  await supabase
    .from('invites')
    .update({ used_count: invite.used_count + 1 })
    .eq('id', invite.id)

  const token = await signSession(userId)
  // Return the plaintext code in the response body — client will show it once.
  const res = NextResponse.json({ ok: true, needs_profile: true, code: plainCode })
  res.cookies.set(session.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: session.maxAgeSeconds,
  })
  return res
}
