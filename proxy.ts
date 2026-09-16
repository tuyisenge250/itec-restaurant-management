import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'

const roleRoutes: Record<string, string> = {
  '/admin': 'admin',
  '/kitchen': 'kitchen',
  '/waiter': 'waiter',
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('next', req.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export default async function proxy(req: NextRequest) {
  const token = req.cookies.get('token')?.value

  if (!token) {
    return redirectToLogin(req)
  }

  try {
    const payload = await verifyToken(token)
    const matchedPrefix = Object.keys(roleRoutes).find((p) =>
      req.nextUrl.pathname.startsWith(p)
    )

    // Admin is a superset role: it can view/act as kitchen or waiter too
    // (the sidebar's account switcher relies on this), so only waiter/kitchen
    // accounts are actually confined to their own prefix.
    if (matchedPrefix && payload.role !== 'admin' && payload.role !== roleRoutes[matchedPrefix]) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    return NextResponse.next()
  } catch {
    return redirectToLogin(req)
  }
}

export const config = {
  matcher: ['/admin/:path*', '/kitchen/:path*', '/waiter/:path*'],
}