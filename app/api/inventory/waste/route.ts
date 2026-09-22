import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { logWasteSchema } from '@/lib/validation/inventory.schema'
import { logWaste } from '@/lib/services/inventory.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

// Kitchen sees only their own entries; admin sees the full log.
export async function GET() {
  try {
    const user = await requirePermission('inventory.waste')

    const entries = await prisma.inventoryTransaction.findMany({
      where: {
        type: 'waste',
        recordedById: user.role.permissions.includes('inventory.manage') ? undefined : user.sub,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        inventoryItem: { select: { name: true, unit: true } },
        recordedBy: { select: { name: true } },
      },
      take: 100,
    })

    return NextResponse.json(entries)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('inventory.waste')
    const body = logWasteSchema.parse(await req.json())

    await prisma.$transaction((tx) => logWaste(tx, { ...body, recordedById: user.sub }))

    return new NextResponse(null, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
