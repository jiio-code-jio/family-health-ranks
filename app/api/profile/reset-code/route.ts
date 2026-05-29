import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { generateCode } from '@/lib/auth/code'
import { hashCode } from '@/lib/auth/code-hash'

export const runtime = 'nodejs'

/**
 * POST /api/profile/reset-code
 *
 * Generates a brand-new participation code for the logged-in user, stores it
 * hashed, and returns the plaintext ONCE. The old code is immediately invalid.
 *
 * Use case: "I lost my code and need it for a new device." The user must already
 * be logged in (cookie still valid). If completely locked out, the admin runs
 *   npm run seed-user -- --regenerate --name "…"
 */
export async function POST() {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const code = generateCode()
  const { error } = await adminClient()
    .from('users')
    .update({
      participation_code_hash: hashCode(code),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sess.sub)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return plaintext code — only time it's ever visible. Client shows it once.
  return NextResponse.json({ ok: true, code })
}
