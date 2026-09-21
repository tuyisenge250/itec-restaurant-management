import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { confirmOrderPayment } from '@/lib/services/payment.service'
import { handleApiError } from '@/lib/api-error'

// Cashier's reconciliation step — closes out an order sitting in
// payment_pending (waiter already collected full payment and handed the
// customer a receipt) by booking it as actually paid.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('admin', 'cashier')
    const { id } = await params
    const order = await confirmOrderPayment({ orderId: id, userId: user.sub, role: user.role })
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}
