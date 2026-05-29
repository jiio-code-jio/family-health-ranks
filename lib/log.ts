/**
 * Server-side structured logger that writes to logs/app.log AND stdout.
 *
 * Each line: `ISO_TIMESTAMP  level  tag  message  {json}`
 *
 * Tail in another terminal:   npm run tail-logs
 * Filter:                     npm run tail-logs | grep meal_id=xxx
 *
 * Production note: writing to disk works in dev only — Vercel functions have a
 * read-only filesystem. We catch the write error so prod just no-ops the file
 * sink and keeps console.log. Migrate to a hosted log sink (Logflare, Axiom,
 * Vercel Logs) when deploying.
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'app.log')

let dirReady = false
function ensureDir(): void {
  if (dirReady) return
  try { mkdirSync(LOG_DIR, { recursive: true }); dirReady = true } catch { /* read-only fs in prod */ }
}

type Level = 'info' | 'warn' | 'error'

function write(level: Level, tag: string, message: string, data?: Record<string, unknown>): void {
  const ts = new Date().toISOString()
  const dataStr = data && Object.keys(data).length > 0 ? '  ' + JSON.stringify(data) : ''
  const line = `${ts}  ${level.padEnd(5)}  ${tag.padEnd(18)}  ${message}${dataStr}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
  ensureDir()
  try { appendFileSync(LOG_FILE, line + '\n') } catch { /* prod read-only fs */ }
}

export const log = {
  info:  (tag: string, message: string, data?: Record<string, unknown>) => write('info',  tag, message, data),
  warn:  (tag: string, message: string, data?: Record<string, unknown>) => write('warn',  tag, message, data),
  error: (tag: string, message: string, data?: Record<string, unknown>) => write('error', tag, message, data),
}
