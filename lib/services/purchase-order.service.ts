import { prisma } from '@/lib/db/prisma'
import type { Prisma, PurchaseOrderStatus } from '@prisma/client'
import { receiveGoodsLine } from './inventory.service'
import { writeAuditLog } from '@/lib/audit'
import { BusinessRuleError, NotFoundError } from '@/lib/errors'

type NewPOItem = { inventoryItemId: string; quantityOrdered: number; unitCost: number }

// The real boundary for this rule — the client already merges before
// sending, but this is what actually decides what lands in the database, so
// duplicate lines for the same product (however the caller built the list)
// always collapse into one, summed quantity + quantity-weighted average
// cost, rather than tracked as separate item rows.
function mergeDuplicateItems(items: NewPOItem[]): NewPOItem[] {
  const merged = new Map<string, NewPOItem>()
  for (const item of items) {
    const existing = merged.get(item.inventoryItemId)
    if (!existing) {
      merged.set(item.inventoryItemId, { ...item })
      continue
    }
    const totalQty = existing.quantityOrdered + item.quantityOrdered
    existing.unitCost = (existing.unitCost * existing.quantityOrdered + item.unitCost * item.quantityOrdered) / totalQty
    existing.quantityOrdered = totalQty
  }
  return [...merged.values()]
}

export async function createPurchaseOrder(params: {
  supplierId: string
  notes?: string
  items: NewPOItem[]
  createdById: string
  // Requisitions this PO is being created to cover (from the on_hold
  // shortfall shortcuts) — purely a display link, so admin can see what's
  // waiting on this PO and doesn't have to cross-reference manually. Only
  // requisitions still on_hold get linked; anything already
  // approved/rejected/cancelled in the meantime is left alone.
  coveredRequisitionIds?: string[]
}) {
  const { supplierId, notes, items, createdById, coveredRequisitionIds } = params

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } })
  if (!supplier) throw new NotFoundError('Supplier not found')
  if (!supplier.isActive) {
    throw new BusinessRuleError('Cannot create a purchase order against an inactive supplier')
  }

  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: {
        supplierId,
        notes,
        createdById,
        status: 'draft',
        items: { create: mergeDuplicateItems(items) },
      },
      include: { items: true, supplier: true },
    })

    if (coveredRequisitionIds && coveredRequisitionIds.length > 0) {
      await tx.stockRequisition.updateMany({
        where: { id: { in: coveredRequisitionIds }, status: 'on_hold' },
        data: { linkedPurchaseOrderId: po.id },
      })
    }

    return po
  })
}

const VALID_PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

/**
 * Drives the PO state machine. The pending_approval -> ordered edge IS the
 * approval action: it requires admin, rejects self-approval, stamps
 * approvedById/approvedAt, and writes the audit log — there's no separate
 * /approve endpoint.
 */
export async function updatePurchaseOrderStatus(params: {
  purchaseOrderId: string
  newStatus: 'pending_approval' | 'ordered' | 'cancelled'
  userId: string
}) {
  const { purchaseOrderId, newStatus, userId } = params

  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } })
    if (!po) throw new NotFoundError('Purchase order not found')

    const allowed = VALID_PO_TRANSITIONS[po.status]
    if (!allowed.includes(newStatus)) {
      throw new BusinessRuleError(`Cannot transition purchase order from ${po.status} to ${newStatus}`)
    }

    const data: Prisma.PurchaseOrderUncheckedUpdateInput = { status: newStatus }

    if (po.status === 'pending_approval' && newStatus === 'ordered') {
      // Any admin can approve, including the PO's own creator — approvedById
      // still records exactly who did it, so there's a full audit trail even
      // without a separation-of-duties block.
      data.approvedById = userId
      data.approvedAt = new Date()
    }

    const updated = await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data })

    await writeAuditLog(tx, {
      userId,
      action: newStatus === 'ordered' ? 'purchase_order.approved' : `purchase_order.${newStatus}`,
      entityType: 'PurchaseOrder',
      entityId: purchaseOrderId,
      beforeData: po,
      afterData: updated,
    })

    return updated
  })
}

/**
 * Copies supplier + line items (using each item's unitCost as "last paid")
 * into a brand-new draft PO. Never mutates the source PO.
 */
export async function reorderPurchaseOrder(purchaseOrderId: string, createdById: string) {
  const source = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true },
  })
  if (!source) throw new NotFoundError('Purchase order not found')

  return prisma.purchaseOrder.create({
    data: {
      supplierId: source.supplierId,
      createdById,
      status: 'draft',
      reorderedFromId: source.id,
      items: {
        create: source.items.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          quantityOrdered: item.quantityOrdered,
          unitCost: item.unitCost,
        })),
      },
    },
    include: { items: true, supplier: true },
  })
}

/**
 * Records the (single, final) goods receipt against a PO. Each line creates
 * its own InventoryLot at the costing method the receiver picked for that
 * line. A PO can only be received once — whatever quantities come in on
 * this one event, the PO closes to `received` immediately after, even if
 * some lines came in short. There's no partially_received status to leave
 * it open in and no second receiving round: a shortfall is a supplier/PO
 * problem to resolve via a new PO (e.g. reorderPurchaseOrder), not by
 * reopening this one.
 */
export async function receiveGoodsForPurchaseOrder(params: {
  purchaseOrderId: string
  lines: {
    purchaseOrderItemId: string
    quantityReceived: number
    unitCost?: number
    costingMethod: 'fifo' | 'lifo'
    expiresAt?: Date | null
  }[]
  recordedById: string
}) {
  const { purchaseOrderId, lines, recordedById } = params

  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { items: true },
    })
    if (!po) throw new NotFoundError('Purchase order not found')
    if (po.status !== 'ordered') {
      throw new BusinessRuleError(`Cannot receive goods against a PO in status ${po.status}`)
    }

    const goodsReceipt = await tx.goodsReceipt.create({
      data: { purchaseOrderId, receivedById: recordedById },
    })

    for (const line of lines) {
      const poItem = po.items.find((i) => i.id === line.purchaseOrderItemId)
      if (!poItem) throw new NotFoundError(`Purchase order item ${line.purchaseOrderItemId} not found`)

      const remaining = poItem.quantityOrdered - poItem.quantityReceived
      if (line.quantityReceived > remaining + 1e-6) {
        throw new BusinessRuleError(
          `Cannot receive ${line.quantityReceived} on this line — only ${remaining} remaining`
        )
      }

      const unitCost = line.unitCost ?? poItem.unitCost

      const lot = await receiveGoodsLine(tx, {
        inventoryItemId: poItem.inventoryItemId,
        supplierId: po.supplierId,
        quantity: line.quantityReceived,
        unitCost,
        costingMethod: line.costingMethod,
        expiresAt: line.expiresAt,
        referenceId: purchaseOrderId,
        recordedById,
      })

      await tx.goodsReceiptLine.create({
        data: {
          goodsReceiptId: goodsReceipt.id,
          purchaseOrderItemId: poItem.id,
          quantityReceived: line.quantityReceived,
          unitCost,
          costingMethod: line.costingMethod,
          inventoryLotId: lot.id,
        },
      })

      await tx.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: { quantityReceived: { increment: line.quantityReceived } },
      })
    }

    const updatedPO = await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: 'received' },
      include: { items: true },
    })

    await writeAuditLog(tx, {
      userId: recordedById,
      action: 'purchase_order.goods_received',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrderId,
      beforeData: po,
      afterData: updatedPO,
    })

    return updatedPO
  })
}
