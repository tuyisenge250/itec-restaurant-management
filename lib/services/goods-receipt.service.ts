import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { logSupplierReturn } from './inventory.service'
import { NotFoundError } from '@/lib/errors'

const GOODS_RECEIPT_INCLUDE = {
  purchaseOrder: { select: { id: true, poNumber: true, supplier: { select: { name: true } } } },
  receivedBy: { select: { name: true } },
  lines: {
    include: {
      purchaseOrderItem: { include: { inventoryItem: { select: { name: true, unit: true } } } },
      returns: { include: { returnedBy: { select: { name: true } } }, orderBy: { returnedAt: 'desc' as const } },
    },
  },
} as const

// Flat list across every PO — the standalone GRN view this feature adds
// (previously a GRN was only visible nested inside its PO's detail dialog).
export async function listGoodsReceipts() {
  return prisma.goodsReceipt.findMany({ orderBy: { receivedAt: 'desc' }, include: GOODS_RECEIPT_INCLUDE })
}

export async function getGoodsReceipt(id: string) {
  const goodsReceipt = await prisma.goodsReceipt.findUnique({ where: { id }, include: GOODS_RECEIPT_INCLUDE })
  if (!goodsReceipt) throw new NotFoundError('Goods receipt not found')
  return goodsReceipt
}

/**
 * Records goods sent back to the supplier out of one specific received
 * batch. logSupplierReturn does the actual stock move (lot-specific, capped
 * at that lot's current remaining quantity) and writes the immutable
 * InventoryTransaction; this just adds the GoodsReturn record itself and the
 * audit trail. GoodsReceiptLine.quantityReceived is never touched — the
 * return is its own append-only event, not an edit to history.
 */
export async function recordGoodsReturn(params: {
  goodsReceiptLineId: string
  quantityReturned: number
  reason: string
  actorId: string
}) {
  const { goodsReceiptLineId, quantityReturned, reason, actorId } = params

  return prisma.$transaction(async (tx) => {
    const line = await tx.goodsReceiptLine.findUnique({ where: { id: goodsReceiptLineId } })
    if (!line) throw new NotFoundError('Goods receipt line not found')

    await logSupplierReturn(tx, {
      lotId: line.inventoryLotId,
      quantity: quantityReturned,
      recordedById: actorId,
      reason,
    })

    const created = await tx.goodsReturn.create({
      data: { goodsReceiptLineId, quantityReturned, reason, returnedById: actorId },
    })

    await writeAuditLog(tx, {
      userId: actorId,
      action: 'goods_receipt.returned',
      entityType: 'GoodsReceipt',
      entityId: line.goodsReceiptId,
      afterData: created,
    })

    return created
  })
}
