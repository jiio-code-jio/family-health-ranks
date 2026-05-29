'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConfirmFoodChips, type DraftItem } from '@/components/ConfirmFoodChips'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { FlagScoreButton } from '@/components/FlagScoreButton'
import { useT } from '@/components/design/ThemeProvider'
import { Button, Card } from '@/components/design/primitives'
import { FONT_UI } from '@/components/design/theme'

type Macros = {
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sat_fat_g: number
  sugar_g: number
  sodium_mg: number
  kcal: number
}
type Breakdown = {
  protein: number
  fiber: number
  quality: number
  vegetable: number
  fruit: number
  sugar: number
  sat_fat: number
  sodium: number
  raw: number
  final: number
}
type Daily = {
  nutrition: number
  goal_alignment: number
  meal_timing: number
  hydration: number
  consistency: number
  total_score: number
  meal_count: number
}
type ConfirmResponse = { score: number; breakdown: Breakdown; macros: Macros; daily: Daily }

type Props = {
  mealId: string
  initial: DraftItem[]
  alreadyScored: boolean
}

const DRAFT_KEY = (mealId: string) => `fhr:confirm:${mealId}`

export function ConfirmPanel({ mealId, initial, alreadyScored }: Props) {
  const t = useT()
  const router = useRouter()
  const [items, setItems] = useState<DraftItem[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ConfirmResponse | null>(null)
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    try {
      const raw = localStorage.getItem(DRAFT_KEY(mealId))
      if (!raw) return
      const parsed = JSON.parse(raw) as DraftItem[]
      if (Array.isArray(parsed)) setItems(parsed)
    } catch {
      /* ignore corrupt drafts */
    }
  }, [mealId])

  useEffect(() => {
    if (!hydrated.current) return
    try {
      localStorage.setItem(DRAFT_KEY(mealId), JSON.stringify(items))
    } catch {
      /* storage blocked */
    }
  }, [mealId, items])

  function discardDraftAndReset() {
    try {
      localStorage.removeItem(DRAFT_KEY(mealId))
    } catch {
      /* storage blocked */
    }
    setItems(initial)
  }

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
      try {
        localStorage.removeItem(DRAFT_KEY(mealId))
      } catch {
        /* storage blocked */
      }
      setResult(json as ConfirmResponse)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    const scoredFoods = items
      .filter((i) => i.food_id !== null)
      .map((i) => ({
        display_name: i.display_name,
        portion_size: i.portion.size,
        portion_g: i.portion.grams,
      }))
    return (
      <div>
        <ScoreBreakdown {...result} foods={scoredFoods} />
        <FlagScoreButton mealId={mealId} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link href="/dashboard" style={{ flex: 1, textDecoration: 'none' }}>
            <Button kind="brand" full icon="check">
              Add to today
            </Button>
          </Link>
          <Link href="/leaderboard" style={{ flex: 1, textDecoration: 'none' }}>
            <Button kind="surface" full icon="rank">
              See rank
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <ConfirmFoodChips items={items} onChange={setItems} disabled={busy} />

      {error && (
        <p
          style={{
            marginTop: 12,
            fontFamily: FONT_UI,
            fontSize: 13,
            color: 'oklch(0.68 0.2 25)',
          }}
        >
          {error}
        </p>
      )}

      {aiEstimateCount > 0 && needsSwap === 0 && (
        <p
          style={{
            marginTop: 12,
            fontFamily: FONT_UI,
            fontSize: 12,
            color: t.textMute,
          }}
        >
          {aiEstimateCount} item{aiEstimateCount === 1 ? '' : 's'} scored using AI macro
          estimates. Tap <em>Change food</em> on a row to use a curated entry instead.
        </p>
      )}

      {needsSwap > 0 && (
        <Card
          pad={12}
          style={{
            marginTop: 12,
            background: 'oklch(0.32 0.12 80 / 0.18)',
            border: `1px solid oklch(0.65 0.18 80 / 0.4)`,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: FONT_UI,
              fontWeight: 700,
              fontSize: 13,
              color: 'oklch(0.85 0.18 80)',
            }}
          >
            {needsSwap} item{needsSwap === 1 ? '' : 's'} need a food picked.
          </p>
          <p
            style={{
              margin: '4px 0 0',
              fontFamily: FONT_UI,
              fontSize: 12,
              color: t.textMute,
            }}
          >
            This meal was uploaded before our AI-estimate fallback was added. For each row above,
            tap <em>Change food</em> to pick from the food list, or tap remove.
          </p>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        <Button kind="brand" full icon="spark" onClick={submit} disabled={!canSubmit}>
          {busy
            ? 'Scoring…'
            : needsSwap > 0
              ? `Pick a food for ${needsSwap} item${needsSwap === 1 ? '' : 's'}`
              : alreadyScored
                ? 'Re-score with these changes'
                : 'Score this meal'}
        </Button>
      </div>

      <button
        type="button"
        onClick={discardDraftAndReset}
        style={{
          display: 'block',
          margin: '10px auto 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: FONT_UI,
          fontSize: 11.5,
          color: t.textFaint,
          padding: 0,
        }}
      >
        Reset to the LLM&apos;s original suggestions
      </button>

      {alreadyScored && (
        <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 16, paddingTop: 12 }}>
          <FlagScoreButton mealId={mealId} />
        </div>
      )}
    </div>
  )
}
