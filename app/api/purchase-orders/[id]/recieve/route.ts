import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { receivePurchaseOrderSchema } from '@/lib/validation/purchase-order.schema'
import { receivePurchaseOrder } from '@/lib/services/purchase-order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole('admin')
    const { id } = await params
    const body = receivePurchaseOrderSchema.parse(await req.json())

    const po = await receivePurchaseOrder({
      purchaseOrderId: id,
      items: body.items,
      recordedById: user.sub,
    })

    return NextResponse.json(po)
  } catch (err) {
    return handleApiError(err)
  }
}