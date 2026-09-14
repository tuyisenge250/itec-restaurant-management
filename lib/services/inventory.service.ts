import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

/**
 * Records a stock receipt (goods arriving from a supplier) and updates
 * the item's weighted-average unit cost. Runs inside a transaction so the
 * ledger row and the cached stock/cost fields never drift out of sync.
 */
export async function receiveStock(params: {
  inventoryItemId: string
  quantity: number
  unitCost: number
  referenceId?: string // e.g. purchaseOrderId
  recordedById: string
  notes?: string
}) {
  const { inventoryItemId, quantity, unitCost, referenceId, recordedById, notes } = params

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } })

    // Weighted-average cost: blend existing stock value with the new receipt
    const existingValue = item.currentStock * item.avgUnitCost
    const incomingValue = quantity * unitCost
    const newStock = item.currentStock + quantity
    const newAvgCost = newStock > 0 ? (existingValue + incomingValue) / newStock : unitCost

    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId,
        type: 'receipt',
        quantity,
        unitCost,
        referenceId,
        recordedById,
        notes,
      },
    })

    return tx.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { currentStock: newStock, avgUnitCost: newAvgCost },
    })
  })
}

/**
 * Deducts inventory for every ingredient used in an order's items, based on
 * each menu item's recipe. Called when an order transitions to 'ready'.
 * Also returns the total cost consumed, so the caller can snapshot it
 * onto the order items as costAtSale.
 */
export async function deductForOrder(orderId: string, recordedById: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { menuItem: { include: { recipeItems: true } } } } },
    })

    for (const orderItem of order.items) {
      for (const recipeItem of orderItem.menuItem.recipeItems) {
        const consumedQty = recipeItem.quantity * orderItem.quantity

        const invItem = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: recipeItem.inventoryItemId },
        })

        if (invItem.currentStock < consumedQty) {
          throw new Error(
            `Insufficient stock for ${invItem.name}: need ${consumedQty}${invItem.unit}, have ${invItem.currentStock}${invItem.unit}`
          )
        }

        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: recipeItem.inventoryItemId,
            type: 'consumption',
            quantity: -consumedQty,
            unitCost: invItem.avgUnitCost,
            referenceId: orderId,
            recordedById,
          },
        })

        await tx.inventoryItem.update({
          where: { id: recipeItem.inventoryItemId },
          data: { currentStock: { decrement: consumedQty } },
        })
      }
    }

    return { orderId, status: 'deducted' }
  })
}

/**
 * Logs a manual waste/spoilage write-off, separate from order-driven consumption.
 */
export async function logWaste(params: {
  inventoryItemId: string
  quantity: number
  recordedById: string
  notes?: string
}) {
  const { inventoryItemId, quantity, recordedById, notes } = params

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } })

    if (item.currentStock < quantity) {
      throw new Error(`Cannot waste more than available stock for ${item.name}`)
    }

    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId,
        type: 'waste',
        quantity: -quantity,
        unitCost: item.avgUnitCost,
        recordedById,
        notes,
      },
    })

    return tx.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { currentStock: { decrement: quantity } },
    })
  })
}

export type ReceiveStockInput = Prisma.InventoryTransactionUncheckedCreateInput