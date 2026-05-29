'use client'

import { useEffect, useState } from 'react'
import { useT } from './design/ThemeProvider'
import { Card, SectionLabel } from './design/primitives'
import { Icon } from './design/Icon'
import { FONT_MONO, FONT_UI } from './design/theme'

type Invite = { token: string; used_count: number; created_at: string }

export function InviteCard() {
  const t = useT()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [loading, setLoading] = useState(true)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/admin/invite')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((d: Invite) => alive && setInvite(d))
      .catch(() => alive && setError('Could not load invite link.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const link = invite
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join?invite=${invite.token}`
    : ''

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  async function rotate() {
    if (!confirm('Rotate the invite link? The old link stops working immediately.')) return
    setRotating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/invite', { method: 'POST' })
      if (!res.ok) throw new Error('rotate failed')
      setInvite((await res.json()) as Invite)
    } catch {
      setError('Could not rotate the link.')
    } finally {
      setRotating(false)
    }
  }

  return (
    <div>
      <SectionLabel
        right={
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10.5,
              color: t.textFaint,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            admin
          </span>
        }
      >
        Family invite link
      </SectionLabel>
      <Card pad={14}>
        <p
          style={{
            margin: 0,
            fontFamily: FONT_UI,
            fontSize: 12.5,
            color: t.textMute,
          }}
        >
          Share this once. Anyone who opens it creates their own account — no codes to hand out.
        </p>

        {loading ? (
          <p
            style={{
              marginTop: 12,
              fontFamily: FONT_UI,
              fontSize: 13,
              color: t.textFaint,
            }}
          >
            Loading…
          </p>
        ) : error && !invite ? (
          <p
            style={{
              marginTop: 12,
              fontFamily: FONT_UI,
              fontSize: 13,
              color: 'oklch(0.68 0.2 25)',
            }}
          >
            {error}
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: t.surface2,
                  border: `1px solid ${t.border}`,
                  borderRadius: 10,
                  padding: '8px 10px',
                  color: t.text,
                  fontFamily: FONT_MONO,
                  fontSize: 11.5,
                  outline: 'none',
                  textOverflow: 'ellipsis',
                }}
              />
              <button
                type="button"
                onClick={copy}
                style={{
                  flexShrink: 0,
                  background: t.brand,
                  color: t.brandText,
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontFamily: FONT_UI,
                  fontWeight: 700,
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {copied ? (
                  <>
                    <Icon name="check" size={14} sw={2.6} color={t.brandText} />
                    Copied
                  </>
                ) : (
                  'Copy'
                )}
              </button>
            </div>
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10.5,
                  color: t.textFaint,
                }}
              >
                {invite ? `${invite.used_count} joined via this link` : ''}
              </span>
              <button
                type="button"
                onClick={rotate}
                disabled={rotating}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: rotating ? 'default' : 'pointer',
                  fontFamily: FONT_UI,
                  fontSize: 11,
                  color: t.textMute,
                  opacity: rotating ? 0.4 : 1,
                  padding: 0,
                }}
              >
                {rotating ? 'Rotating…' : 'Rotate link'}
              </button>
            </div>
            {error && invite && (
              <p
                style={{
                  marginTop: 6,
                  fontFamily: FONT_UI,
                  fontSize: 11,
                  color: 'oklch(0.68 0.2 25)',
                }}
              >
                {error}
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
