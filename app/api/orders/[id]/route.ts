import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { getOrderWithDetails } from '@/lib/services/order.service'
import { ForbiddenError } from '@/lib/errors'
import { handleApiError } from '@/lib/api-error'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params
    const order = await getOrderWithDetails(id)
    // Anyone without orders.view_all is scoped to their own orders (today
    // that's the waiter role's default bundle) — kitchen/cashier/admin hold
    // orders.view_all and get unrestricted access to fulfill/oversee any
    // order.
    if (!user.role.permissions.includes('orders.view_all') && order.createdById !== user.sub) {
      throw new ForbiddenError('You can only view orders you created')
    }
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}