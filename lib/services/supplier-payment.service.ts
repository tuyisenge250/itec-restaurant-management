import { prisma } from '@/lib/db/prisma'
import type { PaymentMethod, PurchaseOrderStatus } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { BusinessRuleError, NotFoundError } from '@/lib/errors'

const PAYABLE_STATUSES: PurchaseOrderStatus[] = ['ordered', 'partially_received', 'received']

/**
 * Records money actually paid to a supplier against a PO. Deliberately does
 * NOT cap the amount at the outstanding balance — a deposit paid ahead of
 * (or beyond) what's been received is a real thing, and shows up as a
 * credit rather than being rejected. Can only be recorded once the PO has
 * actually been placed with the supplier (not draft/pending_approval,
 * which haven't committed to anything yet, and not cancelled).
 */
export async function recordSupplierPayment(params: {
  purchaseOrderId: string
  amount: number
  method: PaymentMethod
  notes?: string
  recordedById: string
}) {
  const { purchaseOrderId, amount, method, notes, recordedById } = params

  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } })
    if (!po) throw new NotFoundError('Purchase order not found')
    if (!PAYABLE_STATUSES.includes(po.status)) {
      throw new BusinessRuleError(`Cannot record a payment against a purchase order in status ${po.status}`)
    }

    const payment = await tx.supplierPayment.create({
      data: { purchaseOrderId, supplierId: po.supplierId, amount, method, notes, recordedById },
    })

    await writeAuditLog(tx, {
      userId: recordedById,
      action: 'supplier_payment.recorded',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrderId,
      afterData: payment,
    })

    return payment
  })
}

/**
 * A supplier's full procurement + payment history: every PO they've had,
 * with what was actually received (the real invoiced value, not just what
 * was ordered) against what's been paid. "Owed" is received value minus
 * paid — you don't owe for goods that haven't arrived yet.
 */
export async function getSupplierHistory(supplierId: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } })
  if (!supplier) throw new NotFoundError('Supplier not found')

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { supplierId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      goodsReceipts: { include: { lines: true } },
      payments: true,
    },
  })

  const orders = purchaseOrders.map((po) => {
    const orderedValue = po.items.reduce((s, i) => s + i.quantityOrdered * i.unitCost, 0)
    const receivedValue = po.goodsReceipts.reduce(
      (s, gr) => s + gr.lines.reduce((s2, l) => s2 + l.quantityReceived * l.unitCost, 0),
      0
    )
    const paidValue = po.payments.reduce((s, p) => s + p.amount, 0)
    return {
      id: po.id,
      status: po.status,
      createdAt: po.createdAt,
      orderedValue,
      receivedValue,
      paidValue,
      owed: receivedValue - paidValue,
    }
  })

  const totals = orders.reduce(
    (acc, o) => ({
      orderedValue: acc.orderedValue + o.orderedValue,
      receivedValue: acc.receivedValue + o.receivedValue,
      paidValue: acc.paidValue + o.paidValue,
      owed: acc.owed + o.owed,
    }),
    { orderedValue: 0, receivedValue: 0, paidValue: 0, owed: 0 }
  )

  return {
    supplier: { id: supplier.id, name: supplier.name, paymentTerms: supplier.paymentTerms },
    orders,
    totals,
  }
}
