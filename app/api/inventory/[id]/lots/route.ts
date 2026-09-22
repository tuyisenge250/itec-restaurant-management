import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

// Lots in actual draw-down order: LIFO lots newest-first, then FIFO lots
// oldest-first — mirrors drawFromLots() so the UI shows exactly what would
// be consumed next.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('inventory.view_costing')
    const { id } = await params

    const [lifoLots, fifoLots] = await Promise.all([
      prisma.inventoryLot.findMany({
        where: { inventoryItemId: id, costingMethod: 'lifo', quantityRemaining: { gt: 0 } },
        orderBy: { receivedAt: 'desc' },
        include: { supplier: { select: { name: true } } },
      }),
      prisma.inventoryLot.findMany({
        where: { inventoryItemId: id, costingMethod: 'fifo', quantityRemaining: { gt: 0 } },
        orderBy: { receivedAt: 'asc' },
        include: { supplier: { select: { name: true } } },
      }),
    ])

    return NextResponse.json([...lifoLots, ...fifoLots])
  } catch (err) {
    return handleApiError(err)
  }
}
