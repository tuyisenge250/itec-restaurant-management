import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'

// Coarse, advisory page-shell gate — NOT the real security boundary. Keyed
// on the JWT's `homeArea` claim, which is cached at login/refresh and can
// lag a role reassignment by up to 15 minutes (see lib/auth/jwt.ts). That's
// acceptable here: every actual action still re-checks permissions live via
// requirePermission() at the API layer regardless of which shell rendered,
// so a stale homeArea only means "wrong sidebar for a few minutes," never
// "wrong access."
const homeAreaRoutes: Record<string, string> = {
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
    const matchedPrefix = Object.keys(homeAreaRoutes).find((p) =>
      req.nextUrl.pathname.startsWith(p)
    )

    // Admin is a superset homeArea: it can view/act as kitchen or waiter too
    // (the sidebar's account switcher relies on this), so only waiter/kitchen
    // accounts are actually confined to their own prefix.
    if (matchedPrefix && payload.homeArea !== 'admin' && payload.homeArea !== homeAreaRoutes[matchedPrefix]) {
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