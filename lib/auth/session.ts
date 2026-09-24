import { cookies } from 'next/headers'
import type { HomeArea } from '@prisma/client'
import { verifyToken, JwtPayload } from './jwt'
import { prisma } from '@/lib/db/prisma'
import { UnauthenticatedError, ForbiddenError } from '@/lib/errors'

// Cheap, JWT-only — used by proxy.ts for its advisory page-shell redirect,
// and internally below to pull the user id. Never used for a real
// authorization decision; see requireUser/requirePermission.
export async function getUserFromToken(): Promise<JwtPayload | null> {
  const token = (await cookies()).get('token')?.value
  if (!token) return null

  try {
    return await verifyToken(token)
  } catch {
    return null
  }
}

// `sub` is kept as the field name (rather than `id`) so every existing route
// handler's `user.sub` usage (createdById: user.sub, etc.) keeps working
// unchanged even though this is now a resolved DB row, not a JWT payload.
export type SessionUser = {
  sub: string
  name: string
  email: string
  role: {
    id: string
    name: string
    homeArea: HomeArea
    permissions: string[]
    maxDiscountPercent: number
  }
}

// The real authorization primitive — hits the database on every call so a
// permission grant/revoke or role reassignment takes effect on the user's
// very next request, per the dynamic-RBAC design (nothing role-related is
// trusted from the JWT beyond which user is asking). This also closes a
// pre-existing gap as a side effect: deactivating a user now revokes their
// already-active session immediately, instead of only once their token
// naturally expires.
export async function requireUser(): Promise<SessionUser> {
  const claims = await getUserFromToken()
  if (!claims) throw new UnauthenticatedError()

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    include: { role: { include: { permissions: { select: { key: true } } } } },
  })
  if (!user || !user.isActive) throw new UnauthenticatedError()

  return {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: {
      id: user.role.id,
      name: user.role.name,
      homeArea: user.role.homeArea,
      // Flattened back to a plain string[] here, at the one place every
      // downstream consumer (requirePermission, hasPermission, nav-config,
      // the client) reads from — so none of them need to know permissions
      // are now real rows under a Module rather than a raw text[].
      permissions: user.role.permissions.map((p) => p.key),
      maxDiscountPercent: user.role.maxDiscountPercent,
    },
  }
}

// Every API route resolves its caller (and what they're allowed to do) from
// the session this way — never from a client-supplied header/body field.
// Accepts one or more permission keys with OR semantics (same call shape the
// old role-based requireRole had), so a route needing "either of these two
// capabilities" doesn't need an ad-hoc boolean check.
export async function requirePermission(...keys: string[]): Promise<SessionUser> {
  const user = await requireUser()
  if (!keys.some((k) => user.role.permissions.includes(k))) throw new ForbiddenError()
  return user
}

export function hasPermission(user: SessionUser, key: string): boolean {
  return user.role.permissions.includes(key)
}
