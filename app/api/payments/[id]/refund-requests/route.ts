import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { requestRefundSchema } from '@/lib/validation/payment.schema'
import { requestRefund } from '@/lib/services/payment.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('waiter', 'admin')
    const { id } = await params
    const body = requestRefundSchema.parse(await req.json())

    const request = await requestRefund({ paymentId: id, ...body, userId: user.sub, role: user.role })
    return NextResponse.json(request, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
