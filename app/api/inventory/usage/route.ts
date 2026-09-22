import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

// Total ingredient consumption for one calendar day — both order fulfillment
// (source: sale) and prep production input both count as "used", since
// kitchen staff care about total draw-down, not just what went into a dish.
// Defaults to today when no date is given.
export async function GET(req: NextRequest) {
  try {
    await requirePermission('inventory.view_costing')
    const dateParam = req.nextUrl.searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

    const grouped = await prisma.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: {
        type: 'consumption',
        source: { in: ['sale', 'prep_production'] },
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      _sum: { quantity: true },
    })

    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: grouped.map((g) => g.inventoryItemId) } },
      select: { id: true, name: true, unit: true },
    })
    const itemById = new Map(items.map((i) => [i.id, i]))

    const usage = grouped
      .map((g) => {
        const item = itemById.get(g.inventoryItemId)
        return {
          inventoryItemId: g.inventoryItemId,
          name: item?.name ?? 'Unknown item',
          unit: item?.unit ?? '',
          totalUsed: Math.abs(g._sum.quantity ?? 0),
        }
      })
      .sort((a, b) => b.totalUsed - a.totalUsed)

    return NextResponse.json(usage)
  } catch (err) {
    return handleApiError(err)
  }
}
