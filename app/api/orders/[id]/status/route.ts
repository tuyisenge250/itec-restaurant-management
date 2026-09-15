import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { updateOrderStatusSchema } from '@/lib/validation/order.schema'
import { updateOrderStatus } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const { status } = updateOrderStatusSchema.parse(await req.json())

    const order = await updateOrderStatus({ orderId: id, newStatus: status, userId: user.sub, role: user.role })
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}
