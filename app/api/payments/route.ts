import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { createPaymentSchema } from '@/lib/validation/payment.schema'
import { recordPayment } from '@/lib/services/payment.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    await requireRole('admin', 'waiter')
    const orderId = req.nextUrl.searchParams.get('orderId') ?? undefined

    const payments = await prisma.payment.findMany({
      where: orderId ? { orderId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { refunds: true },
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
