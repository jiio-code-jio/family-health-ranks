import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { allFoods, foodsById, searchByText } from '@/lib/taxonomy/loader'

export const runtime = 'nodejs'

const RESPONSE_FIELDS = (f: Awaited<ReturnType<typeof allFoods>>[number]) => ({
  id: f.id,
  display_name: f.display_name,
  aliases: f.aliases,
  category: f.category,
  quality_tier: f.quality_tier,
  default_portion_g: f.default_portion_g,
})

/**
 * GET /api/foods?q=...
 * Returns up to 20 foods matching the query, ordered by token-overlap relevance.
 *
 * Uses the in-memory taxonomy + searchByText (token-overlap scoring), the same
 * function the resolver falls back to when Gemini fails. This makes user-search
 * and resolver-fallback behave the same way, and handles real-world inputs
 * like `"white basmati rice"` or `lentil curry (dal)` (surrounding quotes /
 * parens stripped; tokens like "lentil" + "curry" each scored against
 * display_name + aliases).
 */
export async function GET(req: NextRequest) {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const q = sanitizeQuery(req.nextUrl.searchParams.get('q') ?? '')

  // No query → return a small alphabetical slice as a starting list.
  if (!q) {
    const list = await allFoods()
    const slice = [...list]
      .sort((a, b) => a.display_name.localeCompare(b.display_name))
      .slice(0, 20)
      .map(RESPONSE_FIELDS)
    return NextResponse.json({ foods: slice })
  }

  const matches = await searchByText(q, 20)
  const foods = await foodsById(matches.map((m) => m.food_id))
  // Preserve searchByText's score-ranked order
  const byId = new Map(foods.map((f) => [f.id, f]))
  const ordered = matches
    .map((m) => byId.get(m.food_id))
    .filter((f): f is NonNullable<typeof f> => !!f)
    .map(RESPONSE_FIELDS)

  return NextResponse.json({ foods: ordered })
}

// Strip surrounding quotes / parens. Handles ASCII + smart-quotes.
function sanitizeQuery(raw: string): string {
  return raw
    .trim()
    .replace(/^[\s'"“”‘’(\[\{]+/, '')
    .replace(/[\s'"“”‘’)\]\}]+$/, '')
    .trim()
}

