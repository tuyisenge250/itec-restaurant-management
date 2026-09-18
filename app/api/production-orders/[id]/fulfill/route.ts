import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { fulfillProductionOrderSchema } from '@/lib/validation/prep-production-order.schema'
import { fulfillProductionOrder } from '@/lib/services/prep-production-order.service'
import { handleApiError } from '@/lib/api-error'

// Role is checked in the service, since it depends on the order's source AND
// its assignedRole: internal -> whichever of kitchen/waiter it's assigned to,
// or admin; outside -> admin only (the one "receiving" the third party's
// delivery).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('admin', 'kitchen', 'waiter')
    const { id } = await params
    const body = fulfillProductionOrderSchema.parse(await req.json())

    const run = await fulfillProductionOrder({ orderId: id, ...body, recordedById: user.sub, role: user.role })
    return NextResponse.json(run, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
