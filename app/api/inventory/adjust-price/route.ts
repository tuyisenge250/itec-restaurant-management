import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { adjustLotPriceSchema } from '@/lib/validation/inventory.schema'
import { adjustLotPrice } from '@/lib/services/inventory.service'
import { writeAuditLog } from '@/lib/audit'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = adjustLotPriceSchema.parse(await req.json())

    await prisma.$transaction(async (tx) => {
      const before = await tx.inventoryLot.findUniqueOrThrow({ where: { id: body.lotId } })
      await adjustLotPrice(tx, { ...body, recordedById: user.sub })
      const after = await tx.inventoryLot.findUniqueOrThrow({ where: { id: body.lotId } })

      await writeAuditLog(tx, {
        userId: user.sub,
        action: 'inventory_lot.price_adjusted',
        entityType: 'InventoryLot',
        entityId: body.lotId,
        beforeData: before,
        afterData: after,
      })
    })

    return new NextResponse(null, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
