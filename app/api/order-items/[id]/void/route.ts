import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { voidOrderItemSchema } from '@/lib/validation/order.schema'
import { voidOrderItem } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('waiter', 'kitchen', 'admin')
    const { id } = await params
    const { voidReason } = voidOrderItemSchema.parse(await req.json())

    const item = await voidOrderItem({ orderItemId: id, voidReason, userId: user.sub, role: user.role })
    return NextResponse.json(item)
  } catch (err) {
    return handleApiError(err)
  }
}
