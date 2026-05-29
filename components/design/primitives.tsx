'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { useT } from './ThemeProvider'
import { FONT_DISPLAY, FONT_UI, FONT_MONO, scoreColor } from './theme'

export function Card({
  children,
  style = {},
  pad = 16,
  elev = false,
  onClick,
  glow,
}: {
  children: ReactNode
  style?: CSSProperties
  pad?: number
  elev?: boolean
  onClick?: () => void
  glow?: boolean
}) {
  const t = useT()
  return (
    <div
      onClick={onClick}
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 22,
        padding: pad,
        boxShadow: elev ? t.shadow : 'none',
        ...(glow ? { boxShadow: `0 0 0 1px ${t.brand}66, 0 10px 30px ${t.brandGlow}` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const t = useT()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 4px 10px' }}>
      <span
        style={{
          fontFamily: FONT_UI,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: t.textFaint,
        }}
      >
        {children}
      </span>
      {right}
    </div>
  )
}

export function Avatar({
  name,
  initials,
  hue = 200,
  size = 40,
  ring,
  dim = false,
}: {
  name?: string
  initials?: string
  hue?: number
  size?: number
  ring?: string
  dim?: boolean
}) {
  const fs = Math.round(size * 0.4)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        background: `linear-gradient(140deg, oklch(0.62 0.15 ${hue}), oklch(0.44 0.13 ${hue}))`,
        color: '#fff',
        fontFamily: FONT_DISPLAY,
        fontWeight: 800,
        fontSize: fs,
        boxShadow: ring ? `0 0 0 2.5px ${ring}` : 'none',
        opacity: dim ? 0.55 : 1,
        letterSpacing: 0.2,
      }}
    >
      {initials || (name ? name[0] : '?')}
    </div>
  )
}

export function TrendBadge({ value, size = 12 }: { value: number | null | undefined; size?: number }) {
  const t = useT()
  if (value === 0 || value == null) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: t.textFaint, fontFamily: FONT_MONO, fontSize: size }}>
        –
      </span>
    )
  }
  const up = value > 0
  const col = up ? scoreColor(88) : 'oklch(0.68 0.2 25)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: col, fontFamily: FONT_MONO, fontWeight: 600, fontSize: size }}>
      <Icon name={up ? 'arrow-up' : 'arrow-down'} size={size + 2} sw={2.6} color={col} />
      {Math.abs(value)}
    </span>
  )
}

export function IconBadge({
  name,
  size = 36,
  bg,
  color,
  sw = 2,
}: {
  name: IconName
  size?: number
  bg?: string
  color?: string
  sw?: number
}) {
  const t = useT()
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        background: bg || t.surface2,
        color: color || t.text,
      }}
    >
      <Icon name={name} size={Math.round(size * 0.56)} sw={sw} color={color || t.text} />
    </div>
  )
}

export function Chip({
  children,
  active,
  onClick,
  color,
  style = {},
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  color?: string
  style?: CSSProperties
}) {
  const t = useT()
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? 'transparent' : t.border}`,
        background: active ? (color || t.brand) : 'transparent',
        color: active ? (color ? '#fff' : t.brandText) : t.textMute,
        borderRadius: 999,
        padding: '8px 14px',
        cursor: 'pointer',
        fontFamily: FONT_UI,
        fontWeight: 600,
        fontSize: 13.5,
        transition: 'all .18s ease',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export type SegOption<V extends string> = V | { v: V; label: string }

export function SegTabs<V extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: SegOption<V>[]
  value: V
  onChange: (v: V) => void
  size?: 'sm' | 'md'
}) {
  const t = useT()
  const pad = size === 'sm' ? '7px 0' : '10px 0'
  const fs = size === 'sm' ? 13 : 14
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        background: t.surface2,
        borderRadius: 14,
        padding: 4,
        gap: 2,
        border: `1px solid ${t.border}`,
      }}
    >
      {options.map((o) => {
        const isObj = typeof o === 'object'
        const v = (isObj ? o.v : o) as V
        const label = isObj ? o.label : (o as string)
        const on = v === value
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            type="button"
            style={{
              border: 'none',
              cursor: 'pointer',
              borderRadius: 10,
              padding: pad,
              background: on ? t.surfaceHi : 'transparent',
              color: on ? t.text : t.textMute,
              fontFamily: FONT_UI,
              fontWeight: on ? 700 : 600,
              fontSize: fs,
              boxShadow: on ? (t.dark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.08)') : 'none',
              transition: 'all .15s ease',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function Button({
  children,
  onClick,
  kind = 'brand',
  full,
  icon,
  style = {},
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  kind?: 'brand' | 'surface' | 'ghost'
  full?: boolean
  icon?: IconName
  style?: CSSProperties
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const t = useT()
  const base: CSSProperties = {
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    borderRadius: 16,
    padding: '15px 20px',
    fontFamily: FONT_UI,
    fontWeight: 700,
    fontSize: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: full ? '100%' : undefined,
    transition: 'transform .1s ease, opacity .15s',
    opacity: disabled ? 0.45 : 1,
    letterSpacing: 0.2,
    whiteSpace: 'nowrap',
  }
  const kinds: Record<string, CSSProperties> = {
    brand:   { background: t.brand, color: t.brandText, boxShadow: `0 8px 24px ${t.brandGlow}` },
    surface: { background: t.surface2, color: t.text, border: `1px solid ${t.border}` },
    ghost:   { background: 'transparent', color: t.textMute },
  }
  const iconColor = (kinds[kind].color as string) || t.text
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'scale(0.97)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'none')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
      style={{ ...base, ...kinds[kind], ...style }}
    >
      {icon && <Icon name={icon} size={20} sw={2.4} color={iconColor} />}
      {children}
    </button>
  )
}
