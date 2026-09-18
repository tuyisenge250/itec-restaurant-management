import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { serveOrderItem } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

// Hands one item to the customer. For a direct-serve item (no kitchen
// ticket ever existed) this is the whole fulfillment step — stock is drawn
// right here. For a prep item already marked ready by the kitchen, this
// just records it as handed over. Waiter (their own order) or admin only —
// kitchen never touches this endpoint.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('waiter', 'admin')
    const { id } = await params

    const item = await serveOrderItem({ orderItemId: id, userId: user.sub, role: user.role })
    return NextResponse.json(item)
  } catch (err) {
    return handleApiError(err)
  }
}
