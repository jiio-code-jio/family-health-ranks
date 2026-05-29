'use client'

import { useState } from 'react'
import { PortionPicker, type Portion, type PortionDefaults } from './PortionPicker'
import { FoodSearchCombobox, type FoodSearchResult } from './FoodSearchCombobox'
import { useT } from './design/ThemeProvider'
import { Icon } from './design/Icon'
import { FONT_MONO, FONT_UI } from './design/theme'

type Per100g = {
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sat_fat_g: number
  sugar_g: number
  sodium_mg: number
  kcal: number
}
type Category =
  | 'grain'
  | 'protein'
  | 'vegetable'
  | 'fruit'
  | 'dairy'
  | 'snack'
  | 'beverage'
  | 'mixed_dish'
  | 'fat_oil'
  | 'sweet'
type Quality = 'whole_foods' | 'mixed' | 'processed' | 'ultra_processed'

export type DraftItem = {
  draft_id: string
  food_id: string | null
  display_name: string
  portion: Portion
  defaults: PortionDefaults
  description?: string
  candidates?: Array<{ food_id: string; display_name: string }>
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
  const t = useT()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  function update(draft_id: string, patch: Partial<DraftItem>) {
    onChange(items.map((i) => (i.draft_id === draft_id ? { ...i, ...patch } : i)))
  }
  function remove(draft_id: string) {
    onChange(items.filter((i) => i.draft_id !== draft_id))
    if (editingId === draft_id) setEditingId(null)
  }
  function pickReplacement(draft_id: string, picked: FoodSearchResult) {
    const defaults = picked.default_portion_g ?? DEFAULT_PORTIONS_FALLBACK
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
      portion:
        item?.portion?.size && item.portion.size !== 'custom'
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
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item) => {
        const isLlmEstimate = item.food_id === null
        return (
          <li
            key={item.draft_id}
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <Icon name="fork" size={16} sw={2} color={t.textMute} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: FONT_UI,
                  fontWeight: 700,
                  fontSize: 14.5,
                  color: t.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.display_name || item.description}
              </span>
              {isLlmEstimate && (
                <span
                  title="Macros estimated by the AI — not in our verified taxonomy. Tap Change food to swap to a curated entry."
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9.5,
                    color: 'oklch(0.75 0.18 290)',
                    background: 'oklch(0.7 0.16 290 / 0.18)',
                    border: '1px solid oklch(0.7 0.16 290 / 0.4)',
                    borderRadius: 6,
                    padding: '2px 6px',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  AI est.
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(item.draft_id)}
                disabled={disabled}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: disabled ? 'default' : 'pointer',
                  padding: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  opacity: disabled ? 0.4 : 1,
                }}
                aria-label="Remove"
              >
                <Icon name="close" size={16} sw={2.2} color={t.textFaint} />
              </button>
            </div>

            {isLlmEstimate && item.description && item.description !== item.display_name && (
              <p
                style={{
                  margin: '0 0 10px',
                  fontFamily: FONT_UI,
                  fontStyle: 'italic',
                  fontSize: 12,
                  color: t.textFaint,
                }}
              >
                “{item.description}”
              </p>
            )}

            <PortionPicker
              value={item.portion}
              defaults={item.defaults}
              onChange={(p) => update(item.draft_id, { portion: p })}
              disabled={disabled}
            />

            {(item.candidates ?? []).length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: FONT_UI,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    color: t.textFaint,
                  }}
                >
                  Or:
                </span>
                {item.candidates!.map((c) => (
                  <button
                    key={c.food_id}
                    type="button"
                    onClick={() => pickFromCandidate(item.draft_id, c.food_id, c.display_name)}
                    style={{
                      border: `1px solid ${t.border}`,
                      background: t.surface2,
                      borderRadius: 999,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      color: t.textMute,
                      fontFamily: FONT_UI,
                      fontSize: 12,
                    }}
                  >
                    {c.display_name}
                  </button>
                ))}
              </div>
            )}

            {editingId === item.draft_id ? (
              <div style={{ marginTop: 10 }}>
                <FoodSearchCombobox
                  autoFocus
                  initialQuery={cleanDescription(item.description ?? item.display_name)}
                  onSelect={(f) => pickReplacement(item.draft_id, f)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingId(item.draft_id)}
                style={{
                  marginTop: 10,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: FONT_UI,
                  fontSize: 12,
                  color: t.textMute,
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Change food
              </button>
            )}
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
            style={{
              width: '100%',
              border: `1.5px dashed ${t.borderHi}`,
              background: 'transparent',
              borderRadius: 16,
              padding: '13px',
              cursor: disabled ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: FONT_UI,
              fontWeight: 700,
              fontSize: 13.5,
              color: t.textMute,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Icon name="plus" size={16} sw={2.4} color={t.textMute} /> Add another item
          </button>
        )}
      </li>
    </ul>
  )
}

function cleanDescription(s: string): string {
  return s
    .replace(/^[\s'"“”‘’(\[\{]+/, '')
    .replace(/[\s'"“”‘’)\]\}]+$/, '')
    .trim()
}
