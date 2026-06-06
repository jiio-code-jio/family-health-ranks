/**
 * Rasterize app/icon.svg into every PNG the app needs:
 *   - app/icon.png          48×48   browser favicon raster fallback
 *   - app/apple-icon.png    180×180 iOS home-screen icon
 *   - public/icon-192.png   192×192 PWA manifest (maskable)
 *   - public/icon-512.png   512×512 PWA manifest (maskable)
 *
 * The SVG (app/icon.svg) is the single source of truth and is also served
 * directly as the modern browser favicon. Re-run after editing it:
 *   node scripts/gen-icons.mjs
 */
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../app/icon.svg', import.meta.url))

const targets = [
  ['app/icon.png', 48],
  ['app/apple-icon.png', 180],
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
]

for (const [path, size] of targets) {
  // High density first, then downscale → crisp edges at small sizes.
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(path)
  console.log(`wrote ${path} (${size}×${size})`)
}
