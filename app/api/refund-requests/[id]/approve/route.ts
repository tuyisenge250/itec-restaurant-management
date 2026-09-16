import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { approveRefundRequest } from '@/lib/services/payment.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('admin')
    const { id } = await params

    const request = await approveRefundRequest({ requestId: id, adminId: user.sub })
    return NextResponse.json(request)
  } catch (err) {
    return handleApiError(err)
  }
}
