import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

// One row per active item: main (= InventoryItem.currentStock, unchanged by
// any of this), kitchen and bar (= LocationStock, moved only by a received
// requisition or an admin adjustment). Same "nothing here is sensitive"
// visibility as /api/inventory — kitchen/cashier can see every location's
// level, not just their own, since knowing what main has available is what
// tells them whether a requisition is worth making.
export async function GET() {
  try {
    await requirePermission('location_stock.view')
    const items = await prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { locationStocks: true },
    })

    const projection = items.map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      main: item.currentStock,
      kitchen: item.locationStocks.find((l) => l.location === 'kitchen')?.quantity ?? 0,
      bar: item.locationStocks.find((l) => l.location === 'bar')?.quantity ?? 0,
    }))

    return NextResponse.json(projection)
  } catch (err) {
    return handleApiError(err)
  }
}
