import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service-role key. Bypasses RLS — use
 * only in API routes / background jobs / scripts. Never expose to the browser.
 *
 * Memoized at module scope: the service-role client is stateless
 * (`persistSession: false`) and safe to share, so we build it once per process
 * instead of re-instantiating on every call (this runs on a hot path — dozens
 * of times per request across the app).
 */
let _client: SupabaseClient | null = null

export function adminClient(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}
