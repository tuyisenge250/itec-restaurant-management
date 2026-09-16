import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { mergeOrderSchema } from '@/lib/validation/order.schema'
import { mergeOrders } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('waiter', 'admin')
    const { id } = await params
    const { targetOrderId } = mergeOrderSchema.parse(await req.json())

    const order = await mergeOrders({ sourceOrderId: id, targetOrderId, userId: user.sub, role: user.role })
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}
