import { NextRequest, NextResponse } from 'next/server'
import { Prisma, StockLocation, StockRequisitionStatus } from '@prisma/client'
import { requirePermission } from '@/lib/auth/session'
import { createRequisitionSchema } from '@/lib/validation/stock-requisition.schema'
import { createRequisition } from '@/lib/services/stock-requisition.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const LOCATIONS = Object.values(StockLocation)
const STATUSES = Object.values(StockRequisitionStatus)

// Unscoped like /api/production-orders — kitchen and cashier pages pass
// their own `location` filter client-side rather than being force-scoped
// server-side, since nothing here is more sensitive than stock levels
// already visible on the shared inventory list.
export async function GET(req: NextRequest) {
  try {
    await requirePermission('requisitions.manage')
    const { searchParams } = req.nextUrl
    const location = LOCATIONS.find((l) => l === searchParams.get('location'))
    const status = STATUSES.find((s) => s === searchParams.get('status'))

    const where: Prisma.StockRequisitionWhereInput = { location, status }

    const requisitions = await prisma.stockRequisition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { inventoryItem: { select: { name: true, unit: true } } } },
        requestedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
        receivedBy: { select: { name: true } },
        linkedPurchaseOrder: { select: { id: true, poNumber: true, status: true, createdAt: true } },
      },
      take: 200,
    })

    return NextResponse.json(requisitions)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('requisitions.manage')
    const body = createRequisitionSchema.parse(await req.json())

    const requisition = await createRequisition({
      ...body,
      requestedById: user.sub,
      permissions: user.role.permissions,
      homeArea: user.role.homeArea,
    })
    return NextResponse.json(requisition, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
