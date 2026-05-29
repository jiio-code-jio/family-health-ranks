/**
 * Batch-sign meal image paths in a single storage call.
 *
 * Replaces the old per-card pattern (one `/api/meals/[id]/image-url` request
 * each) — the dashboard now signs every visible meal's image in one round trip
 * and embeds the URLs in the meals payload, so thumbnails render on first paint
 * with zero extra client fetches.
 *
 * TTL is 1h: long enough that a dashboard left open doesn't 404 its images, and
 * privacy is already gated by the participation code (the whole circle can see
 * the feed), so a longer-lived signed URL costs us nothing.
 */

import { adminClient } from '@/lib/supabase/admin'

const DEFAULT_TTL_SECONDS = 60 * 60 // 1 hour

/**
 * Returns a Map of image_path → signed URL. Paths that fail to sign are simply
 * omitted (callers treat a missing entry as "no image yet"). Null/blank paths
 * are filtered out; an empty input skips the storage call entirely.
 */
export async function signMealImageUrls(
  paths: Array<string | null | undefined>,
  ttl: number = DEFAULT_TTL_SECONDS,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>()

  // De-dupe + drop blanks so we never call storage with garbage.
  const clean = Array.from(new Set(paths.filter((p): p is string => !!p)))
  if (clean.length === 0) return urls

  const { data, error } = await adminClient().storage
    .from('meals')
    .createSignedUrls(clean, ttl)
  if (error || !data) return urls

  for (const row of data) {
    if (row.path && row.signedUrl && !row.error) urls.set(row.path, row.signedUrl)
  }
  return urls
}
