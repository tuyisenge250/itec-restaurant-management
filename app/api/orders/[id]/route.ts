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
    // A waiter can only open orders they created — kitchen and admin need
    // unrestricted access to fulfill/oversee any order.
    if (user.role === 'waiter' && order.createdById !== user.sub) {
      throw new ForbiddenError('You can only view orders you created')
    }
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}