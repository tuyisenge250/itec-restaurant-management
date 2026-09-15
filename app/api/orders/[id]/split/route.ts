import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { splitOrderSchema } from '@/lib/validation/order.schema'
import { splitOrder } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('waiter', 'admin')
    const { id } = await params
    const { itemIds } = splitOrderSchema.parse(await req.json())

    const newOrder = await splitOrder({ orderId: id, itemIds, userId: user.sub })
    return NextResponse.json(newOrder, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
