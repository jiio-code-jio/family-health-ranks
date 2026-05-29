/**
 * HMAC-SHA256 hash of a participation code, keyed by JWT_SECRET.
 *
 * Deterministic so we can do a single indexed DB lookup. Server-only — uses
 * node:crypto and must not be imported from middleware (Edge Runtime).
 * For middleware / JWT verification, use lib/auth/jwt.ts which is edge-safe.
 */

import { createHmac } from 'node:crypto'

export function hashCode(code: string): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET missing')
  return createHmac('sha256', s).update(code.trim()).digest('hex')
}
