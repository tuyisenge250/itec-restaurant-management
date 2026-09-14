import { prisma } from '@/lib/db/prisma'
import { receiveStock } from './inventory.service'

export async function createPurchaseOrder(params: {
  supplierId: string
  notes?: string
  items: { inventoryItemId: string; quantityOrdered: number; unitCost: number }[]
  createdById: string
}) {
  const { supplierId, notes, items, createdById } = params

  return prisma.purchaseOrder.create({
    data: {
      supplierId,
      notes,
      createdById,
      status: 'ordered',
      items: { create: items },
    },
    include: { items: true, supplier: true },
  })
}

/**
 * Records goods receipt against a purchase order: writes an inventory
 * receipt transaction per item (updating stock + weighted-avg cost),
 * updates each PurchaseOrderItem.quantityReceived, and rolls the PO
 * status up to 'received' or 'partially_received'.
 */
export async function receivePurchaseOrder(params: {
  purchaseOrderId: string
  items: { purchaseOrderItemId: string; quantityReceived: number }[]
  recordedById: string
}) {
  const { purchaseOrderId, items, recordedById } = params

  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { items: true },
    })

    for (const receipt of items) {
      const poItem = po.items.find((i) => i.id === receipt.purchaseOrderItemId)
      if (!poItem) throw new Error(`Purchase order item ${receipt.purchaseOrderItemId} not found`)

      const remaining = poItem.quantityOrdered - poItem.quantityReceived
      if (receipt.quantityReceived > remaining) {
        throw new Error(
          `Cannot receive ${receipt.quantityReceived} — only ${remaining} remaining on this line`
        )
      }

      // receiveStock runs its own nested transaction context via `tx` isn't
      // directly reusable here since it opens $transaction itself, so we
      // inline the stock update logic within this outer transaction instead.
      const invItem = await tx.inventoryItem.findUniqueOrThrow({
        where: { id: poItem.inventoryItemId },
      })
      const existingValue = invItem.currentStock * invItem.avgUnitCost
      const incomingValue = receipt.quantityReceived * poItem.unitCost
      const newStock = invItem.currentStock + receipt.quantityReceived
      const newAvgCost = newStock > 0 ? (existingValue + incomingValue) / newStock : poItem.unitCost

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: poItem.inventoryItemId,
          type: 'receipt',
          quantity: receipt.quantityReceived,
          unitCost: poItem.unitCost,
          referenceId: purchaseOrderId,
          recordedById,
        },
      })

      await tx.inventoryItem.update({
        where: { id: poItem.inventoryItemId },
        data: { currentStock: newStock, avgUnitCost: newAvgCost },
      })

      await tx.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: { quantityReceived: { increment: receipt.quantityReceived } },
      })
    }

    const updatedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } })
    const allReceived = updatedItems.every((i) => i.quantityReceived >= i.quantityOrdered)
    const anyReceived = updatedItems.some((i) => i.quantityReceived > 0)

    return tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: allReceived ? 'received' : anyReceived ? 'partially_received' : 'ordered' },
      include: { items: true },
    })
  })
}

export { receiveStock }