'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Icon, type IconName } from './Icon'
import { useT } from './ThemeProvider'
import { FONT_UI } from './theme'

type Item = { k: string; icon: IconName; label: string; href: string }

const ITEMS: Item[] = [
  { k: 'today', icon: 'today', label: 'Today', href: '/dashboard' },
  { k: 'rank', icon: 'rank', label: 'Rank', href: '/leaderboard' },
  { k: 'profile', icon: 'user', label: 'You', href: '/profile' },
]

function matches(path: string, href: string): boolean {
  if (href === '/dashboard') return path === '/dashboard' || path === '/'
  return path === href || path.startsWith(href + '/')
}

export function TabBar() {
  const t = useT()
  const path = usePathname() ?? '/'
  const router = useRouter()
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        background: `linear-gradient(180deg, transparent, ${t.bg} 38%)`,
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      <div
        style={{
          margin: '0 16px',
          maxWidth: 420,
          marginLeft: 'auto',
          marginRight: 'auto',
          height: 64,
          borderRadius: 22,
          background: t.dark ? 'rgba(22,26,28,0.86)' : 'rgba(255,255,255,0.9)',
          border: `1px solid ${t.border}`,
          boxShadow: t.shadow,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          pointerEvents: 'auto',
          position: 'relative',
        }}
      >
        <NavBtn item={ITEMS[0]} path={path} />
        <NavBtn item={ITEMS[1]} path={path} />
        <div style={{ width: 64, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
          <button
            type="button"
            onClick={() => router.push('/meal/new')}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: t.brand,
              border: 'none',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              marginTop: -28,
              boxShadow: `0 8px 22px ${t.brandGlow}, 0 0 0 5px ${t.bg}`,
            }}
            aria-label="Log a meal"
          >
            <Icon name="camera" size={26} sw={2.3} color={t.brandText} />
          </button>
        </div>
        <NavBtn item={ITEMS[2]} path={path} />
        <div style={{ flex: 0 }} />
      </div>
    </div>
  )
}

function NavBtn({ item, path }: { item: Item; path: string }) {
  const t = useT()
  const on = matches(path, item.href)
  return (
    <Link
      href={item.href}
      style={{
        flex: 1,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '8px 0',
        textDecoration: 'none',
      }}
    >
      <Icon name={item.icon} size={23} sw={on ? 2.4 : 2} color={on ? t.brand : t.textFaint} />
      <span
        style={{
          fontFamily: FONT_UI,
          fontWeight: on ? 700 : 600,
          fontSize: 10.5,
          color: on ? t.text : t.textFaint,
          letterSpacing: 0.3,
        }}
      >
        {item.label}
      </span>
    </Link>
  )
}
