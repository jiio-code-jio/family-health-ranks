import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { generateInviteToken } from '@/lib/auth/code'

export const runtime = 'nodejs'

type Invite = { token: string; used_count: number; created_at: string }

/** Verify the caller is a logged-in admin. Returns their user id, or null. */
async function requireAdmin(): Promise<string | null> {
  const sess = await getSession()
  if (!sess) return null
  const { data } = await adminClient()
    .from('users')
    .select('is_admin')
    .eq('id', sess.sub)
    .single()
  return data?.is_admin ? sess.sub : null
}

/** The current active family invite, or null if none has been minted yet. */
async function activeInvite(): Promise<Invite | null> {
  const { data } = await adminClient()
    .from('invites')
    .select('token, used_count, created_at')
    .eq('disabled', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** GET — return the active family invite, creating one on first call. */
export async function GET() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let invite = await activeInvite()
  if (!invite) {
    const { data, error } = await adminClient()
      .from('invites')
      .insert({ token: generateInviteToken(), created_by: adminId })
      .select('token, used_count, created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    invite = data
  }
  return NextResponse.json(invite)
}

/** POST — rotate: disable every existing link and mint a fresh one. */
export async function POST() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = adminClient()
  await supabase.from('invites').update({ disabled: true }).eq('disabled', false)

  const { data, error } = await supabase
    .from('invites')
    .insert({ token: generateInviteToken(), created_by: adminId })
    .select('token, used_count, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
