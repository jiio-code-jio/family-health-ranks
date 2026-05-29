import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { signSession, session } from '@/lib/auth/jwt'
import { hashCode } from '@/lib/auth/code-hash'

const Body = z.object({ code: z.string().min(8).max(64) })

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const hash = hashCode(body.code)
  const supabase = adminClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, weight_kg')
    .eq('participation_code_hash', hash)
    .maybeSingle()

  if (error || !user) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 401 })
  }

  const token = await signSession(user.id)
  const res = NextResponse.json({
    ok: true,
    needs_profile: user.weight_kg === null,
  })
  res.cookies.set(session.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: session.maxAgeSeconds,
  })
  return res
}
