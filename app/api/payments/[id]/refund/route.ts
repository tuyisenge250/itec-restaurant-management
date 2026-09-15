import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { refundPaymentSchema } from '@/lib/validation/payment.schema'
import { refundPayment } from '@/lib/services/payment.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('admin')
    const { id } = await params
    const body = refundPaymentSchema.parse(await req.json())

    const refund = await refundPayment({ paymentId: id, ...body, userId: user.sub })
    return NextResponse.json(refund, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
