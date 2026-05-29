'use client'

import { useRouter } from 'next/navigation'
import { useT } from '@/components/design/ThemeProvider'
import { Icon } from '@/components/design/Icon'
import { MealPhoto } from '@/components/design/viz'
import { FONT_DISPLAY, FONT_MONO, FONT_UI } from '@/components/design/theme'

type Props = {
  imageUrl: string | null
  itemCount: number
  mealType: string
  eatenAt: string
  usedPremium: boolean
}

function hueFromString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

export function ConfirmHeader({ imageUrl, itemCount, mealType, eatenAt, usedPremium }: Props) {
  const t = useT()
  const router = useRouter()
  const eaten = new Date(eatenAt)
  const when = eaten.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
          }}
          aria-label="Back"
        >
          <Icon name="chevron-left" size={24} sw={2.4} color={t.text} />
        </button>
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: 20,
            color: t.text,
          }}
        >
          Confirm meal
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 18,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 12,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="meal"
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <MealPhoto hue={hueFromString(mealType)} />
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: FONT_UI,
              fontWeight: 700,
              fontSize: 14,
              color: t.text,
            }}
          >
            We found {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </div>
          <div
            style={{
              marginTop: 2,
              fontFamily: FONT_UI,
              fontSize: 12,
              color: t.textMute,
            }}
          >
            Tweak portions or swap any item, then score it.
          </div>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              gap: 8,
              fontFamily: FONT_MONO,
              fontSize: 10.5,
              color: t.textFaint,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            <span>{mealType}</span>
            <span>·</span>
            <span>{when}</span>
            {usedPremium && (
              <>
                <span>·</span>
                <span style={{ color: t.brand }}>premium AI</span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
