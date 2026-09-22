import { SignJWT, jwtVerify } from 'jose'
import type { HomeArea } from '@prisma/client'

const secret = new TextEncoder().encode(process.env.JWT_SECRET)

// `homeArea` is the ONLY role-derived claim carried in the token, and it is
// advisory only — used solely by proxy.ts's coarse "which page shell"
// redirect. It is never used to make a real permission decision: every
// requireUser()/requirePermission() call re-reads the user's role and
// permissions from the database live, so a permission change (or a role
// reassignment) takes effect on the very next request regardless of what's
// cached here. See lib/auth/session.ts.
export type JwtPayload = {
  sub: string
  name: string
  homeArea: HomeArea
}

export async function signAccessToken(payload: JwtPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_ACCESS_EXPIRES ?? '15m')
    .sign(secret)
}

export async function signRefreshToken(payload: JwtPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES ?? '7d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as JwtPayload
}
