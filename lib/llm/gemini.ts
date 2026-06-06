/**
 * Thin Gemini wrapper around direct REST — the @google/generative-ai SDK
 * (v0.x) only hits v1beta which no longer exposes the current models for
 * many keys. REST gives us model + endpoint control.
 *
 * Models in use:
 *   - gemini-2.5-flash for vision identification + macro estimation (JSON)
 */

const API = 'https://generativelanguage.googleapis.com/v1beta'

function key() {
  const k = process.env.GEMINI_API_KEY
  if (!k) throw new Error('GEMINI_API_KEY missing')
  return k
}

const RETRY_STATUS = new Set([429, 500, 502, 503, 504])
const MAX_ATTEMPTS = 3

/**
 * Fetch with exponential backoff on 429/5xx — Gemini's free tier returns
 * transient 503s under load. Backoff: 1s, 2s, 4s.
 */
async function fetchWithRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  let lastBody = ''
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, init)
    if (res.ok) return res
    lastBody = await res.text().catch(() => '')
    if (!RETRY_STATUS.has(res.status) || attempt === MAX_ATTEMPTS) {
      throw new Error(`${label} ${res.status}: ${lastBody}`)
    }
    const delayMs = 1000 * Math.pow(2, attempt - 1)
    await new Promise((r) => setTimeout(r, delayMs))
  }
  throw new Error(`${label}: exhausted retries (last: ${lastBody})`)
}

/**
 * Generate JSON with Gemini 2.5 Flash. Set responseSchema for guaranteed shape.
 * For vision calls, pass image parts in `parts`.
 */
export async function generateJson<T>(opts: {
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
  responseSchema?: unknown
  systemInstruction?: string
}): Promise<T> {
  const body: Record<string, unknown> = {
    contents: [{ parts: opts.parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
    },
  }
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] }
  }

  const res = await fetchWithRetry(
    `${API}/models/gemini-2.5-flash:generateContent?key=${key()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'gemini generate',
  )
  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('gemini returned no text')
  return JSON.parse(text) as T
}
