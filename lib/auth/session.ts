import { cookies } from 'next/headers'
import { verifyToken, JwtPayload } from './jwt'
import { UnauthenticatedError, ForbiddenError } from '@/lib/errors'

export async function getUserFromToken(): Promise<JwtPayload | null> {
  const token = (await cookies()).get('token')?.value
  if (!token) return null

  try {
    return await verifyToken(token)
  } catch {
    return null
  }
}

export async function requireUser(): Promise<JwtPayload> {
  const user = await getUserFromToken()
  if (!user) throw new UnauthenticatedError()
  return user
}

// Every API route resolves its caller (and role) from the session this way —
// never from a client-supplied header/body field. Accepts one or more roles
// so routes that allow e.g. "kitchen or admin" don't need ad-hoc boolean checks.
export async function requireRole(...roles: JwtPayload['role'][]): Promise<JwtPayload> {
  const user = await requireUser()
  if (!roles.includes(user.role)) throw new ForbiddenError()
  return user
}
