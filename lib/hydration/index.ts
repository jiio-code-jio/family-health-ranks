/**
 * Hydration helpers.
 *
 * Daily water target uses the common clinical heuristic of ~35 ml per kg of
 * body weight, clamped to a sane band so very light / very heavy profiles still
 * get a reasonable goal. When we don't know the user's weight we fall back to a
 * flat 2.5 L so the Hydration component can still be computed.
 */

const ML_PER_KG = 35
const MIN_TARGET_ML = 1800
const MAX_TARGET_ML = 4000
const DEFAULT_TARGET_ML = 2500

export const GLASS_ML = 250

export function waterTargetMl(weightKg: number | null | undefined): number {
  const w = Number(weightKg)
  if (!Number.isFinite(w) || w <= 0) return DEFAULT_TARGET_ML
  return clamp(MIN_TARGET_ML, MAX_TARGET_ML, Math.round((w * ML_PER_KG) / 50) * 50)
}

/** Hydration component (0-100): how close the day's intake is to target, capped. */
export function hydrationScore(waterMl: number, targetMl: number): number {
  if (targetMl <= 0) return 100 // can't measure → neutral, don't penalize
  return clamp(0, 100, Math.round((waterMl / targetMl) * 100))
}

function clamp(lo: number, hi: number, x: number): number {
  return Math.max(lo, Math.min(hi, x))
}
