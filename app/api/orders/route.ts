import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createOrderSchema } from '@/lib/validation/order.schema'
import { createOrder } from '@/lib/services/order.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    if (user.role !== 'waiter' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized for this action' }, { status: 403 })
    }

    const body = createOrderSchema.parse(await req.json())
    const order = await createOrder({ ...body, createdById: user.sub })

    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function GET() {
  try {
    await requireUser() // any authenticated role can list orders (admin/kitchen/waiter)

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { menuItem: { select: { name: true } } } } },
      take: 50,
    })

    return NextResponse.json(orders)
  } catch (err) {
    return handleApiError(err)
  }
}