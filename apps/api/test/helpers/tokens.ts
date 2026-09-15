import { createHmac } from 'crypto'
import { generateTokens } from '../../src/services/auth'
import type { User } from '@ford-intel/database'

export function issueAccessToken(user: Partial<User> & { id: string; email: string; role: string }) {
  return generateTokens(user as User).accessToken
}

export function issueRefreshToken(user: Partial<User> & { id: string; email: string; role: string }) {
  return generateTokens(user as User).refreshToken
}

export function signBody(body: unknown): string {
  const hash = createHmac('sha256', process.env.HMAC_SECRET as string)
    .update(JSON.stringify(body))
    .digest('hex')
  return `sha256=${hash}`
}
