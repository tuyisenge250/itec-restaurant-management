import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { cancelProductionOrder } from '@/lib/services/prep-production-order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('admin')
    const { id } = await params

    const order = await cancelProductionOrder({ orderId: id, userId: user.sub, role: user.role })
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}
