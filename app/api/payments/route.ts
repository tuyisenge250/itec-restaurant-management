import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createPaymentSchema } from '@/lib/validation/payment.schema'
import { prisma } from '@/lib/db/prisma'
import { updateOrderStatus } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    if (user.role !== 'waiter' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized for this action' }, { status: 403 })
    }

    const body = createPaymentSchema.parse(await req.json())

    const payment = await prisma.payment.create({
      data: { ...body, recordedById: user.sub },
    })

    await updateOrderStatus({ orderId: body.orderId, newStatus: 'paid', updatedById: user.sub })

    return NextResponse.json(payment, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}