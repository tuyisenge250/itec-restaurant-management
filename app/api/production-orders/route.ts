import { NextRequest, NextResponse } from 'next/server'
import { Prisma, ProductionOrderStatus, ProductionSource, ProductionTeam } from '@prisma/client'
import { requirePermission } from '@/lib/auth/session'
import { createProductionOrderSchema } from '@/lib/validation/prep-production-order.schema'
import { createProductionOrder } from '@/lib/services/prep-production-order.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const STATUSES = Object.values(ProductionOrderStatus)
const SOURCES = Object.values(ProductionSource)
const TEAMS = Object.values(ProductionTeam)

// Admin sees every order (planning/oversight). Kitchen and waiter see every
// order too, not just their own assignedTeam — they need to know what's
// outside-sourced (not theirs to act on) and what's assigned to the other
// team, same reasoning as the kitchen board seeing every table's tickets
// rather than being scoped like a waiter's regular orders are; each queue
// page filters client-side to what it actually shows action buttons for.
export async function GET(req: NextRequest) {
  try {
    await requirePermission('production_orders.view')
    const { searchParams } = req.nextUrl
    const statusParam = searchParams.get('status')
    const sourceParam = searchParams.get('source')
    const assignedTeamParam = searchParams.get('assignedTeam')
    const status = STATUSES.find((s) => s === statusParam)
    const source = SOURCES.find((s) => s === sourceParam)
    const assignedTeam = TEAMS.find((t) => t === assignedTeamParam)

    const where: Prisma.PrepProductionOrderWhereInput = { status, source, assignedTeam }

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
    const user = await requirePermission('production_orders.manage')
    const body = createProductionOrderSchema.parse(await req.json())

    const order = await createProductionOrder({ ...body, createdById: user.sub })
    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
