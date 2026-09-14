import { NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth/session'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
    const user = await getUserFromToken()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({ id: user.sub, name: user.name, role: user.role })
  } catch (err) {
    return handleApiError(err)
  }
}
