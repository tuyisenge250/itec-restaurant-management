import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { splitOrderSchema } from '@/lib/validation/order.schema'
import { splitOrder } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('orders.manage_own', 'orders.manage_all')
    const { id } = await params
    const { items } = splitOrderSchema.parse(await req.json())

    const newOrder = await splitOrder({ orderId: id, items, userId: user.sub, permissions: user.role.permissions })
    return NextResponse.json(newOrder, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
