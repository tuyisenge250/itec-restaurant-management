import { prisma } from '@/lib/db/prisma'
import type { PaymentMethod, Prisma, Role } from '@prisma/client'
import { toCents, sumCents } from '@/lib/money'
import { assertDiscountAllowed } from '@/lib/rbac'
import { writeAuditLog } from '@/lib/audit'
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/errors'

type TxClient = Prisma.TransactionClient

const PAYABLE_STATUSES = ['ready', 'served'] as const

/**
 * Records a payment (possibly one of several split across methods). All
 * comparisons happen in integer cents. A payment's own `discount` reduces
 * the balance the same way the order-level discount does — once
 * sum(payments.amount) == subtotal - orderDiscount - sum(payments.discount),
 * the order moves to 'payment_pending', NOT straight to 'paid' — the waiter
 * has collected the money and can hand over a receipt right here, but a
 * cashier still has to reconcile and confirm it (confirmOrderPayment
 * below) before it's booked as actually paid. Overpaying beyond the
 * remaining balance is rejected rather than silently accepted.
 */
export async function recordPayment(params: {
  orderId: string
  method: PaymentMethod
  amount: number
  discount: number
  discountReason?: string
  notes?: string
  userId: string
  role: Role
}) {
  const { orderId, method, amount, discount, discountReason, notes, userId, role } = params

  return prisma.$transaction(async (tx: TxClient) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    })
    if (!order) throw new NotFoundError('Order not found')
    if (role !== 'admin' && order.createdById !== userId) {
      throw new ForbiddenError('Only the order\'s own waiter or an admin can record a payment for it')
    }
    if (!PAYABLE_STATUSES.includes(order.status as (typeof PAYABLE_STATUSES)[number])) {
      throw new BusinessRuleError(`Cannot record a payment for an order in status ${order.status}`)
    }

    if (discount > 0) {
      if (!discountReason) throw new BusinessRuleError('discountReason is required for a non-zero payment discount')
    }

    const subtotalCents = sumCents(
      order.items.filter((i) => !i.isVoided).map((i) => i.priceAtSale * i.quantity)
    )
    const orderDiscountCents = order.discountAmount
      ? toCents(order.discountAmount)
      : order.discountPercent
        ? Math.round((subtotalCents * order.discountPercent) / 100)
        : 0

    if (discount > 0) {
      const impliedPercent = subtotalCents > 0 ? (toCents(discount) / subtotalCents) * 100 : 0
      assertDiscountAllowed(role, impliedPercent)
    }

    const existingAmountCents = sumCents(order.payments.map((p) => p.amount))
    const existingDiscountCents = sumCents(order.payments.map((p) => p.discount))
    const newDiscountCents = toCents(discount)
    const newAmountCents = toCents(amount)

    const requiredAmountCents = Math.max(
      subtotalCents - orderDiscountCents - existingDiscountCents - newDiscountCents,
      0
    )
    const remainingCents = requiredAmountCents - existingAmountCents

    if (newAmountCents > remainingCents + 1) {
      throw new BusinessRuleError(
        `Payment of ${amount} exceeds the remaining balance of ${(remainingCents / 100).toFixed(2)}`
      )
    }

    const payment = await tx.payment.create({
      data: { orderId, method, amount, discount, notes, recordedById: userId },
    })

    if (discount > 0) {
      await writeAuditLog(tx, {
        userId,
        action: 'payment.discount_applied',
        entityType: 'Payment',
        entityId: payment.id,
        afterData: { ...payment, discountReason },
      })
    }

    const fullyPaid = existingAmountCents + newAmountCents >= requiredAmountCents - 1
    if (fullyPaid) {
      await tx.order.update({ where: { id: orderId }, data: { status: 'payment_pending' } })
    }

    return payment
  })
}

/**
 * Cashier's reconciliation step: closes out an order that's collected full
 * payment (payment_pending) by booking it as actually paid. This is the
 * ONLY thing that ever sets status to 'paid' — recordPayment above
 * deliberately stops short of it.
 */
export async function confirmOrderPayment(params: { orderId: string; userId: string; role: string }) {
  const { orderId, userId, role } = params
  if (role !== 'admin' && role !== 'cashier') {
    throw new ForbiddenError('Only cashier or admin can confirm a payment as received')
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundError('Order not found')
    if (order.status !== 'payment_pending') {
      throw new BusinessRuleError(`Cannot confirm payment for an order in status ${order.status}`)
    }

    const updated = await tx.order.update({ where: { id: orderId }, data: { status: 'paid' } })

    await writeAuditLog(tx, {
      userId,
      action: 'order.payment_confirmed',
      entityType: 'Order',
      entityId: orderId,
      beforeData: { status: order.status },
      afterData: { status: updated.status },
    })

    return updated
  })
}
