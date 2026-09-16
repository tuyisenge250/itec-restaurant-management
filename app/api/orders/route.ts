import { NextRequest, NextResponse } from 'next/server'
import { Prisma, OrderStatus } from '@prisma/client'
import { requireRole } from '@/lib/auth/session'
import { createOrderSchema } from '@/lib/validation/order.schema'
import { createOrder } from '@/lib/services/order.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const ORDER_STATUSES = Object.values(OrderStatus)

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('waiter', 'admin')
    const body = createOrderSchema.parse(await req.json())
    const order = await createOrder({ ...body, createdById: user.sub })

    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}

// Admin's order-operations page passes filters (status/table/waiter/date
// range) and sees every order. Kitchen needs every order too, to fulfill
// any table's tickets. A waiter gets none of that — they see only orders
// they personally created, force-scoped here (not client-side) so there's
// no way to see another waiter's ticket by requesting this endpoint
// directly, regardless of what the UI shows.
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole('admin', 'kitchen', 'waiter')
    const { searchParams } = req.nextUrl
    const statusParam = searchParams.get('status')
    const status = ORDER_STATUSES.find((s) => s === statusParam)
    const table = searchParams.get('table') || undefined
    const waiterId = user.role === 'waiter' ? user.sub : searchParams.get('waiterId') || undefined
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Prisma.OrderWhereInput = {
      status,
      table: table ? { contains: table, mode: 'insensitive' } : undefined,
      createdById: waiterId,
    }
    if (from || to) {
      where.createdAt = { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined }
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            menuItem: { select: { name: true } },
            preparedBy: { select: { name: true } },
            voidedBy: { select: { name: true } },
          },
        },
        createdBy: { select: { name: true } },
        startedBy: { select: { name: true } },
      },
      take: 200,
    })

    return NextResponse.json(orders)
  } catch (err) {
    return handleApiError(err)
  }
}
