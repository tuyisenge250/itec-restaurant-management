import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { updateOrderStatusSchema } from '@/lib/validation/order.schema'
import { updateOrderStatus } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params
    const { status } = updateOrderStatusSchema.parse(await req.json())

    // Kitchen owns preparing/ready, waiter owns served/paid, admin can do anything
    const kitchenStatuses = ['preparing', 'ready']
    const waiterStatuses = ['served', 'paid', 'cancelled']

    const allowed =
      user.role === 'admin' ||
      (user.role === 'kitchen' && kitchenStatuses.includes(status)) ||
      (user.role === 'waiter' && waiterStatuses.includes(status))

    if (!allowed) {
      return NextResponse.json({ error: 'Not authorized for this action' }, { status: 403 })
    }

    const order = await updateOrderStatus({ orderId: id, newStatus: status, updatedById: user.sub })
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}