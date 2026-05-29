'use client'

import { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { useT } from './design/ThemeProvider'
import { FONT_MONO, FONT_UI } from './design/theme'
import { Icon } from './design/Icon'

type Props = {
  onFile: (file: File | null) => void
  disabled?: boolean
}

const COMPRESS_OPTS = {
  maxSizeMB: 0.2,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.85,
}

/**
 * Capture surface styled like the design's full-bleed viewfinder. The two
 * separate inputs (camera vs gallery) keep iOS Safari from collapsing the
 * picker into one mode.
 */
export function CameraCapture({ onFile, disabled }: Props) {
  const t = useT()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [info, setInfo] = useState<{ kb: number; w: number; h: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragHot, setDragHot] = useState(false)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function processFile(raw: File): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const SKIP_BELOW_BYTES = 250 * 1024
      const isCompressedType = raw.type === 'image/jpeg' || raw.type === 'image/webp'
      const dimsRaw = await imageDims(URL.createObjectURL(raw)).catch(() => null)
      const alreadySmallEnough = isCompressedType
        && raw.size < SKIP_BELOW_BYTES
        && (!dimsRaw || (dimsRaw.w <= 1280 && dimsRaw.h <= 1280))

      const compressed = alreadySmallEnough ? raw : await imageCompression(raw, COMPRESS_OPTS)
      const url = URL.createObjectURL(compressed)
      const dims = dimsRaw && alreadySmallEnough ? dimsRaw : await imageDims(url)
      setPreview(url)
      setInfo({ kb: Math.round(compressed.size / 1024), w: dims.w, h: dims.h })
      onFile(compressed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'compression failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0]
    if (!raw) return
    await processFile(raw)
    if (e.target) e.target.value = ''
  }

  function onDragOver(e: React.DragEvent) {
    if (disabled || busy) return
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    setDragHot(true)
  }
  function onDragLeave(e: React.DragEvent) {
    if (e.currentTarget === e.target) setDragHot(false)
  }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragHot(false)
    if (disabled || busy) return
    const files = Array.from(e.dataTransfer.files)
    const img = files.find((f) => f.type.startsWith('image/'))
    if (!img) {
      setError(files.length > 0 ? 'That file isn’t an image.' : 'Drop an image file.')
      return
    }
    await processFile(img)
  }

  return (
    <div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleInput}
        disabled={disabled || busy}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleInput}
        disabled={disabled || busy}
      />

      {/* Viewfinder */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !preview && !busy && cameraRef.current?.click()}
        style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          width: '100%',
          borderRadius: 26,
          overflow: 'hidden',
          background: t.dark ? '#0E1110' : '#1A1D1B',
          border: `1px solid ${dragHot ? t.brand : t.border}`,
          boxShadow: dragHot ? `0 0 0 4px ${t.brandGlow}` : 'none',
          cursor: preview || busy ? 'default' : 'pointer',
          transition: 'box-shadow .15s ease, border-color .15s ease',
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="meal"
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'repeating-linear-gradient(135deg, oklch(0.32 0.04 140) 0 12px, oklch(0.28 0.04 140) 12px 24px)',
              opacity: 0.6,
            }}
          />
        )}
        {!preview && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />}

        {/* Corner brackets */}
        {!preview &&
          (
            [
              [0, 0],
              [1, 0],
              [0, 1],
              [1, 1],
            ] as Array<[0 | 1, 0 | 1]>
          ).map(([x, y], i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 34,
                height: 34,
                ...(y ? { bottom: 24 } : { top: 24 }),
                ...(x ? { right: 24 } : { left: 24 }),
                borderTop: y ? 'none' : '3px solid #fff',
                borderBottom: y ? '3px solid #fff' : 'none',
                borderLeft: x ? 'none' : '3px solid #fff',
                borderRight: x ? '3px solid #fff' : 'none',
                borderRadius: 4,
                opacity: 0.9,
                pointerEvents: 'none',
              }}
            />
          ))}

        {/* Hint */}
        {!preview && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 22,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.9)',
              fontFamily: FONT_UI,
              fontSize: 13,
            }}
          >
            <Icon
              name="camera"
              size={20}
              sw={2}
              color="#fff"
              style={{ margin: '0 auto 6px' }}
            />
            <div>{busy ? 'Compressing…' : dragHot ? 'Drop to add' : 'Tap to capture, or drop a photo'}</div>
          </div>
        )}
      </div>

      {/* Shutter row */}
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
        }}
      >
        <CircBtn icon="gallery" label="Gallery" onClick={() => galleryRef.current?.click()} disabled={disabled || busy} />
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={disabled || busy}
          style={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            border: '4px solid rgba(255,255,255,0.3)',
            background: 'transparent',
            cursor: disabled || busy ? 'default' : 'pointer',
            display: 'grid',
            placeItems: 'center',
            padding: 4,
            opacity: disabled || busy ? 0.4 : 1,
          }}
          aria-label="Take photo"
        >
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#fff' }} />
        </button>
        <CircBtn
          icon="close"
          label="Clear"
          onClick={() => {
            setPreview(null)
            setInfo(null)
            onFile(null)
          }}
          disabled={!preview || busy}
        />
      </div>

      {/* Status */}
      {(info || error) && (
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          {info && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.textFaint }}>
              {info.kb} KB · {info.w}×{info.h}
            </span>
          )}
          {error && (
            <span style={{ fontFamily: FONT_UI, fontSize: 12, color: 'oklch(0.68 0.2 25)' }}>{error}</span>
          )}
        </div>
      )}
    </div>
  )
}

function CircBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: 'gallery' | 'close' | 'flash' | 'user'
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: t.dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.18)',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        display: 'grid',
        placeItems: 'center',
        opacity: disabled ? 0.35 : 1,
        backdropFilter: 'blur(8px)',
      }}
    >
      <Icon name={icon} size={20} sw={2.2} color="#fff" />
    </button>
  )
}

function imageDims(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}
