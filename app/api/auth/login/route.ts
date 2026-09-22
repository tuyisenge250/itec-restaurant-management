import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } })

  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash)
  if (!passwordValid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // homeArea is the only role-derived claim carried in the token, and it's
  // advisory-only (see lib/auth/jwt.ts) — every real permission check
  // re-reads the role fresh from the database on each request.
  const payload = { sub: user.id, name: user.name, homeArea: user.role.homeArea }
  const accessToken = await signAccessToken(payload)
  const refreshToken = await signRefreshToken(payload)

  const res = NextResponse.json({ homeArea: user.role.homeArea, name: user.name })

  res.cookies.set('token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 15, // 15 minutes
  })

  res.cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  return res
}