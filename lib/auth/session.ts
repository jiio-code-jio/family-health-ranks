import { cookies } from 'next/headers'
import { session, verifySession, type SessionPayload } from './jwt'

/** Read + verify the session cookie in a Server Component or Route Handler. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(session.cookieName)?.value
  if (!token) return null
  return verifySession(token)
}
