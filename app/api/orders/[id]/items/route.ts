import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { updateOrderItemsSchema } from '@/lib/validation/order.schema'
import { updateOrderItems } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('waiter', 'admin')
    const { id } = await params
    const body = updateOrderItemsSchema.parse(await req.json())

    const order = await updateOrderItems({ orderId: id, ...body, userId: user.sub, role: user.role })
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}
