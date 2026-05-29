import { NextResponse } from 'next/server'
import { session } from '@/lib/auth/jwt'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(session.cookieName, '', { path: '/', maxAge: 0 })
  return res
}
