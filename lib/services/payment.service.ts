import { prisma } from '@/lib/db/prisma'
import type { PaymentMethod, Prisma, Role } from '@prisma/client'
import { toCents, sumCents } from '@/lib/money'
import { assertDiscountAllowed } from '@/lib/rbac'
import { writeAuditLog } from '@/lib/audit'
import { BusinessRuleError, NotFoundError } from '@/lib/errors'

type TxClient = Prisma.TransactionClient

const PAYABLE_STATUSES = ['ready', 'served'] as const

/**
 * Records a payment (possibly one of several split across methods). All
 * comparisons happen in integer cents. A payment's own `discount` reduces
 * the balance the same way the order-level discount does — once
 * sum(payments.amount) == subtotal - orderDiscount - sum(payments.discount),
 * the order is marked paid. Overpaying beyond the remaining balance is
 * rejected rather than silently accepted.
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
      await tx.order.update({ where: { id: orderId }, data: { status: 'paid' } })
    }

    return payment
  })
}

/**
 * Refunds are payment reversals only — they never touch inventory (a
 * separate waste entry is how staff record food that had to be thrown out).
 * Cumulative refunds on a payment can never exceed what was actually paid.
 */
export async function refundPayment(params: {
  paymentId: string
  amount: number
  reason: string
  userId: string
}) {
  const { paymentId, amount, reason, userId } = params

  return prisma.$transaction(async (tx: TxClient) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { refunds: true } })
    if (!payment) throw new NotFoundError('Payment not found')

    const refundedCents = sumCents(payment.refunds.map((r) => r.amount))
    const amountCents = toCents(amount)
    const paymentCents = toCents(payment.amount)

    if (refundedCents + amountCents > paymentCents + 1) {
      throw new BusinessRuleError(
        `Refund of ${amount} exceeds the remaining refundable amount of ${((paymentCents - refundedCents) / 100).toFixed(2)}`
      )
    }

    const refund = await tx.refund.create({
      data: { paymentId, amount, reason, recordedById: userId },
    })

    await writeAuditLog(tx, {
      userId,
      action: 'payment.refunded',
      entityType: 'Refund',
      entityId: refund.id,
      afterData: refund,
    })

    return refund
  })
}
