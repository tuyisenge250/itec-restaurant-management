import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { applyDiscountSchema } from '@/lib/validation/order.schema'
import { applyDiscount } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('waiter', 'cashier', 'admin')
    const { id } = await params
    const body = applyDiscountSchema.parse(await req.json())

    const order = await applyDiscount({ orderId: id, ...body, userId: user.sub, role: user.role })
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}
