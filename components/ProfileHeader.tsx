'use client'

import { useT } from './design/ThemeProvider'
import { Avatar } from './design/primitives'
import { Icon } from './design/Icon'
import { FONT_DISPLAY, FONT_UI } from './design/theme'

function hueFromName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h % 360
}

export function ProfileHeader({
  displayName,
  rank,
  streak,
  bestDay,
  unsavedPrompt,
}: {
  displayName: string
  rank: number | null
  streak: number
  bestDay: number
  unsavedPrompt?: boolean
}) {
  const t = useT()
  const hue = hueFromName(displayName)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <Avatar name={displayName} initials={displayName[0]} hue={hue} size={62} ring={t.brand} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: 25,
              color: t.text,
              lineHeight: 1,
            }}
          >
            {displayName}
          </div>
          <div style={{ fontFamily: FONT_UI, fontSize: 12.5, color: t.textMute, marginTop: 3 }}>
            {unsavedPrompt
              ? 'Tell us a bit about you so we can score your meals correctly.'
              : 'Update any time · new targets apply from today'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <Stat
          icon="trophy"
          color={t.gold}
          big={rank !== null ? `#${rank}` : '—'}
          sub="rank"
        />
        <Stat
          icon="flame"
          color="oklch(0.72 0.2 40)"
          big={String(streak)}
          sub="streak"
        />
        <Stat
          icon="medal"
          color={t.brand}
          big={bestDay > 0 ? String(bestDay) : '—'}
          sub="best day"
        />
      </div>
    </>
  )
}

function Stat({
  icon,
  color,
  big,
  sub,
}: {
  icon: 'trophy' | 'flame' | 'medal'
  color: string
  big: string
  sub: string
}) {
  const t = useT()
  return (
    <div
      style={{
        flex: 1,
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: '12px 10px',
        textAlign: 'center',
      }}
    >
      <Icon name={icon} size={18} sw={2} color={color} style={{ margin: '0 auto 6px' }} />
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 19,
          color: t.text,
          lineHeight: 1,
        }}
      >
        {big}
      </div>
      <div
        style={{
          fontFamily: FONT_UI,
          fontSize: 10.5,
          color: t.textFaint,
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {sub}
      </div>
    </div>
  )
}
