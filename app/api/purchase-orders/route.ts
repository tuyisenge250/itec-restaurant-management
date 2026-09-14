import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { createPurchaseOrderSchema } from '@/lib/validation/purchase-order.schema'
import { createPurchaseOrder } from '@/lib/services/purchase-order.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
    await requireRole('admin')
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { name: true } },
        items: { include: { inventoryItem: { select: { name: true, unit: true } } } },
      },
    })
    return NextResponse.json(purchaseOrders)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = createPurchaseOrderSchema.parse(await req.json())
    const po = await createPurchaseOrder({ ...body, createdById: user.sub })
    return NextResponse.json(po, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
