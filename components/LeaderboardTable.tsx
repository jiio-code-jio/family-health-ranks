'use client'

import type { LeaderboardRow, Period } from '@/lib/scoring/leaderboard'
import { useT } from './design/ThemeProvider'
import { Avatar, Card, TrendBadge } from './design/primitives'
import { Icon } from './design/Icon'
import { FONT_DISPLAY, FONT_UI, FONT_MONO, scoreColor } from './design/theme'

type Props = {
  period: Period
  rows: LeaderboardRow[]
  currentUserId: string
  ineligibleCount: number
}

function hueFromString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

export function LeaderboardTable({ period, rows, currentUserId, ineligibleCount }: Props) {
  const t = useT()

  if (rows.length === 0) {
    return (
      <Card pad={20} style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: FONT_UI, fontSize: 13.5, color: t.textMute }}>
          No one is on the board yet for this period.
        </div>
        {ineligibleCount > 0 && (
          <div style={{ marginTop: 6, fontFamily: FONT_UI, fontSize: 12, color: t.textFaint }}>
            {ineligibleCount} participant{ineligibleCount === 1 ? '' : 's'} still building up enough days.
          </div>
        )}
      </Card>
    )
  }

  const showPodium = rows.length >= 3
  const top3 = rows.slice(0, 3)
  const rest = showPodium ? rows.slice(3) : rows

  return (
    <div>
      {showPodium && (
        <Card pad={16} elev style={{ marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -40,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: t.gold + '22',
              filter: 'blur(50px)',
            }}
          />
          <div style={{ position: 'relative' }}>
            <Podium rows={top3} currentUserId={currentUserId} />
          </div>
        </Card>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '0 4px 10px',
        }}
      >
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
          {showPodium ? 'The rest' : 'Standings'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rest.map((r, i) => (
          <RankRow
            key={r.user_id}
            r={r}
            idx={showPodium ? i + 4 : i + 1}
            period={period}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      {ineligibleCount > 0 && (
        <p
          style={{
            marginTop: 14,
            fontFamily: FONT_UI,
            fontSize: 12,
            color: t.textFaint,
            textAlign: 'center',
          }}
        >
          {ineligibleCount} other participant{ineligibleCount === 1 ? '' : 's'} still building up enough days.
        </p>
      )}
    </div>
  )
}

function Podium({ rows, currentUserId }: { rows: LeaderboardRow[]; currentUserId: string }) {
  const t = useT()
  // display columns left→right: rank2, rank1, rank3
  const order = [rows[1], rows[0], rows[2]].filter(Boolean) as LeaderboardRow[]
  const meta: Record<number, { h: number; col: string; label: string }> = {
    0: { h: 88, col: t.silver, label: '2' },
    1: { h: 116, col: t.gold, label: '1' },
    2: { h: 64, col: t.bronze, label: '3' },
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 8,
      }}
    >
      {order.map((r, di) => {
        const m = meta[di]
        const isFirst = di === 1
        const col = scoreColor(r.score)
        const you = r.user_id === currentUserId
        const hue = hueFromString(r.user_id)
        return (
          <div
            key={r.user_id}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            {isFirst && (
              <Icon
                name="crown"
                size={24}
                sw={2}
                color={t.gold}
                style={{ marginBottom: 4, filter: `drop-shadow(0 0 8px ${t.gold}88)` }}
              />
            )}
            <Avatar
              name={r.display_name}
              initials={r.display_name[0]}
              hue={hue}
              size={isFirst ? 62 : 50}
              ring={you ? t.brand : m.col}
            />
            <div
              style={{
                marginTop: 6,
                fontFamily: FONT_UI,
                fontWeight: 700,
                fontSize: 13,
                color: t.text,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {r.display_name}
              {you && (
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9,
                    color: t.brandText,
                    background: t.brand,
                    padding: '1px 5px',
                    borderRadius: 5,
                  }}
                >
                  YOU
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: isFirst ? 26 : 22,
                color: col,
                lineHeight: 1.1,
                marginTop: 1,
              }}
            >
              {Math.round(r.score)}
            </div>
            <div
              style={{
                width: '100%',
                height: m.h,
                marginTop: 8,
                borderRadius: '12px 12px 0 0',
                background: `linear-gradient(180deg, ${m.col}, ${m.col}00)`,
                position: 'relative',
                border: `1px solid ${m.col}55`,
                borderBottom: 'none',
                boxShadow: isFirst ? `0 0 30px ${t.gold}33` : 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 900,
                  fontSize: isFirst ? 34 : 26,
                  color: t.dark ? '#fff' : '#1a1a1a',
                  opacity: 0.92,
                }}
              >
                {m.label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RankRow({
  r,
  idx,
  period,
  currentUserId,
}: {
  r: LeaderboardRow
  idx: number
  period: Period
  currentUserId: string
}) {
  const t = useT()
  const col = scoreColor(r.score)
  const you = r.user_id === currentUserId
  const hue = hueFromString(r.user_id)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 16,
        background: you ? t.brand + (t.dark ? '14' : '18') : t.surface,
        border: `1px solid ${you ? t.brand + '88' : t.border}`,
        boxShadow: you ? `0 6px 20px ${t.brandGlow}` : 'none',
      }}
    >
      <span
        style={{
          width: 22,
          textAlign: 'center',
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 16,
          color: t.textFaint,
        }}
      >
        {idx}
      </span>
      <Avatar name={r.display_name} initials={r.display_name[0]} hue={hue} size={40} ring={you ? t.brand : undefined} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONT_UI,
            fontWeight: 700,
            fontSize: 15,
            color: t.text,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {r.display_name}
          {you && (
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 9,
                color: t.brandText,
                background: t.brand,
                padding: '1px 5px',
                borderRadius: 5,
              }}
            >
              YOU
            </span>
          )}
        </div>
        <div style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textMute, marginTop: 1 }}>
          {period === 'daily'
            ? `${r.meal_count} meal${r.meal_count === 1 ? '' : 's'} today`
            : `${r.days_logged} day${r.days_logged === 1 ? '' : 's'} · ${r.meal_count} meals`}
        </div>
      </div>
      <TrendBadge value={null} size={13} />
      <div
        style={{
          minWidth: 44,
          height: 36,
          borderRadius: 11,
          background: col + '22',
          border: `1px solid ${col}55`,
          display: 'grid',
          placeItems: 'center',
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 17,
          color: col,
        }}
      >
        {Math.round(r.score)}
      </div>
    </div>
  )
}
