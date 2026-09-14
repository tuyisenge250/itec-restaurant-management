import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET)

const roleRoutes: Record<string, string> = {
  '/admin': 'admin',
  '/kitchen': 'kitchen',
  '/waiter': 'waiter',
}

export default async function proxy(req: NextRequest) {
  const token = req.cookies.get('token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, secret)
    const matchedPrefix = Object.keys(roleRoutes).find((p) =>
      req.nextUrl.pathname.startsWith(p)
    )

    if (matchedPrefix && payload.role !== roleRoutes[matchedPrefix]) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/admin/:path*', '/kitchen/:path*', '/waiter/:path*'],
}