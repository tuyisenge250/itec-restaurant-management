import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { reorderPurchaseOrder } from '@/lib/services/purchase-order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('purchase_orders.manage')
    const { id } = await params
    const po = await reorderPurchaseOrder(id, user.sub)
    return NextResponse.json(po, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
