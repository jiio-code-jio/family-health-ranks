'use client'

import { useState } from 'react'
import { PortionPicker, type Portion, type PortionDefaults } from './PortionPicker'
import { FoodSearchCombobox, type FoodSearchResult } from './FoodSearchCombobox'

type Per100g = {
  protein_g: number; carbs_g: number; fat_g: number; fiber_g: number
  sat_fat_g: number; sugar_g: number; sodium_mg: number; kcal: number
}
type Category =
  | 'grain' | 'protein' | 'vegetable' | 'fruit' | 'dairy'
  | 'snack' | 'beverage' | 'mixed_dish' | 'fat_oil' | 'sweet'
type Quality = 'whole_foods' | 'mixed' | 'processed' | 'ultra_processed'

export type DraftItem = {
  draft_id: string
  food_id: string | null              // taxonomy match; null = LLM-estimate
  display_name: string                // what we show on the chip
  portion: Portion
  defaults: PortionDefaults
  description?: string                // the LLM's original phrasing (for context)
  candidates?: Array<{ food_id: string; display_name: string }>  // shown as quick-swap chips
  // LLM-estimate fallback fields. Required when food_id is null so we can
  // still score the meal without a taxonomy match. Optional when food_id is
  // set (we use taxonomy macros at score time, but keeping these around lets
  // the user toggle between sources later if we add that feature).
  llm_macros_per_100g?: Per100g
  llm_category?: Category
  llm_quality?: Quality
}

type Props = {
  items: DraftItem[]
  onChange: (items: DraftItem[]) => void
  disabled?: boolean
}

const DEFAULT_PORTIONS_FALLBACK: PortionDefaults = { small: 80, medium: 150, large: 250 }

export function ConfirmFoodChips({ items, onChange, disabled }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null) // chip currently in "swap food" mode
  const [adding, setAdding] = useState(false)

  function update(draft_id: string, patch: Partial<DraftItem>) {
    onChange(items.map((i) => i.draft_id === draft_id ? { ...i, ...patch } : i))
  }
  function remove(draft_id: string) {
    onChange(items.filter((i) => i.draft_id !== draft_id))
    if (editingId === draft_id) setEditingId(null)
  }
  function pickReplacement(draft_id: string, picked: FoodSearchResult) {
    const defaults = picked.default_portion_g ?? DEFAULT_PORTIONS_FALLBACK
    // Swapping to a taxonomy item: clear the LLM-estimate fallback fields
    // since they're no longer needed (taxonomy macros take over).
    update(draft_id, {
      food_id: picked.id,
      display_name: picked.display_name,
      defaults,
      portion: { size: 'medium', grams: defaults.medium },
      llm_macros_per_100g: undefined,
      llm_category: undefined,
      llm_quality: undefined,
    })
    setEditingId(null)
  }
  function pickFromCandidate(draft_id: string, food_id: string, display_name: string) {
    const item = items.find((i) => i.draft_id === draft_id)
    const defaults = item?.defaults ?? DEFAULT_PORTIONS_FALLBACK
    update(draft_id, {
      food_id,
      display_name,
      portion: item?.portion?.size && item.portion.size !== 'custom'
        ? { size: item.portion.size, grams: defaults[item.portion.size] }
        : { size: 'medium', grams: defaults.medium },
      llm_macros_per_100g: undefined,
      llm_category: undefined,
      llm_quality: undefined,
    })
  }
  function addNew(picked: FoodSearchResult) {
    const defaults = picked.default_portion_g ?? DEFAULT_PORTIONS_FALLBACK
    onChange([
      ...items,
      {
        draft_id: crypto.randomUUID(),
        food_id: picked.id,
        display_name: picked.display_name,
        defaults,
        portion: { size: 'medium', grams: defaults.medium },
      },
    ])
    setAdding(false)
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const isLlmEstimate = item.food_id === null
        return (
          <li key={item.draft_id} className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.display_name || item.description}</p>
                  {isLlmEstimate && (
                    <span
                      title="Macros estimated by the AI — not in our verified taxonomy. Tap Change food to swap to a curated entry."
                      className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0 text-[10px] font-medium text-indigo-700 dark:text-indigo-300"
                    >
                      AI estimate
                    </span>
                  )}
                </div>
                {isLlmEstimate && item.description && item.description !== item.display_name && (
                  <p className="mt-0.5 text-xs italic opacity-60">“{item.description}”</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(item.draft_id)}
                disabled={disabled}
                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 disabled:opacity-40"
              >
                Remove
              </button>
            </div>

            <div className="mt-2 space-y-2">
              <PortionPicker
                value={item.portion}
                defaults={item.defaults}
                onChange={(p) => update(item.draft_id, { portion: p })}
                disabled={disabled}
              />

              {/* Quick-swap chips: candidates surfaced by the resolver. Useful
                  for LLM-estimate items where a near-miss taxonomy entry might
                  be better than the LLM's macros guess. Also handy on
                  resolved items if the LLM picked the wrong one. */}
              {(item.candidates ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide opacity-50">Or:</span>
                  {item.candidates!.map((c) => (
                    <button
                      key={c.food_id}
                      type="button"
                      onClick={() => pickFromCandidate(item.draft_id, c.food_id, c.display_name)}
                      className="rounded-full border border-black/15 px-2 py-0.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
                    >
                      {c.display_name}
                    </button>
                  ))}
                </div>
              )}

              {editingId === item.draft_id ? (
                <FoodSearchCombobox
                  autoFocus
                  initialQuery={cleanDescription(item.description ?? item.display_name)}
                  onSelect={(f) => pickReplacement(item.draft_id, f)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingId(item.draft_id)}
                  className="text-xs underline opacity-60 hover:opacity-100"
                >
                  Change food
                </button>
              )}
            </div>
          </li>
        )
      })}

      <li>
        {adding ? (
          <FoodSearchCombobox autoFocus onSelect={addNew} onCancel={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={disabled}
            className="w-full rounded-md border border-dashed border-black/20 px-3 py-2 text-sm opacity-70 hover:opacity-100 dark:border-white/20"
          >
            + Add a food
          </button>
        )}
      </li>
    </ul>
  )
}

// Strip surrounding quotes / parens / extra whitespace so the search query is
// just keywords. ASCII + smart-quote characters.
function cleanDescription(s: string): string {
  return s
    .replace(/^[\s'"“”‘’(\[\{]+/, '')
    .replace(/[\s'"“”‘’)\]\}]+$/, '')
    .trim()
}
