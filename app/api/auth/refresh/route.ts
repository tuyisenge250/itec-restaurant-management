import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, signAccessToken } from '@/lib/auth/jwt'

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refreshToken')?.value
  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
  }

  try {
    const payload = await verifyToken(refreshToken)
    const accessToken = await signAccessToken({
      sub: payload.sub,
      role: payload.role,
      name: payload.name,
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