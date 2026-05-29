'use client'

import { useState } from 'react'
import { useT } from './design/ThemeProvider'
import { SegTabs } from './design/primitives'
import { FONT_MONO, FONT_UI } from './design/theme'

export type PortionSize = 'small' | 'medium' | 'large' | 'custom'

export type Portion = { size: PortionSize; grams: number }

export type PortionDefaults = { small: number; medium: number; large: number }

type Props = {
  value: Portion
  defaults: PortionDefaults
  onChange: (next: Portion) => void
  disabled?: boolean
}

type Preset = 'small' | 'medium' | 'large'

export function PortionPicker({ value, defaults, onChange, disabled }: Props) {
  const t = useT()
  const [customText, setCustomText] = useState(value.size === 'custom' ? String(value.grams) : '')

  function pickSize(size: Preset) {
    onChange({ size, grams: defaults[size] })
    setCustomText('')
  }
  function setCustom(text: string) {
    setCustomText(text)
    const n = Number(text)
    if (Number.isFinite(n) && n > 0 && n <= 2000) {
      onChange({ size: 'custom', grams: Math.round(n) })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SegTabs<Preset>
        size="sm"
        options={[
          { v: 'small', label: `Small · ${defaults.small} g` },
          { v: 'medium', label: `Medium · ${defaults.medium} g` },
          { v: 'large', label: `Large · ${defaults.large} g` },
        ]}
        value={value.size === 'custom' ? 'medium' : (value.size as Preset)}
        onChange={(v) => !disabled && pickSize(v)}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          min={1}
          max={2000}
          inputMode="numeric"
          placeholder="custom g"
          value={customText}
          onChange={(e) => setCustom(e.target.value)}
          disabled={disabled}
          style={{
            width: 86,
            background: t.surface2,
            border: `1px solid ${value.size === 'custom' ? t.brand : t.border}`,
            borderRadius: 10,
            padding: '6px 10px',
            color: t.text,
            fontFamily: FONT_MONO,
            fontSize: 13,
            outline: 'none',
          }}
        />
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: t.textFaint }}>
          = {value.grams} g
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: FONT_UI,
            fontSize: 10.5,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            color: t.textFaint,
          }}
        >
          {value.size === 'custom' ? 'custom' : value.size}
        </span>
      </div>
    </div>
  )
}
