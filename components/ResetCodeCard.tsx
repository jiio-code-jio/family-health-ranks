'use client'

import { useState } from 'react'
import { useT } from './design/ThemeProvider'
import { Button, Card, SectionLabel } from './design/primitives'
import { FONT_DISPLAY, FONT_UI } from './design/theme'

export function ResetCodeCard() {
  const t = useT()
  type Phase = 'idle' | 'confirming' | 'busy' | 'revealed'
  const [phase, setPhase] = useState<Phase>('idle')
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reset() {
    setPhase('busy')
    setError(null)
    try {
      const res = await fetch('/api/profile/reset-code', { method: 'POST' })
      const json = (await res.json()) as { ok?: boolean; code?: string; error?: string }
      if (!res.ok || !json.code) {
        setError(json.error ?? 'Could not reset code. Try again.')
        setPhase('confirming')
        return
      }
      setCode(json.code)
      setPhase('revealed')
    } catch {
      setError('Network error. Try again.')
      setPhase('confirming')
    }
  }

  async function copy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div>
      <SectionLabel>Login code</SectionLabel>
      <Card pad={14}>
        {phase === 'idle' && (
          <>
            <p
              style={{
                margin: 0,
                fontFamily: FONT_UI,
                fontSize: 12.5,
                color: t.textMute,
              }}
            >
              Need your code for a new device? Reset it here — we&apos;ll show the new one once.
            </p>
            <div style={{ marginTop: 12 }}>
              <Button kind="surface" onClick={() => setPhase('confirming')}>
                Reset &amp; reveal my code
              </Button>
            </div>
          </>
        )}

        {phase === 'confirming' && (
          <>
            <p
              style={{
                margin: 0,
                fontFamily: FONT_UI,
                fontSize: 12.5,
                color: t.textMute,
              }}
            >
              This invalidates your current code immediately. Continue?
            </p>
            {error && (
              <p
                style={{
                  margin: '8px 0 0',
                  fontFamily: FONT_UI,
                  fontSize: 12,
                  color: 'oklch(0.68 0.2 25)',
                }}
              >
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button kind="brand" onClick={reset}>
                Yes, reset it
              </Button>
              <Button
                kind="surface"
                onClick={() => {
                  setPhase('idle')
                  setError(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        )}

        {phase === 'busy' && (
          <p
            style={{
              margin: '8px 0 0',
              fontFamily: FONT_UI,
              fontSize: 12.5,
              color: t.textFaint,
            }}
          >
            Generating new code…
          </p>
        )}

        {phase === 'revealed' && code && (
          <>
            <p
              style={{
                margin: '6px 0 0',
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: 22,
                color: t.text,
                letterSpacing: 4,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {code}
            </p>
            <p
              style={{
                margin: '6px 0 0',
                fontFamily: FONT_UI,
                fontSize: 12.5,
                color: t.textMute,
              }}
            >
              Save this — it&apos;s shown only once. If you lose it again, come back here to reset.
            </p>
            <div style={{ marginTop: 12 }}>
              <Button kind="brand" onClick={copy} icon={copied ? 'check' : undefined}>
                {copied ? 'Copied' : 'Copy code'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
