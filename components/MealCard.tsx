'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { mutate as swrMutate } from 'swr'
import { useT } from './design/ThemeProvider'
import { FONT_DISPLAY, FONT_UI, FONT_MONO, scoreColor } from './design/theme'
import { MealPhoto } from './design/viz'

export type Meal = {
  id: string
  meal_type: string
  eaten_at: string
  processing_status: 'pending_identify' | 'awaiting_confirmation' | 'scored' | 'rejected_not_food' | 'failed'
  image_path: string | null
  image_url?: string | null
  score: string | number | null
  used_premium_model?: boolean
  metadata?: string | null
  confirmed_foods?: Array<{ food_id: string; portion_g?: number }> | null
}

const STATUS_LABEL: Record<Meal['processing_status'], string> = {
  pending_identify: 'Analyzing…',
  awaiting_confirmation: 'Tap to confirm',
  scored: 'Scored',
  rejected_not_food: 'No food detected',
  failed: 'Try again',
}

function hueFromString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

export function MealCard({ meal, ownerView }: { meal: Meal; ownerView: boolean }) {
  const t = useT()
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const imgUrl = meal.image_url ?? null

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this meal?')) return
    setDeleting(true)

    const matchMealsKey = (key: unknown) => typeof key === 'string' && key.startsWith('/api/meals?date=')
    await swrMutate(
      matchMealsKey,
      (data: { meals: Meal[]; date: string } | undefined) => {
        if (!data) return data
        return { ...data, meals: data.meals.filter((m) => m.id !== meal.id) }
      },
      { revalidate: false },
    )

    try {
      const res = await fetch(`/api/meals/${meal.id}`, { method: 'DELETE' })
      if (!res.ok) {
        await swrMutate(matchMealsKey)
        alert('Delete failed. Try again.')
        return
      }
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  const eatenAt = new Date(meal.eaten_at)
  const time = eatenAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  const href =
    meal.processing_status === 'awaiting_confirmation' ? `/meal/${meal.id}/confirm` :
    meal.processing_status === 'scored'                ? `/meal/${meal.id}/confirm` :
                                                         null

  const score = meal.score === null ? null : Math.round(Number(meal.score))
  const scoreCol = score !== null ? scoreColor(score) : null
  const hue = hueFromString(meal.id || meal.meal_type)

  const macros = ((meal as unknown as { macros?: { kcal?: number } }).macros) ?? {}
  const kcal = Number(macros.kcal ?? 0)

  const inner = (
    <div
      style={{
        borderRadius: 18,
        overflow: 'hidden',
        border: `1px solid ${t.border}`,
        background: t.surface,
        position: 'relative',
      }}
    >
      <div style={{ position: 'relative', height: 110 }}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={`${meal.meal_type} meal`}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <MealPhoto hue={hue} label={meal.meal_type} height="100%" />
        )}
        <span
          style={{
            position: 'absolute',
            left: 8,
            top: 8,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            padding: '2px 8px',
            fontFamily: FONT_UI,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          {meal.meal_type}
        </span>
        {score !== null && scoreCol && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              minWidth: 30,
              height: 30,
              borderRadius: 9,
              background: scoreCol,
              display: 'grid',
              placeItems: 'center',
              boxShadow: `0 2px 10px ${scoreCol}88`,
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: 14,
              color: '#0c0f0a',
              padding: '0 6px',
            }}
          >
            {score}
          </div>
        )}
      </div>
      <div style={{ padding: '9px 11px 11px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 6,
          }}
        >
          <div
            style={{
              fontFamily: FONT_UI,
              fontWeight: 700,
              fontSize: 13.5,
              color: t.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {meal.meal_type}
          </div>
          {ownerView && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: deleting ? 'default' : 'pointer',
                color: 'oklch(0.68 0.2 25)',
                fontFamily: FONT_UI,
                fontSize: 11,
                opacity: deleting ? 0.4 : 0.8,
                padding: 0,
              }}
            >
              {deleting ? '…' : 'Delete'}
            </button>
          )}
        </div>
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 11.5,
            color:
              meal.processing_status === 'awaiting_confirmation'
                ? 'oklch(0.78 0.16 75)'
                : t.textMute,
            marginTop: 1,
          }}
        >
          {STATUS_LABEL[meal.processing_status]}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 7,
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            color: t.textFaint,
          }}
        >
          <span>{time}</span>
          {kcal > 0 && (
            <>
              <span>·</span>
              <span>{Math.round(kcal)} kcal</span>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <article style={{ position: 'relative' }}>
      {href ? (
        <Link href={href} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          {inner}
        </Link>
      ) : (
        inner
      )}
    </article>
  )
}
