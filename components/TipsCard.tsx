'use client'

import { Card, SectionLabel } from './design/primitives'
import { Icon } from './design/Icon'
import { useT } from './design/ThemeProvider'
import { FONT_UI, FONT_DISPLAY, FONT_MONO } from './design/theme'

export type WeeklyTips = {
  week_start: string
  tips: string[]
  weakest_component: string | null
}

const FOCUS_LABEL: Record<string, string> = {
  nutrition: 'meal quality',
  goal_alignment: 'targets',
  hydration: 'hydration',
  consistency: 'consistency',
}

export function TipsCard({ tips }: { tips: WeeklyTips }) {
  const t = useT()
  if (tips.tips.length === 0) return null
  const focus = tips.weakest_component ? FOCUS_LABEL[tips.weakest_component] : null

  return (
    <div style={{ marginBottom: 16 }}>
      <SectionLabel>Coach</SectionLabel>
      <Card
        pad={16}
        style={{
          background: t.dark ? 'oklch(0.22 0.05 290)' : 'oklch(0.96 0.03 290)',
          border: `1px solid ${t.dark ? 'oklch(0.4 0.1 290 / 0.5)' : 'oklch(0.8 0.08 290)'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="spark" size={18} sw={2} color={'oklch(0.7 0.18 290)'} />
          <span style={{ fontFamily: FONT_UI, fontWeight: 700, fontSize: 14, color: t.text }}>
            This week&apos;s focus
          </span>
          {focus && (
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: FONT_MONO,
                fontSize: 10.5,
                color: 'oklch(0.65 0.16 290)',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                background: 'oklch(0.7 0.16 290 / 0.16)',
                padding: '3px 8px',
                borderRadius: 6,
              }}
            >
              {focus}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {tips.tips.slice(0, 3).map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 9 }}>
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize: 13,
                  color: 'oklch(0.68 0.18 290)',
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontFamily: FONT_UI, fontSize: 13, color: t.textMute, lineHeight: 1.4 }}>{tip}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
