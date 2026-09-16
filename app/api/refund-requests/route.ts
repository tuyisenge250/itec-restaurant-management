import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { listRefundRequests } from '@/lib/services/payment.service'
import { handleApiError } from '@/lib/api-error'

const VALID_STATUSES = ['pending', 'approved', 'denied'] as const

export async function GET(req: NextRequest) {
  try {
    await requireRole('admin')
    const statusParam = req.nextUrl.searchParams.get('status')
    const status = VALID_STATUSES.find((s) => s === statusParam)

    const requests = await listRefundRequests(status)
    return NextResponse.json(requests)
  } catch (err) {
    return handleApiError(err)
  }
}
