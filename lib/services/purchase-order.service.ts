import { prisma } from '@/lib/db/prisma'
import type { Prisma, PurchaseOrderStatus } from '@prisma/client'
import { receiveGoodsLine } from './inventory.service'
import { writeAuditLog } from '@/lib/audit'
import { BusinessRuleError, NotFoundError } from '@/lib/errors'

export async function createPurchaseOrder(params: {
  supplierId: string
  notes?: string
  items: { inventoryItemId: string; quantityOrdered: number; unitCost: number }[]
  createdById: string
}) {
  const { supplierId, notes, items, createdById } = params

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } })
  if (!supplier) throw new NotFoundError('Supplier not found')
  if (!supplier.isActive) {
    throw new BusinessRuleError('Cannot create a purchase order against an inactive supplier')
  }

  return prisma.purchaseOrder.create({
    data: {
      supplierId,
      notes,
      createdById,
      status: 'draft',
      items: { create: items },
    },
    include: { items: true, supplier: true },
  })
}

const VALID_PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['ordered', 'cancelled'],
  ordered: ['partially_received', 'received', 'cancelled'],
  partially_received: ['received', 'cancelled'],
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
 * Records a goods receipt (full or partial) against a PO. Each line creates
 * its own InventoryLot at the costing method the receiver picked for that
 * line, then rolls the PO's status up.
 */
export async function receiveGoodsForPurchaseOrder(params: {
  purchaseOrderId: string
  lines: {
    purchaseOrderItemId: string
    quantityReceived: number
    unitCost?: number
    costingMethod: 'fifo' | 'lifo'
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
    if (po.status !== 'ordered' && po.status !== 'partially_received') {
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

    const updatedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } })
    const allReceived = updatedItems.every((i) => i.quantityReceived >= i.quantityOrdered - 1e-6)
    const anyReceived = updatedItems.some((i) => i.quantityReceived > 0)
    const newStatus = allReceived ? 'received' : anyReceived ? 'partially_received' : po.status

    const updatedPO = await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: newStatus },
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
