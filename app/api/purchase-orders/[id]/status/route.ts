import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { updatePurchaseOrderStatusSchema } from '@/lib/validation/purchase-order.schema'
import { updatePurchaseOrderStatus } from '@/lib/services/purchase-order.service'
import { handleApiError } from '@/lib/api-error'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('admin')
    const { id } = await params
    const { status } = updatePurchaseOrderStatusSchema.parse(await req.json())

    const po = await updatePurchaseOrderStatus({ purchaseOrderId: id, newStatus: status, userId: user.sub })
    return NextResponse.json(po)
  } catch (err) {
    return handleApiError(err)
  }
}
