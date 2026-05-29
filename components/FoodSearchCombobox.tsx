'use client'

import { useEffect, useRef, useState } from 'react'

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
  /** Pre-fills the input + triggers a search on open. Useful when launching
   *  the search from an unmatched chip — user lands on relevant matches
   *  without having to type. */
  initialQuery?: string
}

/**
 * Inline taxonomy search. Debounced fetch to /api/foods.
 * Used in the confirmation UI both for adding a new food and for swapping
 * one already in the draft list.
 */
export function FoodSearchCombobox({ onSelect, onCancel, placeholder = 'Search foods…', autoFocus, initialQuery }: Props) {
  const [q, setQ] = useState(initialQuery ?? '')
  const [results, setResults] = useState<FoodSearchResult[]>([])
  const [busy, setBusy] = useState(false)
  const debounce = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
      // Select the pre-filled text so a quick keystroke replaces it without
      // forcing the user to clear it character by character.
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
    return () => { if (debounce.current) window.clearTimeout(debounce.current) }
  }, [q])

  return (
    <div className="rounded-md border border-black/15 bg-background p-2 shadow-sm dark:border-white/20">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm focus:border-foreground focus:outline-none dark:border-white/20"
        />
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm opacity-70 hover:opacity-100">Cancel</button>
        )}
      </div>
      <ul className="mt-2 max-h-64 overflow-y-auto">
        {busy && <li className="px-2 py-1 text-xs opacity-50">searching…</li>}
        {!busy && results.length === 0 && (
          <li className="px-2 py-1 text-xs opacity-50">No matches. Try a simpler word.</li>
        )}
        {results.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              <span>{r.display_name}</span>
              <span className="text-[10px] opacity-50">{r.category} · {r.quality_tier}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
