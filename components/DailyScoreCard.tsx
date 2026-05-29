'use client'

import type { Meal } from './MealCard'
import { useT } from './design/ThemeProvider'
import { Card, SectionLabel, TrendBadge } from './design/primitives'
import { MacroBar, MiniRing, ScoreRing } from './design/viz'
import { FONT_UI, FONT_MONO, scoreColor } from './design/theme'
import type { IconName } from './design/Icon'

type Daily = {
  nutrition: number
  goal_alignment: number
  meal_timing: number
  hydration: number
  consistency: number
  total_score: number
  meal_count: number
} | null

type Targets = {
  daily_kcal_target: number
  daily_protein_target_g: number
}

type Props = {
  daily: Daily
  targets: Targets
  meals: Meal[]
}

const COMPONENTS: Array<{ key: keyof NonNullable<Daily>; label: string; weight: number; icon: IconName }> = [
  { key: 'nutrition', label: 'Nutrition', weight: 40, icon: 'leaf' },
  { key: 'goal_alignment', label: 'Goal align', weight: 25, icon: 'goal' },
  { key: 'hydration', label: 'Hydration', weight: 10, icon: 'water' },
  { key: 'consistency', label: 'Consistency', weight: 10, icon: 'clock' },
]

export function DailyScoreCard({ daily, targets, meals }: Props) {
  const t = useT()
  const total = daily?.total_score ?? 15
  const rounded = Math.round(total)
  const ringColor = scoreColor(rounded)

  const dailyMacros = sumMacros(meals)

  return (
    <>
      <Card
        pad={20}
        elev
        style={{ marginBottom: 16, position: 'relative', overflow: 'hidden' }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -60,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: ringColor + '22',
            filter: 'blur(50px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <ScoreRing score={rounded} size={224} />
          {daily && (
            <div
              style={{
                marginTop: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: t.surface2,
                border: `1px solid ${t.border}`,
                borderRadius: 999,
                padding: '6px 13px',
              }}
            >
              <TrendBadge value={null} size={13} />
              <span style={{ fontFamily: FONT_UI, fontSize: 12.5, color: t.textMute }}>
                {daily.meal_count} {daily.meal_count === 1 ? 'meal' : 'meals'} scored
              </span>
            </div>
          )}
          {!daily && (
            <div
              style={{
                marginTop: 14,
                fontFamily: FONT_UI,
                fontSize: 12.5,
                color: t.textMute,
              }}
            >
              Log a meal to begin
            </div>
          )}
        </div>
        <div style={{ height: 1, background: t.border, margin: '18px 0 16px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MacroBar
            icon="bolt"
            label="Calories"
            value={dailyMacros.kcal}
            target={Math.round(targets.daily_kcal_target)}
            unit="kcal"
            color={t.brand}
            delay={400}
          />
          <MacroBar
            icon="protein"
            label="Protein"
            value={dailyMacros.protein_g}
            target={Math.round(targets.daily_protein_target_g)}
            unit="g"
            color={t.cyan}
            delay={520}
          />
        </div>
      </Card>

      {daily && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel
            right={
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.textFaint }}>
                +15 timing baseline
              </span>
            }
          >
            Score breakdown
          </SectionLabel>
          <Card pad={14}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {COMPONENTS.map((c, i) => {
                const v = Math.round(Number(daily[c.key] ?? 0))
                return (
                  <div
                    key={c.key as string}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 4px',
                      borderRadius: 14,
                      background: t.surface2,
                    }}
                  >
                    <MiniRing score={v} size={48} stroke={5} delay={300 + i * 90} />
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontFamily: FONT_UI,
                          fontWeight: 700,
                          fontSize: 11,
                          color: t.text,
                          lineHeight: 1.1,
                        }}
                      >
                        {c.label}
                      </div>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: t.textFaint, marginTop: 2 }}>
                        {c.weight}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}

type MealMacros = {
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  sat_fat_g?: number
  sugar_g?: number
  sodium_mg?: number
  kcal?: number
}

function sumMacros(meals: Meal[]): { kcal: number; protein_g: number } {
  let kcal = 0
  let protein_g = 0
  for (const m of meals) {
    if (m.processing_status !== 'scored') continue
    const mac = ((m as unknown as { macros?: MealMacros | null }).macros) ?? {}
    kcal += Number(mac.kcal ?? 0)
    protein_g += Number(mac.protein_g ?? 0)
  }
  return { kcal: Math.round(kcal), protein_g: Math.round(protein_g * 10) / 10 }
}
