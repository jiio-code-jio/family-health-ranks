'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConfirmFoodChips, type DraftItem } from '@/components/ConfirmFoodChips'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { FlagScoreButton } from '@/components/FlagScoreButton'

type Macros = {
  protein_g: number; carbs_g: number; fat_g: number; fiber_g: number
  sat_fat_g: number; sugar_g: number; sodium_mg: number; kcal: number
}
type Breakdown = {
  protein: number; fiber: number; quality: number; vegetable: number; fruit: number
  sugar: number; sat_fat: number; sodium: number; raw: number; final: number
}
type Daily = {
  nutrition: number; goal_alignment: number; meal_timing: number; hydration: number
  consistency: number; total_score: number; meal_count: number
}
type ConfirmResponse = { score: number; breakdown: Breakdown; macros: Macros; daily: Daily }

type Props = {
  mealId: string
  initial: DraftItem[]
  alreadyScored: boolean
}

const DRAFT_KEY = (mealId: string) => `fhr:confirm:${mealId}`

export function ConfirmPanel({ mealId, initial, alreadyScored }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<DraftItem[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ConfirmResponse | null>(null)
  const hydrated = useRef(false)

  // On mount, prefer a previously-saved draft over the server's initial
  // suggestions — that way removals + edits survive navigating away and back.
  // (Server hydration uses `initial`; we flip to draft after first paint to
  // avoid React hydration mismatch.)
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    try {
      const raw = localStorage.getItem(DRAFT_KEY(mealId))
      if (!raw) return
      const parsed = JSON.parse(raw) as DraftItem[]
      if (Array.isArray(parsed)) setItems(parsed)
    } catch { /* ignore corrupt drafts */ }
  }, [mealId])

  // Save the draft on every change so refresh / nav doesn't lose work.
  useEffect(() => {
    if (!hydrated.current) return
    try { localStorage.setItem(DRAFT_KEY(mealId), JSON.stringify(items)) } catch {}
  }, [mealId, items])

  function discardDraftAndReset() {
    try { localStorage.removeItem(DRAFT_KEY(mealId)) } catch {}
    setItems(initial)
  }

  // With LLM-first scoring, every item is score-able — taxonomy match uses
  // curated macros, LLM-estimate uses the LLM's per-100g values. The only
  // un-submittable case is a legacy row whose LLM-estimate item lacks macros
  // (uploaded before this refactor) — we mark those as "needs swap".
  const needsSwap = items.filter((i) => !i.food_id && !i.llm_macros_per_100g).length
  const canSubmit = items.length > 0 && needsSwap === 0 && !busy
  const aiEstimateCount = items.filter((i) => !i.food_id && i.llm_macros_per_100g).length

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        confirmed_foods: items.map((i) => {
          if (i.food_id !== null) {
            return {
              food_id: i.food_id,
              portion_size: i.portion.size,
              portion_g: i.portion.grams,
            }
          }
          // LLM-estimate items carry their own macros + classification.
          return {
            food_id: null as null,
            display_name: i.display_name,
            llm_macros_per_100g: i.llm_macros_per_100g!,
            llm_category: i.llm_category!,
            llm_quality: i.llm_quality!,
            portion_size: i.portion.size,
            portion_g: i.portion.grams,
          }
        }),
      }
      const res = await fetch(`/api/meals/${mealId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not score this meal.')
        return
      }
      // Drop the local draft — confirmed_foods is now persisted server-side.
      try { localStorage.removeItem(DRAFT_KEY(mealId)) } catch {}
      setResult(json as ConfirmResponse)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    // Pass through the foods the user just confirmed so they can see what was scored,
    // not just an opaque number. The items state is intact post-submit (we never mutate it).
    const scoredFoods = items
      .filter((i) => i.food_id !== null)
      .map((i) => ({
        display_name: i.display_name,
        portion_size: i.portion.size,
        portion_g: i.portion.grams,
      }))
    return (
      <div className="space-y-5">
        <ScoreBreakdown {...result} foods={scoredFoods} />
        <FlagScoreButton mealId={mealId} />
        <div className="flex gap-2">
          <Link href="/dashboard" className="flex-1 rounded-md bg-foreground py-2 text-center text-sm text-background">
            Back to dashboard
          </Link>
          <Link href="/leaderboard" className="flex-1 rounded-md border border-black/15 py-2 text-center text-sm dark:border-white/20">
            See rank
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ConfirmFoodChips items={items} onChange={setItems} disabled={busy} />

      {error && <p className="text-sm text-red-500">{error}</p>}

      {aiEstimateCount > 0 && needsSwap === 0 && (
        <p className="text-xs opacity-60">
          {aiEstimateCount} item{aiEstimateCount === 1 ? '' : 's'} scored using AI macro estimates (not in our curated taxonomy). Tap <em>Change food</em> on a row to use a curated entry instead.
        </p>
      )}

      {needsSwap > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-medium">
            {needsSwap} item{needsSwap === 1 ? '' : 's'} need a food picked.
          </p>
          <p className="mt-0.5 opacity-90">
            This meal was uploaded before our AI-estimate fallback was added.
            For each row above, tap <em>Change food</em> to pick from the food list (we’ll pre-fill the search), or tap <em>Remove</em>.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="w-full rounded-md bg-foreground py-2 text-background disabled:opacity-40"
      >
        {busy
          ? 'Scoring…'
          : needsSwap > 0
            ? `Pick a food for ${needsSwap} item${needsSwap === 1 ? '' : 's'}`
            : alreadyScored
              ? 'Re-score with these changes'
              : 'Score this meal'}
      </button>

      <button
        type="button"
        onClick={discardDraftAndReset}
        className="block w-full text-center text-[11px] opacity-50 hover:opacity-80"
      >
        Reset to the LLM’s original suggestions
      </button>

      {alreadyScored && (
        <div className="border-t border-black/10 pt-3 dark:border-white/10">
          <FlagScoreButton mealId={mealId} />
        </div>
      )}
    </div>
  )
}
