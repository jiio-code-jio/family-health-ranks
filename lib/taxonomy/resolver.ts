/**
 * Map a free-text food description (from Stage 1 LLM perception) onto a
 * food_items.id (Stage 1.5). Three-tier strategy:
 *
 *   s1 > 0.85 AND (s1 - s2) > 0.05  → auto-pick (high confidence, no ambiguity)
 *   0.70 ≤ s1 ≤ 0.85 OR top-2 close → small disambig LLM call
 *   s1 < 0.70                       → unmatched; user picks in confirmation UI
 *
 * The disambig call deliberately uses Gemini Flash with temperature 0 and
 * constrains the choice set to the top-5 candidates from the vector search —
 * the LLM never invents a food_id, only picks one or returns 'none'.
 */

import { adminClient } from '@/lib/supabase/admin'
import { embed, generateText } from '@/lib/llm/gemini'

export type Candidate = {
  food_id: string
  display_name: string
  similarity: number
}

export type Resolution =
  | { kind: 'auto'; food_id: string; candidates: Candidate[] }
  | { kind: 'llm_disambig'; food_id: string; candidates: Candidate[] }
  | { kind: 'unmatched'; candidates: Candidate[] }

// Tuned to gemini-embedding-001 truncated to 768 dims (MRL). Observed ranges:
// junk descriptions top out around 0.56-0.57, clear matches land 0.70-0.85,
// ambiguous mid-confidence around 0.60-0.70. Re-tune if the embedding model
// changes — run scripts/test-resolver.ts to recalibrate.
const AUTO_PICK_THRESHOLD = 0.70
const AUTO_PICK_MARGIN = 0.04
const DISAMBIG_FLOOR = 0.58

export async function resolveDescription(description: string): Promise<Resolution> {
  const vec = await embed(description, 'RETRIEVAL_QUERY')
  const candidates = await topK(vec, 5)

  if (candidates.length === 0) {
    return { kind: 'unmatched', candidates: [] }
  }

  const s1 = candidates[0].similarity
  const s2 = candidates[1]?.similarity ?? 0
  const margin = s1 - s2

  if (s1 > AUTO_PICK_THRESHOLD && margin > AUTO_PICK_MARGIN) {
    return { kind: 'auto', food_id: candidates[0].food_id, candidates }
  }

  if (s1 < DISAMBIG_FLOOR) {
    return { kind: 'unmatched', candidates }
  }

  // Mid-confidence or close top-2 — let the LLM pick from the constrained set.
  const choice = await disambigPick(description, candidates)
  if (choice && candidates.some((c) => c.food_id === choice)) {
    return { kind: 'llm_disambig', food_id: choice, candidates }
  }
  // LLM said 'none' or returned junk → treat as unmatched, user resolves.
  return { kind: 'unmatched', candidates }
}

async function topK(queryVec: number[], k: number): Promise<Candidate[]> {
  const supabase = adminClient()
  const { data, error } = await supabase.rpc('match_food_items', {
    query_embedding: `[${queryVec.join(',')}]`,
    match_count: k,
  })
  if (error) throw new Error(`vector search: ${error.message}`)
  return (data ?? []).map((r: { id: string; display_name: string; similarity: number }) => ({
    food_id: r.id,
    display_name: r.display_name,
    similarity: Number(r.similarity),
  }))
}

async function disambigPick(description: string, candidates: Candidate[]): Promise<string | null> {
  const options = candidates
    .map((c) => `${c.food_id}: ${c.display_name}`)
    .join('\n')
  const prompt = `Pick the single best matching food id for this dish description:

Description: "${description}"

Options:
${options}

Reply with ONLY the food id (e.g. "idli") or the word "none" if nothing fits.`
  const reply = (await generateText(prompt)).toLowerCase().replace(/[^a-z0-9_]/g, '')
  if (!reply || reply === 'none') return null
  return reply
}
