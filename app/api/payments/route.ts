import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/session'
import { createPaymentSchema } from '@/lib/validation/payment.schema'
import { recordPayment } from '@/lib/services/payment.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole('admin', 'waiter')
    const orderId = req.nextUrl.searchParams.get('orderId') ?? undefined

    // A waiter only ever sees payments on orders they created — same rule
    // as the orders list itself, enforced here too since payments are
    // fetchable independently by orderId.
    const where: Prisma.PaymentWhereInput = { orderId }
    if (user.role === 'waiter') {
      where.order = { createdById: user.sub }
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        recordedBy: { select: { name: true } },
        refunds: { include: { recordedBy: { select: { name: true } } } },
        refundRequests: { orderBy: { createdAt: 'desc' }, include: { reviewedBy: { select: { name: true } } } },
      },
      take: 100,
    })
    return NextResponse.json(payments)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('waiter', 'admin')
    const body = createPaymentSchema.parse(await req.json())

    const payment = await recordPayment({ ...body, userId: user.sub, role: user.role })
    return NextResponse.json(payment, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
