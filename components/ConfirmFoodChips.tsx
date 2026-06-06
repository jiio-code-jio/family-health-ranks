'use client'

import { useState } from 'react'
import { PortionPicker, type Portion, type PortionDefaults } from './PortionPicker'
import { useT } from './design/ThemeProvider'
import { Icon } from './design/Icon'
import { FONT_UI } from './design/theme'

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

/**
 * One editable food row. Every item is identified + estimated by the model;
 * there is no taxonomy to swap to. The user can adjust the portion, remove an
 * item, or add a new one (which is sent to the model for a macro estimate).
 */
export type DraftItem = {
  draft_id: string
  display_name: string
  portion: Portion
  defaults: PortionDefaults
  description?: string
  llm_macros_per_100g: Per100g
  llm_category: Category
  llm_quality: Quality
}

type Props = {
  items: DraftItem[]
  onChange: (items: DraftItem[]) => void
  disabled?: boolean
}

const DEFAULT_PORTIONS_FALLBACK: PortionDefaults = { small: 80, medium: 150, large: 250 }

export function ConfirmFoodChips({ items, onChange, disabled }: Props) {
  const t = useT()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [estimating, setEstimating] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  function update(draft_id: string, patch: Partial<DraftItem>) {
    onChange(items.map((i) => (i.draft_id === draft_id ? { ...i, ...patch } : i)))
  }
  function remove(draft_id: string) {
    onChange(items.filter((i) => i.draft_id !== draft_id))
  }

  async function addNew() {
    const description = newName.trim()
    if (description.length < 2 || estimating) return
    setEstimating(true)
    setAddError(null)
    try {
      const res = await fetch('/api/foods/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const json = await res.json()
      if (!res.ok) {
        setAddError(typeof json.error === 'string' ? json.error : 'Could not estimate that item.')
        return
      }
      onChange([
        ...items,
        {
          draft_id: crypto.randomUUID(),
          display_name: titleCase(description),
          description,
          defaults: DEFAULT_PORTIONS_FALLBACK,
          portion: { size: 'medium', grams: DEFAULT_PORTIONS_FALLBACK.medium },
          llm_macros_per_100g: json.per_100g as Per100g,
          llm_category: json.category as Category,
          llm_quality: json.quality_tier as Quality,
        },
      ])
      setNewName('')
      setAdding(false)
    } catch {
      setAddError('Network error. Try again.')
    } finally {
      setEstimating(false)
    }
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item) => (
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

          {item.description && item.description !== item.display_name && (
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
        </li>
      ))}

      <li>
        {adding ? (
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 16,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addNew()
                if (e.key === 'Escape') { setAdding(false); setNewName(''); setAddError(null) }
              }}
              placeholder="e.g. grilled chicken breast"
              disabled={estimating}
              style={{
                width: '100%',
                background: t.surface2,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: '10px 12px',
                fontFamily: FONT_UI,
                fontSize: 14,
                color: t.text,
                outline: 'none',
              }}
            />
            {addError && (
              <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 12, color: 'oklch(0.68 0.2 25)' }}>{addError}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={addNew}
                disabled={estimating || newName.trim().length < 2}
                style={{
                  flex: 1,
                  border: 'none',
                  background: t.brand,
                  color: t.brandText,
                  borderRadius: 12,
                  padding: '10px',
                  cursor: estimating ? 'default' : 'pointer',
                  fontFamily: FONT_UI,
                  fontWeight: 700,
                  fontSize: 13,
                  opacity: estimating || newName.trim().length < 2 ? 0.5 : 1,
                }}
              >
                {estimating ? 'Estimating…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewName(''); setAddError(null) }}
                disabled={estimating}
                style={{
                  border: `1px solid ${t.border}`,
                  background: 'transparent',
                  color: t.textMute,
                  borderRadius: 12,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontFamily: FONT_UI,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
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

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
