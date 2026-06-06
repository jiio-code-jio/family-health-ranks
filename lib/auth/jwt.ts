/**
 * Edge-safe JWT helpers. Used by middleware (Edge Runtime) AND by Node
 * server routes — only depends on jose (Web Crypto under the hood), never on
 * node:crypto.
 *
 * Identity comes from Google OAuth (see lib/auth/google.ts); these helpers just
 * mint and verify the fhr_session cookie that represents a logged-in user.
 */

import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'fhr_session'
const TOKEN_AUDIENCE = 'fhr-app'
const TOKEN_ISSUER = 'fhr'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90 // 90 days

function secretBytes(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET missing')
  return new TextEncoder().encode(s)
}

export type SessionPayload = { sub: string }

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .sign(secretBytes())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretBytes(), {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    })
    if (!payload.sub) return null
    return { sub: payload.sub }
  } catch {
    return null
  }
}

export const session = {
  cookieName: COOKIE_NAME,
  maxAgeSeconds: SESSION_TTL_SECONDS,
}
