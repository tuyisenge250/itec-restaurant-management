import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('token', '', { path: '/', maxAge: 0 })
  res.cookies.set('refreshToken', '', { path: '/api/auth/refresh', maxAge: 0 })
  return res
}