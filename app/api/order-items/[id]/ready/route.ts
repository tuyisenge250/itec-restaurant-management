import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { markOrderItemReady } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

// Fulfillment of ONE item — kitchen for a prep item, cashier for a
// direct-serve one (the service layer decides which based on the item
// itself). This is where stock actually leaves the shelf for that line,
// scoped to the item rather than gated by whole-order status so a mixed
// order's items can finish independently.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('order_items.fulfill_prep', 'order_items.fulfill_direct')
    const { id } = await params

    const item = await markOrderItemReady({ orderItemId: id, userId: user.sub, permissions: user.role.permissions })
    return NextResponse.json(item)
  } catch (err) {
    return handleApiError(err)
  }
}
