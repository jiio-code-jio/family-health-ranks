import type { Metadata, Viewport } from 'next'
import { Archivo, Geist_Mono } from 'next/font/google'
import './globals.css'

const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
})

// Archivo Expanded is not in next/font/google's curated list; fall back to
// Archivo with stretch/expanded-style weight 900 + letter-spacing in display use.
const archivoExpanded = Archivo({
  variable: '--font-archivo-expanded',
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Family Health Ranks',
  description: 'Rank how healthily your family and friends are eating, one meal photo at a time.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Health Ranks' },
}

export const viewport: Viewport = {
  themeColor: '#0A0C0B',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoExpanded.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0A0C0B] text-[#F2F5F2]">{children}</body>
    </html>
  )
}
