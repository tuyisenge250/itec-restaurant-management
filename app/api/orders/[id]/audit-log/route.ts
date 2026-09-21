import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { ForbiddenError } from '@/lib/errors'
import { handleApiError } from '@/lib/api-error'

// Merges every audit trail touching this order into one chronological
// timeline: order-level events (created, sent to kitchen, status changes,
// discounts, merges), item-level events (voids), and payment events — each
// logged under its own entityType/entityId, so they have to be gathered
// separately and stitched together here. Admin and kitchen see any order
// (kitchen fulfills every table's tickets, not just ones they created); a
// waiter can see only the timeline of an order they created (e.g. "who's
// cooking my order and since when"), matching the order detail endpoint.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole('admin', 'kitchen', 'waiter', 'cashier')
    const { id } = await params

    const order = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: { items: { select: { id: true, isVoided: true } }, payments: { select: { id: true } } },
    })
    if (user.role === 'waiter' && order.createdById !== user.sub) {
      throw new ForbiddenError('You can only view the history of orders you created')
    }

    const itemIds = order.items.map((i) => i.id)
    const voidedItemIds = order.items.filter((i) => i.isVoided).map((i) => i.id)
    const paymentIds = order.payments.map((p) => p.id)

    const [auditLog, reversalTxns] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          OR: [
            { entityType: 'Order', entityId: id },
            ...(itemIds.length ? [{ entityType: 'OrderItem', entityId: { in: itemIds } }] : []),
            ...(paymentIds.length ? [{ entityType: 'Payment', entityId: { in: paymentIds } }] : []),
          ],
        },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true } } },
      }),
      voidedItemIds.length
        ? prisma.inventoryTransaction.findMany({
            where: { referenceId: { in: voidedItemIds }, reasonCode: 'order_item_void' },
            select: { referenceId: true },
          })
        : [],
    ])

    const stockReversedItemIds = [...new Set(reversalTxns.map((t) => t.referenceId!))]

    return NextResponse.json({ auditLog, stockReversedItemIds })
  } catch (err) {
    return handleApiError(err)
  }
}
