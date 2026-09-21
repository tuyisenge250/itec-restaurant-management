import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { recordSupplierPaymentSchema } from '@/lib/validation/purchase-order.schema'
import { recordSupplierPayment } from '@/lib/services/supplier-payment.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('admin')
    const { id } = await params
    const body = recordSupplierPaymentSchema.parse(await req.json())
    const payment = await recordSupplierPayment({ purchaseOrderId: id, ...body, recordedById: user.sub })
    return NextResponse.json(payment, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
