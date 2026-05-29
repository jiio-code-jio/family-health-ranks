'use client'

import { useT } from './design/ThemeProvider'
import { Card, SectionLabel } from './design/primitives'
import { ScoreRing } from './design/viz'
import { Icon } from './design/Icon'
import { FONT_DISPLAY, FONT_MONO, FONT_UI, scoreColor } from './design/theme'

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

type DailyComponents = {
  nutrition: number
  goal_alignment: number
  meal_timing: number
  hydration: number
  consistency: number
  total_score: number
  meal_count: number
}

export type ScoredFood = {
  display_name: string
  portion_size: 'small' | 'medium' | 'large' | 'custom'
  portion_g: number
}

type Props = {
  score: number
  breakdown: Breakdown
  macros: Macros
  daily?: DailyComponents
  foods?: ScoredFood[]
}

const ROWS: Array<{ key: keyof Breakdown; label: string }> = [
  { key: 'protein', label: 'Protein' },
  { key: 'fiber', label: 'Fiber' },
  { key: 'quality', label: 'Food quality' },
  { key: 'vegetable', label: 'Vegetables present' },
  { key: 'fruit', label: 'Fruit present' },
  { key: 'sugar', label: 'Sugar' },
  { key: 'sat_fat', label: 'Saturated fat' },
  { key: 'sodium', label: 'Sodium over 600 mg' },
]

export function ScoreBreakdown({ score, breakdown, macros, daily, foods }: Props) {
  const t = useT()
  const col = scoreColor(score)
  const macroCells: Array<[string, string | number]> = [
    ['kcal', macros.kcal],
    ['protein', `${macros.protein_g}g`],
    ['carbs', `${macros.carbs_g}g`],
    ['fat', `${macros.fat_g}g`],
    ['fiber', `${macros.fiber_g}g`],
  ]

  return (
    <div>
      {/* Hero reveal */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          marginBottom: 8,
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: col + '22',
            filter: 'blur(50px)',
          }}
        />
        <div
          style={{
            fontFamily: FONT_UI,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: t.textFaint,
            marginBottom: 16,
            position: 'relative',
          }}
        >
          Meal scored
        </div>
        <ScoreRing score={score} size={208} label="this meal" dur={1500} />
      </div>

      {daily && (
        <div style={{ textAlign: 'center', marginTop: 14, marginBottom: 20 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: t.brand + (t.dark ? '18' : '20'),
              border: `1px solid ${t.brand}66`,
              borderRadius: 999,
              padding: '8px 14px',
            }}
          >
            <Icon name="arrow-up" size={15} sw={2.6} color={t.brand} />
            <span style={{ fontFamily: FONT_UI, fontWeight: 700, fontSize: 13, color: t.text }}>
              Daily score {Math.round(daily.total_score)} · {daily.meal_count} meal
              {daily.meal_count === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      )}

      {foods && foods.length > 0 && (
        <>
          <SectionLabel>What you ate</SectionLabel>
          <Card pad={6} style={{ marginBottom: 16 }}>
            {foods.map((f, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderBottom: i < foods.length - 1 ? `1px solid ${t.border}` : 'none',
                }}
              >
                <Icon name="fork" size={15} sw={2} color={t.textMute} />
                <span style={{ flex: 1, fontFamily: FONT_UI, fontSize: 14, color: t.text }}>
                  {f.display_name}
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: t.textFaint }}>
                  {f.portion_g} g · {f.portion_size}
                </span>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionLabel>How we scored it</SectionLabel>
      <Card pad={6} style={{ marginBottom: 16 }}>
        {ROWS.filter((r) => breakdown[r.key] !== 0).map((r, i, arr) => {
          const v = breakdown[r.key]
          const pos = v > 0
          const c = pos ? scoreColor(85) : 'oklch(0.68 0.2 25)'
          return (
            <div
              key={r.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
              }}
            >
              <span style={{ flex: 1, fontFamily: FONT_UI, fontSize: 14, color: t.text }}>{r.label}</span>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontWeight: 600,
                  fontSize: 14,
                  color: c,
                }}
              >
                {pos ? '+' : ''}
                {round1(v)}
              </span>
            </div>
          )
        })}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 12px',
            borderTop: `1px solid ${t.border}`,
          }}
        >
          <span
            style={{
              flex: 1,
              fontFamily: FONT_UI,
              fontWeight: 700,
              fontSize: 14,
              color: t.text,
            }}
          >
            Raw total
          </span>
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: 16,
              color: t.text,
            }}
          >
            {round1(breakdown.raw)}
          </span>
        </div>
      </Card>

      <SectionLabel>Macros</SectionLabel>
      <Card pad={14} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {macroCells.map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize: 17,
                  color: t.text,
                }}
              >
                {v}
              </div>
              <div
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 10.5,
                  color: t.textFaint,
                  marginTop: 2,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {k}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
