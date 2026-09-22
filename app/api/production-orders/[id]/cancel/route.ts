import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { cancelProductionOrder } from '@/lib/services/prep-production-order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('production_orders.manage')
    const { id } = await params

    const order = await cancelProductionOrder({ orderId: id, userId: user.sub, permissions: user.role.permissions })
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}
