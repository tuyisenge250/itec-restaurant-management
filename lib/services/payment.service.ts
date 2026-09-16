import { prisma } from '@/lib/db/prisma'
import type { PaymentMethod, Prisma, Role } from '@prisma/client'
import { toCents, sumCents } from '@/lib/money'
import { assertDiscountAllowed, assertRefundAllowed } from '@/lib/rbac'
import { writeAuditLog } from '@/lib/audit'
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/errors'

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
      await tx.order.update({ where: { id: orderId }, data: { status: 'paid' } })
    }

    return payment
  })
}

/**
 * Refunds are payment reversals only — they never touch inventory (a
 * separate waste entry is how staff record food that had to be thrown out).
 * Cumulative refunds on a payment can never exceed what was actually paid,
 * and a non-admin is further capped (REFUND_CAPS) as a percent of that
 * payment's own amount, and can only touch a payment they personally
 * recorded — an admin can refund anyone's payment, uncapped.
 */
export async function refundPayment(params: {
  paymentId: string
  amount: number
  reason: string
  userId: string
  role: Role
}) {
  const { paymentId, amount, reason, userId, role } = params

  return prisma.$transaction(async (tx: TxClient) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { refunds: true } })
    if (!payment) throw new NotFoundError('Payment not found')
    if (role !== 'admin' && payment.recordedById !== userId) {
      throw new ForbiddenError('You can only refund a payment you personally recorded')
    }

    const refundedCents = sumCents(payment.refunds.map((r) => r.amount))
    const amountCents = toCents(amount)
    const paymentCents = toCents(payment.amount)

    if (refundedCents + amountCents > paymentCents + 1) {
      throw new BusinessRuleError(
        `Refund of ${amount} exceeds the remaining refundable amount of ${((paymentCents - refundedCents) / 100).toFixed(2)}`
      )
    }

    if (role !== 'admin' && paymentCents > 0) {
      const cumulativePercent = ((refundedCents + amountCents) / paymentCents) * 100
      assertRefundAllowed(role, cumulativePercent)
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

/**
 * A refund a non-admin can't self-approve (over their cap) isn't rejected
 * outright — it's queued for an admin to approve or deny. No money moves
 * here; only approveRefundRequest actually creates a Refund.
 */
export async function requestRefund(params: {
  paymentId: string
  amount: number
  reason: string
  userId: string
  role: Role
}) {
  const { paymentId, amount, reason, userId, role } = params

  return prisma.$transaction(async (tx: TxClient) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true, refundRequests: { where: { status: 'pending' } } },
    })
    if (!payment) throw new NotFoundError('Payment not found')
    if (role !== 'admin' && payment.recordedById !== userId) {
      throw new ForbiddenError('You can only request a refund on a payment you personally recorded')
    }

    const refundedCents = sumCents(payment.refunds.map((r) => r.amount))
    const pendingRequestedCents = sumCents(payment.refundRequests.map((r) => r.amount))
    const amountCents = toCents(amount)
    const paymentCents = toCents(payment.amount)

    if (refundedCents + pendingRequestedCents + amountCents > paymentCents + 1) {
      throw new BusinessRuleError(
        `Requesting ${amount} would exceed the payment amount once already-refunded and pending requests are counted`
      )
    }

    const request = await tx.refundRequest.create({
      data: { paymentId, amount, reason, requestedById: userId },
    })

    await writeAuditLog(tx, {
      userId,
      action: 'refund_request.created',
      entityType: 'RefundRequest',
      entityId: request.id,
      afterData: request,
    })

    return request
  })
}

export async function listRefundRequests(status?: 'pending' | 'approved' | 'denied') {
  return prisma.refundRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      requestedBy: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      payment: { select: { id: true, orderId: true, method: true, amount: true, order: { select: { table: true } } } },
    },
  })
}

export async function approveRefundRequest(params: { requestId: string; adminId: string }) {
  const { requestId, adminId } = params

  return prisma.$transaction(async (tx: TxClient) => {
    // Lock the row before checking status: without this, two concurrent
    // approvals (a double-click, or two admins) can both read "pending"
    // before either commits and both create a Refund.
    const [locked] = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status FROM refund_requests WHERE id = ${requestId} FOR UPDATE
    `
    if (!locked) throw new NotFoundError('Refund request not found')
    if (locked.status !== 'pending') {
      throw new BusinessRuleError(`This request was already ${locked.status}`)
    }

    const request = await tx.refundRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { payment: { include: { refunds: true } } },
    })

    // Re-check against the CURRENT refund total — time may have passed
    // since the request was made, and another refund could have landed.
    const refundedCents = sumCents(request.payment.refunds.map((r) => r.amount))
    const amountCents = toCents(request.amount)
    const paymentCents = toCents(request.payment.amount)
    if (refundedCents + amountCents > paymentCents + 1) {
      throw new BusinessRuleError(
        `Approving this would exceed the remaining refundable amount of ${((paymentCents - refundedCents) / 100).toFixed(2)}`
      )
    }

    const refund = await tx.refund.create({
      data: {
        paymentId: request.paymentId,
        amount: request.amount,
        reason: request.reason,
        recordedById: request.requestedById,
      },
    })

    const updated = await tx.refundRequest.update({
      where: { id: requestId },
      data: { status: 'approved', reviewedById: adminId, reviewedAt: new Date(), resultingRefundId: refund.id },
    })

    await writeAuditLog(tx, {
      userId: adminId,
      action: 'refund_request.approved',
      entityType: 'RefundRequest',
      entityId: requestId,
      beforeData: request,
      afterData: updated,
    })
    await writeAuditLog(tx, {
      userId: adminId,
      action: 'payment.refunded',
      entityType: 'Refund',
      entityId: refund.id,
      afterData: refund,
    })

    return updated
  })
}

export async function denyRefundRequest(params: { requestId: string; adminId: string; denialReason?: string }) {
  const { requestId, adminId, denialReason } = params

  return prisma.$transaction(async (tx: TxClient) => {
    const [locked] = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status FROM refund_requests WHERE id = ${requestId} FOR UPDATE
    `
    if (!locked) throw new NotFoundError('Refund request not found')
    if (locked.status !== 'pending') {
      throw new BusinessRuleError(`This request was already ${locked.status}`)
    }

    const request = await tx.refundRequest.findUniqueOrThrow({ where: { id: requestId } })

    const updated = await tx.refundRequest.update({
      where: { id: requestId },
      data: { status: 'denied', reviewedById: adminId, reviewedAt: new Date(), denialReason },
    })

    await writeAuditLog(tx, {
      userId: adminId,
      action: 'refund_request.denied',
      entityType: 'RefundRequest',
      entityId: requestId,
      beforeData: request,
      afterData: updated,
    })

    return updated
  })
}
