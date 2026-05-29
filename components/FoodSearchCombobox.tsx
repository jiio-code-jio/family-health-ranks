'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from './design/ThemeProvider'
import { FONT_MONO, FONT_UI } from './design/theme'
import { Icon } from './design/Icon'

export type FoodSearchResult = {
  id: string
  display_name: string
  category: string
  quality_tier: string
  default_portion_g: { small: number; medium: number; large: number }
}

type Props = {
  onSelect: (food: FoodSearchResult) => void
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
  initialQuery?: string
}

export function FoodSearchCombobox({
  onSelect,
  onCancel,
  placeholder = 'Search foods…',
  autoFocus,
  initialQuery,
}: Props) {
  const t = useT()
  const [q, setQ] = useState(initialQuery ?? '')
  const [results, setResults] = useState<FoodSearchResult[]>([])
  const [busy, setBusy] = useState(false)
  const debounce = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
      if (initialQuery) inputRef.current?.select()
    }
  }, [autoFocus, initialQuery])

  useEffect(() => {
    if (debounce.current) window.clearTimeout(debounce.current)
    debounce.current = window.setTimeout(async () => {
      setBusy(true)
      try {
        const url = `/api/foods${q ? `?q=${encodeURIComponent(q)}` : ''}`
        const res = await fetch(url)
        const json = (await res.json()) as { foods?: FoodSearchResult[] }
        setResults(json.foods ?? [])
      } finally {
        setBusy(false)
      }
    }, 180)
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current)
    }
  }, [q])

  return (
    <div
      style={{
        background: t.surface2,
        border: `1px solid ${t.borderHi}`,
        borderRadius: 14,
        padding: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: '8px 12px',
            color: t.text,
            fontFamily: FONT_UI,
            fontSize: 14,
            outline: 'none',
          }}
        />
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'inline-flex',
              alignItems: 'center',
              color: t.textMute,
            }}
            aria-label="Cancel"
          >
            <Icon name="close" size={18} sw={2.2} color={t.textMute} />
          </button>
        )}
      </div>
      <ul style={{ marginTop: 8, maxHeight: 256, overflowY: 'auto', listStyle: 'none', padding: 0 }}>
        {busy && (
          <li
            style={{
              padding: '6px 8px',
              fontFamily: FONT_UI,
              fontSize: 12,
              color: t.textFaint,
            }}
          >
            searching…
          </li>
        )}
        {!busy && results.length === 0 && (
          <li
            style={{
              padding: '6px 8px',
              fontFamily: FONT_UI,
              fontSize: 12,
              color: t.textFaint,
            }}
          >
            No matches. Try a simpler word.
          </li>
        )}
        {results.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 10px',
                borderRadius: 8,
                textAlign: 'left',
                color: t.text,
                fontFamily: FONT_UI,
                fontSize: 13.5,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceHi)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{r.display_name}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: t.textFaint }}>
                {r.category} · {r.quality_tier}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
