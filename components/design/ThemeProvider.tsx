'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { makeTheme, type Theme, type AccentKey } from './theme'

type ThemeCtx = {
  theme: Theme
  setDark: (dark: boolean) => void
  toggleDark: () => void
  setAccent: (a: AccentKey) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

export function ThemeProvider({
  children,
  defaultDark = true,
  defaultAccent = 'lime',
}: {
  children: React.ReactNode
  defaultDark?: boolean
  defaultAccent?: AccentKey
}) {
  const [dark, setDark] = useState(defaultDark)
  const [accent, setAccent] = useState<AccentKey>(defaultAccent)
  const theme = useMemo(() => makeTheme(dark, accent), [dark, accent])
  const value = useMemo(
    () => ({
      theme,
      setDark,
      toggleDark: () => setDark((d) => !d),
      setAccent,
    }),
    [theme],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useT(): Theme {
  const ctx = useContext(Ctx)
  if (!ctx) return makeTheme(true)
  return ctx.theme
}

export function useThemeCtl(): ThemeCtx {
  const ctx = useContext(Ctx)
  if (!ctx) {
    const noop = () => {}
    return { theme: makeTheme(true), setDark: noop, toggleDark: noop, setAccent: noop }
  }
  return ctx
}
