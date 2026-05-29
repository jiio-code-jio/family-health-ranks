'use client'

import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { useT } from './ThemeProvider'
import { FONT_DISPLAY, FONT_UI, FONT_MONO, scoreColor, scoreZone } from './theme'
import type { IconName } from './Icon'

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)

export function useProgress(run: boolean, dur = 1300, delay = 120): number {
  const [p, setP] = useState(run ? 0 : 1)
  useEffect(() => {
    if (!run) {
      setP(1)
      return
    }
    let raf = 0
    let start = 0
    const to = setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now
        const e = Math.min(1, (now - start) / dur)
        setP(easeOutCubic(e))
        if (e < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    const guarantee = setTimeout(() => setP(1), delay + dur + 250)
    return () => {
      clearTimeout(to)
      clearTimeout(guarantee)
      cancelAnimationFrame(raf)
    }
  }, [run, dur, delay])
  return p
}

export function ScoreRing({
  score,
  size = 216,
  stroke = 16,
  animate = true,
  delay = 150,
  label = "Today's score",
  sublabel,
  dur = 1400,
}: {
  score: number
  size?: number
  stroke?: number
  animate?: boolean
  delay?: number
  label?: string
  sublabel?: React.ReactNode
  dur?: number
}) {
  const t = useT()
  const p = useProgress(animate, dur, delay)
  const frac = (score / 100) * p
  const r = (size - stroke) / 2 - 8
  const cx = size / 2
  const cy = size / 2
  const C = 2 * Math.PI * r
  const col = scoreColor(score)
  const shown = Math.round(score * p)
  const endAngle = -90 + 360 * frac
  const endX = cx + r * Math.cos((endAngle * Math.PI) / 180)
  const endY = cy + r * Math.sin((endAngle * Math.PI) / 180)

  const N = 56
  const ticks = Array.from({ length: N }, (_, i) => {
    const ang = (i / N) * 360 - 90
    const lit = i / N <= frac
    const ro = r + stroke / 2 + 7
    const len = lit ? 6 : 4
    const x1 = cx + ro * Math.cos((ang * Math.PI) / 180)
    const y1 = cy + ro * Math.sin((ang * Math.PI) / 180)
    const x2 = cx + (ro - len) * Math.cos((ang * Math.PI) / 180)
    const y2 = cy + (ro - len) * Math.sin((ang * Math.PI) / 180)
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={lit ? col : t.track}
        strokeWidth={lit ? 2 : 1.5}
        strokeLinecap="round"
        opacity={lit ? 0.9 : 1}
      />
    )
  })

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ position: 'relative', zIndex: 1 }}>
        <g>{ticks}</g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.track} strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 10px ${col})` }}
        />
        {frac > 0.02 && (
          <circle
            cx={endX}
            cy={endY}
            r={stroke / 2 + 2}
            fill="#fff"
            style={{ filter: `drop-shadow(0 0 6px ${col})` }}
          />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: size * 0.34,
              lineHeight: 1,
              color: t.text,
              letterSpacing: -1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {shown}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: size * 0.07, color: t.textFaint, marginLeft: 2 }}>
            /100
          </span>
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: FONT_UI,
            fontWeight: 700,
            fontSize: 13,
            color: col,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
          }}
        >
          {scoreZone(score)}
        </div>
        <div style={{ marginTop: 2, fontFamily: FONT_UI, fontSize: 12.5, color: t.textMute }}>{label}</div>
        {sublabel}
      </div>
    </div>
  )
}

export function MiniRing({
  score,
  size = 46,
  stroke = 5,
  color,
  animate = true,
  delay = 300,
}: {
  score: number
  size?: number
  stroke?: number
  color?: string
  animate?: boolean
  delay?: number
}) {
  const t = useT()
  const p = useProgress(animate, 900, delay)
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const frac = (score / 100) * p
  const col = color || scoreColor(score)
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={col}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - frac)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="52%"
        dominantBaseline="middle"
        textAnchor="middle"
        style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size * 0.3, fill: t.text }}
      >
        {Math.round(score * p)}
      </text>
    </svg>
  )
}

export function MacroBar({
  icon,
  label,
  value,
  target,
  unit,
  color,
  delay = 200,
}: {
  icon: IconName
  label: string
  value: number
  target: number
  unit: string
  color?: string
  delay?: number
}) {
  const t = useT()
  const p = useProgress(true, 1100, delay)
  const pct = Math.min(100, (value / target) * 100) * p
  const col = color || t.brand
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <Icon name={icon} size={15} sw={2.2} color={t.textMute} />
        <span style={{ fontFamily: FONT_UI, fontSize: 13, color: t.textMute, flex: 1 }}>{label}</span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 13,
            color: t.text,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {Math.round(value)}
          <span style={{ color: t.textFaint }}>
            {' '}/ {target} {unit}
          </span>
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: t.track, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${col}aa, ${col})`,
            boxShadow: `0 0 10px ${col}88`,
          }}
        />
      </div>
    </div>
  )
}

export type WeekDay = { d: string; date: string; score: number | null; today?: boolean }

export function WeekChart({ days, maxH = 116, animate = true }: { days: WeekDay[]; maxH?: number; animate?: boolean }) {
  const t = useT()
  const p = useProgress(animate, 1000, 250)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: maxH + 44 }}>
      {days.map((d) => {
        const has = d.score != null
        const col = has ? scoreColor(d.score as number) : t.track
        const h = has ? ((d.score as number) / 100) * maxH * p : 6
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                fontWeight: 600,
                color: d.today ? t.brand : has ? t.textMute : t.textFaint,
                opacity: p > 0.6 ? 1 : 0,
              }}
            >
              {has ? Math.round(d.score as number) : '–'}
            </span>
            <div
              style={{
                width: '100%',
                height: maxH,
                display: 'flex',
                alignItems: 'flex-end',
                borderRadius: 10,
                background: t.dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
                padding: 3,
                boxSizing: 'border-box',
                outline: d.today ? `2px solid ${t.brand}` : 'none',
                outlineOffset: 1,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: h,
                  borderRadius: 8,
                  background: has ? `linear-gradient(180deg, ${col}, ${col}cc)` : t.track,
                  boxShadow: has ? `0 0 10px ${col}55` : 'none',
                  transition: 'height .25s ease',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: FONT_UI,
                fontSize: 11,
                fontWeight: 600,
                color: d.today ? t.brand : t.textFaint,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {d.d}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function WaterTank({
  ml,
  target,
  height = 92,
}: {
  ml: number
  target: number
  height?: number
}) {
  const t = useT()
  const p = useProgress(true, 1000, 200)
  const pct = Math.min(100, (ml / target) * 100)
  const fillPct = pct * p
  const glasses = Math.round(ml / 250)
  const cyan = t.cyan
  return (
    <div
      style={{
        position: 'relative',
        height,
        borderRadius: 18,
        overflow: 'hidden',
        background: t.dark ? 'rgba(61,214,255,0.06)' : 'rgba(15,182,230,0.06)',
        border: `1px solid ${t.border}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: `${fillPct}%`,
          background: `linear-gradient(180deg, ${cyan}cc, ${cyan}88)`,
          transition: 'height .3s ease',
        }}
      >
        <svg
          viewBox="0 0 1200 40"
          preserveAspectRatio="none"
          width="200%"
          height="16"
          style={{ position: 'absolute', top: -12, left: 0, animation: 'hrWave 5s linear infinite' }}
        >
          <path d="M0 20 Q150 0 300 20 T600 20 T900 20 T1200 20 V40 H0 Z" fill={cyan} opacity="0.9" />
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon name="water" size={20} sw={2.2} color={fillPct > 30 ? '#fff' : cyan} />
          <span style={{ fontFamily: FONT_UI, fontWeight: 700, fontSize: 15, color: fillPct > 35 ? '#fff' : t.text }}>
            Hydration
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: 19,
              color: fillPct > 45 ? '#fff' : t.text,
              lineHeight: 1,
            }}
          >
            {(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)}
            <span style={{ fontSize: 12, opacity: 0.7 }}> / {(target / 1000).toFixed(1)} L</span>
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: fillPct > 55 ? 'rgba(255,255,255,0.85)' : t.textMute,
              marginTop: 2,
            }}
          >
            {glasses} {glasses === 1 ? 'glass' : 'glasses'}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MealPhoto({
  hue = 120,
  label,
  height = '100%',
  radius = 0,
}: {
  hue?: number
  label?: string
  height?: number | string
  radius?: number
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: radius,
        overflow: 'hidden',
        background: `repeating-linear-gradient(135deg, oklch(0.5 0.08 ${hue}) 0 10px, oklch(0.45 0.08 ${hue}) 10px 20px)`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: 1,
            color: 'rgba(255,255,255,0.9)',
            textTransform: 'uppercase',
            background: 'rgba(0,0,0,0.35)',
            padding: '3px 8px',
            borderRadius: 6,
          }}
        >
          {label || 'meal photo'}
        </span>
      </div>
    </div>
  )
}
