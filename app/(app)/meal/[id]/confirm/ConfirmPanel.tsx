'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConfirmFoodChips, type DraftItem } from '@/components/ConfirmFoodChips'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { FlagScoreButton } from '@/components/FlagScoreButton'
import { useT } from '@/components/design/ThemeProvider'
import { Button } from '@/components/design/primitives'
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

  const canSubmit = items.length > 0 && !busy

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        confirmed_foods: items.map((i) => ({
          display_name: i.display_name,
          llm_macros_per_100g: i.llm_macros_per_100g,
          llm_category: i.llm_category,
          llm_quality: i.llm_quality,
          portion_size: i.portion.size,
          portion_g: i.portion.grams,
        })),
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
    const scoredFoods = items.map((i) => ({
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

      {items.length > 0 && (
        <p
          style={{
            marginTop: 12,
            fontFamily: FONT_UI,
            fontSize: 12,
            color: t.textMute,
          }}
        >
          Macros are estimated by AI from the photo. Adjust portions, remove anything that
          isn’t there, or add items we missed.
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <Button kind="brand" full icon="spark" onClick={submit} disabled={!canSubmit}>
          {busy
            ? 'Scoring…'
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
