import { NextRequest, NextResponse } from 'next/server'
import { Prisma, ProductionOrderStatus, ProductionSource, Role } from '@prisma/client'
import { requireRole } from '@/lib/auth/session'
import { createProductionOrderSchema } from '@/lib/validation/prep-production-order.schema'
import { createProductionOrder } from '@/lib/services/prep-production-order.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const STATUSES = Object.values(ProductionOrderStatus)
const SOURCES = Object.values(ProductionSource)
const ROLES = Object.values(Role)

// Admin sees every order (planning/oversight). Kitchen and waiter see every
// order too, not just their own assignedRole — they need to know what's
// outside-sourced (not theirs to act on) and what's assigned to the other
// role, same reasoning as the kitchen board seeing every table's tickets
// rather than being scoped like a waiter's regular orders are; each queue
// page filters client-side to what it actually shows action buttons for.
export async function GET(req: NextRequest) {
  try {
    await requireRole('admin', 'kitchen', 'waiter')
    const { searchParams } = req.nextUrl
    const statusParam = searchParams.get('status')
    const sourceParam = searchParams.get('source')
    const assignedRoleParam = searchParams.get('assignedRole')
    const status = STATUSES.find((s) => s === statusParam)
    const source = SOURCES.find((s) => s === sourceParam)
    const assignedRole = ROLES.find((r) => r === assignedRoleParam)

    const where: Prisma.PrepProductionOrderWhereInput = { status, source, assignedRole }

    const orders = await prisma.prepProductionOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        prepRecipe: { include: { outputItem: { select: { name: true, unit: true } } } },
        createdBy: { select: { name: true } },
        fulfillment: { select: { id: true, quantityProduced: true, recordedById: true, createdAt: true } },
      },
      take: 200,
    })

    return NextResponse.json(orders)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = createProductionOrderSchema.parse(await req.json())

    const order = await createProductionOrder({ ...body, createdById: user.sub })
    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
