import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const createInventoryItemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  itemType: z.enum(['raw', 'prepared', 'finished_good']).default('raw'),
  reorderLevel: z.number().nonnegative().default(0),
})

// Any staff role can view inventory levels (kitchen needs this to know
// what's available; waiters don't hit this directly today but nothing here
// is sensitive). Stock quantities themselves are always derived from lots.
export async function GET() {
  try {
    await requireRole('admin', 'kitchen', 'waiter')
    const items = await prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { lots: { where: { quantityRemaining: { gt: 0 } }, select: { quantityRemaining: true, unitCost: true } } },
    })

    const withValuation = items.map(({ lots, ...item }) => ({
      ...item,
      stockValue: lots.reduce((sum, lot) => sum + lot.quantityRemaining * lot.unitCost, 0),
    }))

    return NextResponse.json(withValuation)
  } catch (err) {
    return handleApiError(err)
  }
}

// Registers a new inventory item with zero stock — stock only ever enters
// via a goods receipt, a prep production run, or a manual "found stock"
// adjustment (see /api/inventory/adjust), never directly here.
export async function POST(req: NextRequest) {
  try {
    await requireRole('admin')
    const body = createInventoryItemSchema.parse(await req.json())
    const item = await prisma.inventoryItem.create({ data: body })
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
