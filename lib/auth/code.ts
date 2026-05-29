/**
 * Generators for participation codes and invite tokens. Server-only (node:crypto).
 *
 * A participation code is a human-friendly identity secret (texted to a user, or
 * auto-minted when they redeem an invite). An invite token is the URL-safe secret
 * embedded in a shareable /join link.
 */

import { randomBytes } from 'node:crypto'

/** Human-friendly participation code, e.g. FAM-2026-K7M9P3X-A2N. */
export function generateCode(): string {
  const year = new Date().getFullYear()
  // Over-generate then strip non-alphanumerics so the slice is always full-length.
  const part = (n: number) =>
    randomBytes(n * 2)
      .toString('base64')
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase()
      .slice(0, n)
  return `FAM-${year}-${part(7)}-${part(3)}`
}

/** Opaque URL-safe invite token for /join?invite=… links. */
export function generateInviteToken(): string {
  return randomBytes(18).toString('base64url') // 24 url-safe chars, no padding
}
