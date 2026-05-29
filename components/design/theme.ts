export type AccentKey = 'lime' | 'cyan' | 'coral' | 'violet'

export const ACCENTS: Record<AccentKey, { brand: string; brandText: string; name: string }> = {
  lime:   { brand: '#CBFF3C', brandText: '#10160A', name: 'Volt' },
  cyan:   { brand: '#46E5D0', brandText: '#062420', name: 'Mint' },
  coral:  { brand: '#FF6A4D', brandText: '#1B0905', name: 'Ember' },
  violet: { brand: '#A98BFF', brandText: '#120A24', name: 'Ultra' },
}

export type Theme = {
  dark: boolean
  accentKey: AccentKey
  bg: string
  bgElev: string
  surface: string
  surface2: string
  surfaceHi: string
  border: string
  borderHi: string
  text: string
  textMute: string
  textFaint: string
  brand: string
  brandText: string
  brandGlow: string
  cyan: string
  gold: string
  silver: string
  bronze: string
  shadow: string
  track: string
}

export function makeTheme(dark: boolean, accentKey: AccentKey = 'lime'): Theme {
  const a = ACCENTS[accentKey] || ACCENTS.lime
  if (dark) {
    return {
      dark: true,
      accentKey,
      bg:        '#0A0C0B',
      bgElev:    '#101312',
      surface:   '#15181A',
      surface2:  '#1C2023',
      surfaceHi: '#23282C',
      border:    'rgba(255,255,255,0.07)',
      borderHi:  'rgba(255,255,255,0.14)',
      text:      '#F2F5F2',
      textMute:  'rgba(236,242,236,0.60)',
      textFaint: 'rgba(236,242,236,0.34)',
      brand:     a.brand,
      brandText: a.brandText,
      brandGlow: a.brand + '55',
      cyan:      '#3DD6FF',
      gold:      '#FFCB45',
      silver:    '#CBD1DA',
      bronze:    '#E08C4E',
      shadow:    '0 18px 40px rgba(0,0,0,0.5)',
      track:     'rgba(255,255,255,0.08)',
    }
  }
  return {
    dark: false,
    accentKey,
    bg:        '#EEF0EA',
    bgElev:    '#F6F7F3',
    surface:   '#FFFFFF',
    surface2:  '#F6F7F3',
    surfaceHi: '#FFFFFF',
    border:    'rgba(15,20,15,0.08)',
    borderHi:  'rgba(15,20,15,0.16)',
    text:      '#141714',
    textMute:  'rgba(20,28,20,0.58)',
    textFaint: 'rgba(20,28,20,0.36)',
    brand:     a.brand,
    brandText: a.brandText,
    brandGlow: a.brand + '66',
    cyan:      '#0FB6E6',
    gold:      '#E8A100',
    silver:    '#9AA2AD',
    bronze:    '#C2702E',
    shadow:    '0 14px 34px rgba(20,30,20,0.10)',
    track:     'rgba(15,20,15,0.08)',
  }
}

// 0..100 → vivid oklch on a red→amber→lime→green ramp.
export function scoreColor(score: number, { l = 0.80, c = 0.185 }: { l?: number; c?: number } = {}): string {
  const s = Math.max(0, Math.min(100, score || 0))
  const hue = s <= 50
    ? 25 + (75 - 25) * (s / 50)
    : 75 + (146 - 75) * ((s - 50) / 50)
  return `oklch(${l} ${c} ${hue})`
}

export function scoreZone(score: number): string {
  if (score >= 85) return 'Elite'
  if (score >= 70) return 'Strong'
  if (score >= 55) return 'Steady'
  if (score >= 35) return 'Slipping'
  return 'Low'
}

export const FONT_DISPLAY = '"Archivo Expanded", "Archivo", system-ui, sans-serif'
export const FONT_UI = '"Archivo", system-ui, sans-serif'
export const FONT_MONO = '"Geist Mono", ui-monospace, monospace'
