import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { applyDiscountSchema } from '@/lib/validation/order.schema'
import { applyDiscount } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('orders.manage_own', 'orders.discount_any')
    const { id } = await params
    const body = applyDiscountSchema.parse(await req.json())

    const order = await applyDiscount({
      orderId: id,
      ...body,
      userId: user.sub,
      permissions: user.role.permissions,
      maxDiscountPercent: user.role.maxDiscountPercent,
    })
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}
