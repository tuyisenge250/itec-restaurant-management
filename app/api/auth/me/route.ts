import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { handleApiError } from '@/lib/api-error'

// Switched from the cheap JWT-only getUserFromToken() to the DB-backed
// requireUser() so the client always has the live permission set — this is
// what drives nav-item visibility and the discount-cap display without a
// second round trip (see components/app-sidebar.tsx, lib/nav-config.ts).
export async function GET() {
  try {
    const user = await requireUser()
    return NextResponse.json({ id: user.sub, name: user.name, role: user.role })
  } catch (err) {
    return handleApiError(err)
  }
}
