import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const updateInventoryItemSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  itemType: z.enum(['raw', 'prepared', 'finished_good']).optional(),
  reorderLevel: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('inventory.view')
    const { id } = await params
    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })
    return NextResponse.json(item)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('inventory.manage')
    const { id } = await params
    const body = updateInventoryItemSchema.parse(await req.json())
    const item = await prisma.inventoryItem.update({ where: { id }, data: body })
    return NextResponse.json(item)
  } catch (err) {
    return handleApiError(err)
  }
}

// Deactivation is the real "delete": an item with any receiving/consumption
// history is never hard-deleted (that would destroy the ledger). Only an
// item with zero history and no lots is actually removed from the table.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('inventory.manage')
    const { id } = await params

    const [lotCount, txnCount] = await Promise.all([
      prisma.inventoryLot.count({ where: { inventoryItemId: id } }),
      prisma.inventoryTransaction.count({ where: { inventoryItemId: id } }),
    ])

    if (lotCount > 0 || txnCount > 0) {
      await prisma.inventoryItem.update({ where: { id }, data: { isActive: false } })
      return new NextResponse(null, { status: 204 })
    }

    await prisma.inventoryItem.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
