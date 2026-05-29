'use client'

import { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'

type Props = {
  onFile: (file: File) => void
  disabled?: boolean
}

const COMPRESS_OPTS = {
  maxSizeMB: 0.2,           // ~200 KB target after compression
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.85,
}

/**
 * Two separate file inputs so the user can choose:
 *   - Camera button: file input with capture="environment" → opens camera directly.
 *   - Gallery button: plain file input → opens the photo library / file picker.
 * iOS Safari treats `capture` as a hard constraint and will hide the gallery,
 * so a single input can't offer both. Two inputs is the cleanest workaround.
 */
export function CameraCapture({ onFile, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [info, setInfo] = useState<{ kb: number; w: number; h: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragHot, setDragHot] = useState(false)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  // Compress + emit. Shared between file-input change handlers AND drag-drop.
  async function processFile(raw: File): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      // Skip compression when the source is already small + JPEG-ish — the
      // browser-image-compression library re-encodes everything via canvas,
      // which can take 1-3s on a phone even for a 200 KB file. Bypass when
      // we'd save almost nothing.
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
    // Reset the input so picking the same file twice in a row still fires onChange.
    if (e.target) e.target.value = ''
  }

  // Drag-drop handlers. We accept a single image file dropped anywhere on the
  // dropzone. Multiple files → take the first image. Non-images are ignored
  // with a friendly error rather than silently swallowed.
  function onDragOver(e: React.DragEvent) {
    if (disabled || busy) return
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault() // required so drop fires
    setDragHot(true)
  }
  function onDragLeave(e: React.DragEvent) {
    // Only un-hot when leaving the dropzone itself, not when entering a child.
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
    <div className="space-y-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInput}
        disabled={disabled || busy}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInput}
        disabled={disabled || busy}
      />

      {preview ? (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`overflow-hidden rounded-lg border transition ${dragHot ? 'border-foreground ring-2 ring-foreground/30' : 'border-black/10 dark:border-white/10'}`}
        >
          <img src={preview} alt="meal" className="block aspect-square w-full object-cover" />
        </div>
      ) : (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`grid aspect-square w-full place-items-center rounded-lg border-2 border-dashed text-center text-sm transition ${dragHot ? 'border-foreground bg-foreground/5 opacity-100' : 'border-black/20 opacity-60 dark:border-white/20'}`}
        >
          {busy ? 'Compressing…' : dragHot ? 'Drop to add' : (
            <span>
              Drop a photo here<br />
              <span className="opacity-70">or pick below</span>
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={disabled || busy}
          className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/5"
        >
          📷 Take photo
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={disabled || busy}
          className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/5"
        >
          🖼 Choose from gallery
        </button>
      </div>

      {info && <p className="text-xs opacity-60">{info.kb} KB · {info.w}×{info.h}{preview ? ' · tap a button above to replace' : ''}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
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
