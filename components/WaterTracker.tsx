'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Card, SectionLabel } from './design/primitives'
import { WaterTank } from './design/viz'
import { Icon } from './design/Icon'
import { useT } from './design/ThemeProvider'
import { FONT_UI } from './design/theme'

type WaterState = { ml: number; target_ml: number; date: string }

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<WaterState>)

type Props = {
  initial: WaterState
}

export function WaterTracker({ initial }: Props) {
  const t = useT()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const { data, mutate } = useSWR('/api/water', fetcher, {
    fallbackData: initial,
    revalidateOnFocus: true,
  })

  const ml = data?.ml ?? 0
  const target = data?.target_ml ?? initial.target_ml

  async function adjust(delta: number) {
    if (busy) return
    setBusy(true)
    const optimistic = { ...(data ?? initial), ml: Math.max(0, ml + delta) }
    await mutate(optimistic, { revalidate: false })
    try {
      const res = await fetch('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta_ml: delta }),
      })
      if (!res.ok) {
        await mutate()
        return
      }
      const json = (await res.json()) as WaterState
      await mutate(json, { revalidate: false })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <SectionLabel>Hydration</SectionLabel>
      <Card pad={14}>
        <WaterTank ml={ml} target={target} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <PillBtn onClick={() => adjust(250)} color={t.cyan} disabled={busy}>
            <Icon name="plus" size={14} sw={2.6} color={t.cyan} /> Glass
          </PillBtn>
          <PillBtn onClick={() => adjust(500)} color={t.cyan} disabled={busy}>
            <Icon name="plus" size={14} sw={2.6} color={t.cyan} /> Bottle
          </PillBtn>
          <PillBtn onClick={() => adjust(-250)} muted disabled={busy || ml === 0}>
            <Icon name="minus" size={14} sw={2.6} color={t.textMute} /> Undo
          </PillBtn>
        </div>
      </Card>
    </div>
  )
}

function PillBtn({
  children,
  onClick,
  color,
  muted,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  color?: string
  muted?: boolean
  disabled?: boolean
}) {
  const t = useT()
  const c = color ?? t.cyan
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        border: `1px solid ${muted ? t.border : c + '55'}`,
        background: muted ? 'transparent' : c + '14',
        color: muted ? t.textMute : c,
        borderRadius: 12,
        padding: '10px 6px',
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        fontFamily: FONT_UI,
        fontWeight: 700,
        fontSize: 13.5,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  )
}
