import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

// Per-order lot/cost drill-down: exactly which lots (and their real prices)
// were drawn on to fulfill this order — makes the lot-based costing model
// provable rather than a single opaque number.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('admin')
    const { id } = await params

    const order = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { menuItem: { select: { name: true } } } } },
    })

    const orderItemIds = order.items.map((i) => i.id)
    const transactions = await prisma.inventoryTransaction.findMany({
      where: { referenceId: { in: orderItemIds }, type: { in: ['consumption', 'adjustment'] } },
      include: { inventoryItem: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const byOrderItem = order.items.map((item) => ({
      orderItemId: item.id,
      menuItemName: item.menuItem.name,
      quantity: item.quantity,
      costAtSale: item.costAtSale,
      isVoided: item.isVoided,
      lots: transactions
        .filter((t) => t.referenceId === item.id)
        .map((t) => ({
          type: t.type,
          inventoryItemName: t.inventoryItem.name,
          unit: t.inventoryItem.unit,
          quantity: t.quantity,
          unitCost: t.unitCost,
          reasonCode: t.reasonCode,
        })),
    }))

    return NextResponse.json({ orderId: id, items: byOrderItem })
  } catch (err) {
    return handleApiError(err)
  }
}
