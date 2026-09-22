import { NextRequest, NextResponse } from 'next/server'
import { Prisma, OrderStatus } from '@prisma/client'
import { requirePermission } from '@/lib/auth/session'
import { createOrderSchema } from '@/lib/validation/order.schema'
import { createOrder } from '@/lib/services/order.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'
import { parseUpperBoundDate } from '@/lib/date-range'

const ORDER_STATUSES = Object.values(OrderStatus)

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('orders.manage_own', 'orders.manage_all')
    const body = createOrderSchema.parse(await req.json())
    const order = await createOrder({ ...body, createdById: user.sub })

    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}

// Admin's order-operations page passes filters (status/table/waiter/date
// range) and sees every order. Kitchen and cashier need every order too —
// kitchen to fulfill any table's prep tickets, cashier for the same reason
// over direct-serve items plus its broader oversight role. A waiter gets
// none of that — they see only orders they personally created, force-
// scoped here (not client-side) so there's no way to see another waiter's
// ticket by requesting this endpoint directly, regardless of what the UI
// shows.
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission('orders.manage_own', 'orders.view_all')
    const { searchParams } = req.nextUrl
    const statusParam = searchParams.get('status')
    const status = ORDER_STATUSES.find((s) => s === statusParam)
    const table = searchParams.get('table') || undefined
    const waiterId = !user.role.permissions.includes('orders.view_all')
      ? user.sub
      : searchParams.get('waiterId') || undefined
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    // The kitchen/cashier boards must never see the other's item type (or
    // orders made up of nothing else) — scoped server-side, not filtered
    // client-side, same reasoning as the waiter scoping above.
    const view = searchParams.get('view')
    const kitchenView = view === 'kitchen'
    const cashierView = view === 'cashier'

    const where: Prisma.OrderWhereInput = {
      status,
      table: table ? { contains: table, mode: 'insensitive' } : undefined,
      createdById: waiterId,
      items: kitchenView
        ? { some: { requiresPreparation: true } }
        : cashierView
          ? { some: { requiresPreparation: false } }
          : undefined,
    }
    if (from || to) {
      where.createdAt = { gte: from ? new Date(from) : undefined, lte: to ? parseUpperBoundDate(to) : undefined }
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            menuItem: { select: { name: true, variantLabel: true } },
            preparedBy: { select: { name: true } },
            voidedBy: { select: { name: true } },
          },
        },
        createdBy: { select: { name: true } },
        startedBy: { select: { name: true } },
      },
      take: 200,
    })

    const result = kitchenView
      ? orders.map((o) => ({ ...o, items: o.items.filter((i) => i.requiresPreparation) }))
      : cashierView
        ? orders.map((o) => ({ ...o, items: o.items.filter((i) => !i.requiresPreparation) }))
        : orders

    return NextResponse.json(result)
  } catch (err) {
    return handleApiError(err)
  }
}
