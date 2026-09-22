import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { fulfillProductionOrderSchema } from '@/lib/validation/prep-production-order.schema'
import { fulfillProductionOrder } from '@/lib/services/prep-production-order.service'
import { handleApiError } from '@/lib/api-error'

// Fine-grained checking happens in the service, since it depends on the
// order's source AND its assigned team: internal -> whichever of
// kitchen/waiter it's assigned to (homeArea match), or fulfill_any; outside
// -> fulfill_any only (the one "receiving" the third party's delivery).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('production_orders.fulfill', 'production_orders.fulfill_any')
    const { id } = await params
    const body = fulfillProductionOrderSchema.parse(await req.json())

    const run = await fulfillProductionOrder({
      orderId: id,
      ...body,
      recordedById: user.sub,
      permissions: user.role.permissions,
      homeArea: user.role.homeArea,
    })
    return NextResponse.json(run, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
