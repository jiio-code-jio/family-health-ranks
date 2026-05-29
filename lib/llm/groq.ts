/**
 * Groq client for the weekly-tips feature. Groq exposes an OpenAI-compatible
 * Chat Completions API, so we reuse the `openai` SDK pointed at their base URL
 * rather than add another dependency. Free tier + a fast 70B model is plenty
 * for one short generation per user per week.
 */

import OpenAI from 'openai'

const MODEL = 'llama-3.3-70b-versatile'
const BASE_URL = 'https://api.groq.com/openai/v1'

let _client: OpenAI | null = null
function client(): OpenAI {
  if (_client) return _client
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY missing')
  _client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: BASE_URL })
  return _client
}

export function groqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY
}

/** Single JSON-mode chat call. Returns the parsed object of type T. */
export async function groqJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const resp = await client().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 600,
  })
  const content = resp.choices[0]?.message?.content
  if (!content) throw new Error('groq returned no content')
  return JSON.parse(content) as T
}

export const GROQ_MODEL = MODEL
