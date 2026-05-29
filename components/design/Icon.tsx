import type { CSSProperties } from 'react'

export type IconName =
  | 'today' | 'rank' | 'trophy' | 'user' | 'plus' | 'minus' | 'close' | 'check'
  | 'chevron-right' | 'chevron-left' | 'chevron-down' | 'arrow-up' | 'arrow-down'
  | 'flame' | 'water' | 'bolt' | 'protein' | 'leaf' | 'clock' | 'goal' | 'spark'
  | 'camera' | 'gallery' | 'flash' | 'crown' | 'moon' | 'sun' | 'fork' | 'info'
  | 'lightning-badge' | 'medal'

export function Icon({
  name,
  size = 24,
  color = 'currentColor',
  sw = 2,
  style = {},
  fill = 'none',
}: {
  name: IconName
  size?: number
  color?: string
  sw?: number
  style?: CSSProperties
  fill?: string
}) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill,
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { display: 'block' as const, flexShrink: 0, ...style },
  }
  switch (name) {
    case 'today':
      return <svg {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.6" fill={color}/></svg>
    case 'rank':
      return <svg {...p}><path d="M7 21V11M12 21V5M17 21v-7"/><path d="M3 21h18"/></svg>
    case 'trophy':
      return <svg {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/><path d="M9.5 14.5 9 19h6l-.5-4.5M8 21h8"/></svg>
    case 'user':
      return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6"/></svg>
    case 'plus':
      return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>
    case 'minus':
      return <svg {...p}><path d="M5 12h14"/></svg>
    case 'close':
      return <svg {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>
    case 'check':
      return <svg {...p}><path d="M4 12.5 9 17.5 20 6.5"/></svg>
    case 'chevron-right':
      return <svg {...p}><path d="M9 5l7 7-7 7"/></svg>
    case 'chevron-left':
      return <svg {...p}><path d="M15 5l-7 7 7 7"/></svg>
    case 'chevron-down':
      return <svg {...p}><path d="M5 9l7 7 7-7"/></svg>
    case 'arrow-up':
      return <svg {...p}><path d="M12 19V5M6 11l6-6 6 6"/></svg>
    case 'arrow-down':
      return <svg {...p}><path d="M12 5v14M6 13l6 6 6-6"/></svg>
    case 'flame':
      return <svg {...p}><path d="M12 3c1 3-2 4-2 7a2 2 0 1 0 4 0c0-1 .6-1.5 1-2 1.2 1.2 2 3 2 5a5 5 0 0 1-10 0c0-3.5 3-5 5-10Z"/></svg>
    case 'water':
      return <svg {...p}><path d="M12 3c3 4 6 7 6 10.5a6 6 0 0 1-12 0C6 10 9 7 12 3Z"/></svg>
    case 'bolt':
      return <svg {...p}><path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z"/></svg>
    case 'protein':
      return <svg {...p}><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/></svg>
    case 'leaf':
      return <svg {...p}><path d="M5 19C5 11 11 6 19 6c0 8-5 14-13 14-1 0-1.5-.3-2-1Z"/><path d="M5 19c3-4 6-6 10-7"/></svg>
    case 'clock':
      return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
    case 'goal':
      return <svg {...p}><path d="M6 21V4M6 4h11l-2 4 2 4H6"/></svg>
    case 'spark':
      return <svg {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/></svg>
    case 'camera':
      return <svg {...p}><path d="M4 8.5A2 2 0 0 1 6 6.5h1.5l1-2h5l1 2H20a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z"/><circle cx="12" cy="13" r="3.5"/></svg>
    case 'gallery':
      return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 4.5-4 3 2.5L16 11l4 4.5"/></svg>
    case 'flash':
      return <svg {...p}><path d="M13 3 6 13h5l-1 8 8-11h-5l1-7Z"/></svg>
    case 'crown':
      return <svg {...p}><path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13L4 8Z"/></svg>
    case 'moon':
      return <svg {...p}><path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5Z"/></svg>
    case 'sun':
      return <svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>
    case 'fork':
      return <svg {...p}><path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11M17 3c-1.5 0-2.5 2-2.5 5s1 3.5 2.5 3.5V21"/></svg>
    case 'info':
      return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
    case 'lightning-badge':
      return <svg {...p} fill={color} stroke="none"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>
    case 'medal':
      return <svg {...p}><circle cx="12" cy="14" r="6"/><path d="M9 9 7 3M15 9l2-6M12 12.5l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7L9.5 14.3l1.7-.2.8-1.6Z" strokeWidth="1.3"/></svg>
    default:
      return <svg {...p}><circle cx="12" cy="12" r="9"/></svg>
  }
}
