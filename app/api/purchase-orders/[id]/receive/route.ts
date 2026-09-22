import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { receivePurchaseOrderSchema } from '@/lib/validation/purchase-order.schema'
import { receiveGoodsForPurchaseOrder } from '@/lib/services/purchase-order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('purchase_orders.manage')
    const { id } = await params
    const body = receivePurchaseOrderSchema.parse(await req.json())

    const po = await receiveGoodsForPurchaseOrder({
      purchaseOrderId: id,
      lines: body.items,
      recordedById: user.sub,
    })

    return NextResponse.json(po)
  } catch (err) {
    return handleApiError(err)
  }
}
