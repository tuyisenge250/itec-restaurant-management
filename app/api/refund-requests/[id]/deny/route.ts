import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { denyRefundRequestSchema } from '@/lib/validation/payment.schema'
import { denyRefundRequest } from '@/lib/services/payment.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('admin')
    const { id } = await params
    const { denialReason } = denyRefundRequestSchema.parse(await req.json())

    const request = await denyRefundRequest({ requestId: id, adminId: user.sub, denialReason })
    return NextResponse.json(request)
  } catch (err) {
    return handleApiError(err)
  }
}
