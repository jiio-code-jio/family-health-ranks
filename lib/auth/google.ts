/**
 * Google OAuth 2.0 helpers (node runtime only — uses google-auth-library).
 *
 * The app keeps its own session model: after Google verifies the user we mint
 * the existing `fhr_session` JWT (see lib/auth/jwt.ts). Google is only the
 * identity provider; getSession() and proxy.ts are unchanged.
 */

import { OAuth2Client } from 'google-auth-library'

const SCOPES = ['openid', 'email', 'profile']

function clientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID
  if (!id) throw new Error('GOOGLE_CLIENT_ID missing')
  return id
}

function clientSecret(): string {
  const s = process.env.GOOGLE_CLIENT_SECRET
  if (!s) throw new Error('GOOGLE_CLIENT_SECRET missing')
  return s
}

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
}

function oauthClient(redirectUri: string): OAuth2Client {
  return new OAuth2Client({ clientId: clientId(), clientSecret: clientSecret(), redirectUri })
}

/** Build the Google consent URL to redirect the user to. */
export function buildAuthUrl(redirectUri: string, state: string): string {
  return oauthClient(redirectUri).generateAuthUrl({
    access_type: 'online',
    scope: SCOPES,
    state,
    prompt: 'select_account',
  })
}

export type GoogleProfile = {
  sub: string
  email: string | null
  name: string | null
  picture: string | null
}

/**
 * Exchange the authorization code for tokens and verify the returned ID token.
 * Returns the verified profile, or throws on any failure.
 */
export async function exchangeAndVerify(code: string, redirectUri: string): Promise<GoogleProfile> {
  const client = oauthClient(redirectUri)
  const { tokens } = await client.getToken(code)
  if (!tokens.id_token) throw new Error('no id_token returned')

  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId() })
  const payload = ticket.getPayload()
  if (!payload?.sub) throw new Error('id_token missing sub')

  return {
    sub: payload.sub,
    email: payload.email ?? null,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  }
}
