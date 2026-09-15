import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { sendToKitchen } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('waiter', 'admin')
    const { id } = await params
    const order = await sendToKitchen(id, user.sub, user.role)
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}
