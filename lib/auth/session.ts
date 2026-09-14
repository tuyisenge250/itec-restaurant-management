import { cookies } from 'next/headers'
import { verifyToken, JwtPayload } from './jwt'

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
  if (!user) throw new Error('UNAUTHENTICATED')
  return user
}

export async function requireRole(role: JwtPayload['role']): Promise<JwtPayload> {
  const user = await requireUser()
  if (user.role !== role) throw new Error('FORBIDDEN')
  return user
}