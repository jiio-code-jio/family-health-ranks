import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service-role key. Bypasses RLS — use
 * only in API routes / background jobs / scripts. Never expose to the browser.
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, { auth: { persistSession: false } })
}
