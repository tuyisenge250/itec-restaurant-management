import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, signAccessToken } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db/prisma'

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refreshToken')?.value
  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
  }

  try {
    const payload = await verifyToken(refreshToken)

    // Re-derive everything from a fresh DB read keyed on `sub` — never
    // re-stamp the refresh token's own embedded claims forward. That was
    // the old staleness bug: a role/permission change (or deactivation)
    // wouldn't take effect for up to 7 days since refresh just re-signed
    // whatever the token already said. Now every refresh re-checks.
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { role: true } })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      name: user.name,
      homeArea: user.role.homeArea,
    })

    const res = NextResponse.json({ ok: true })
    res.cookies.set('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 15,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
  }
}
