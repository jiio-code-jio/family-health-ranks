'use client'

import { useState } from 'react'

export type PortionSize = 'small' | 'medium' | 'large' | 'custom'

export type Portion = { size: PortionSize; grams: number }

export type PortionDefaults = { small: number; medium: number; large: number }

type Props = {
  value: Portion
  defaults: PortionDefaults
  onChange: (next: Portion) => void
  disabled?: boolean
}

const SIZES: { value: 'small' | 'medium' | 'large'; label: string }[] = [
  { value: 'small',  label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large',  label: 'L' },
]

export function PortionPicker({ value, defaults, onChange, disabled }: Props) {
  const [customText, setCustomText] = useState(
    value.size === 'custom' ? String(value.grams) : ''
  )

  function pickSize(size: 'small' | 'medium' | 'large') {
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
    <div className="flex items-center gap-2 text-xs">
      {SIZES.map((s) => {
        const active = value.size === s.value
        return (
          <button
            key={s.value}
            type="button"
            disabled={disabled}
            onClick={() => pickSize(s.value)}
            title={`${defaults[s.value]} g`}
            className={`rounded-md px-2 py-1 ${active ? 'bg-foreground text-background' : 'border border-black/15 dark:border-white/20'}`}
          >
            {s.label}
            <span className="ml-1 opacity-60">{defaults[s.value]}g</span>
          </button>
        )
      })}
      <input
        type="number"
        min={1}
        max={2000}
        inputMode="numeric"
        placeholder="g"
        value={customText}
        onChange={(e) => setCustom(e.target.value)}
        disabled={disabled}
        className={`w-16 rounded-md border bg-transparent px-2 py-1 ${value.size === 'custom' ? 'border-foreground' : 'border-black/15 dark:border-white/20'}`}
      />
      <span className="opacity-60">{value.grams}g total</span>
    </div>
  )
}
