import { Prisma, type InventoryTransactionSource } from '@prisma/client'
import { InsufficientStockError, BusinessRuleError, NotFoundError } from '@/lib/errors'
import { recomputeAvailabilityForIngredient } from './menu.service'

type TxClient = Prisma.TransactionClient

// Floating-point quantities (kg/l) can leave tiny residues; treat anything
// under this as "fully consumed" / "sufficient" rather than blocking on dust.
const EPSILON = 1e-6

type LotRow = { id: string; quantityRemaining: number; unitCost: number }
export type LotDraw = { lotId: string; quantity: number; unitCost: number }

/**
 * Recomputes InventoryItem.currentStock from the lots themselves so it can
 * never drift from the source of truth. Called after every lot mutation.
 */
export async function syncCurrentStock(tx: TxClient, inventoryItemId: string) {
  const { _sum } = await tx.inventoryLot.aggregate({
    where: { inventoryItemId },
    _sum: { quantityRemaining: true },
  })
  await tx.inventoryItem.update({
    where: { id: inventoryItemId },
    data: { currentStock: _sum.quantityRemaining ?? 0 },
  })

  await recomputeAvailabilityForIngredient(tx, inventoryItemId)
}

/**
 * The one shared LIFO-then-FIFO draw-down algorithm. Row-locks every
 * candidate lot for this item (LIFO lots newest-first, then FIFO lots
 * oldest-first) before deciding anything, so two concurrent callers can't
 * both read the same "available" quantity and both succeed. If the locked
 * total is short, throws before describing any draw — callers must not
 * consume partially on failure.
 */
export async function drawFromLots(
  tx: TxClient,
  inventoryItemId: string,
  quantity: number
): Promise<LotDraw[]> {
  if (quantity <= 0) throw new BusinessRuleError('Quantity to draw must be positive')

  const lifoLots = await tx.$queryRaw<LotRow[]>`
    SELECT id, "quantityRemaining", "unitCost" FROM inventory_lots
    WHERE "inventoryItemId" = ${inventoryItemId} AND "costingMethod" = 'lifo' AND "quantityRemaining" > 0
    ORDER BY "receivedAt" DESC
    FOR UPDATE
  `
  const fifoLots = await tx.$queryRaw<LotRow[]>`
    SELECT id, "quantityRemaining", "unitCost" FROM inventory_lots
    WHERE "inventoryItemId" = ${inventoryItemId} AND "costingMethod" = 'fifo' AND "quantityRemaining" > 0
    ORDER BY "receivedAt" ASC
    FOR UPDATE
  `

  const candidates = [...lifoLots, ...fifoLots]
  const available = candidates.reduce((sum, l) => sum + l.quantityRemaining, 0)

  if (available + EPSILON < quantity) {
    const item = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } })
    throw new InsufficientStockError(
      `Insufficient stock for ${item?.name ?? inventoryItemId}: need ${quantity}${item?.unit ?? ''}, have ${available}${item?.unit ?? ''}`
    )
  }

  const draws: LotDraw[] = []
  let remaining = quantity
  for (const lot of candidates) {
    if (remaining <= EPSILON) break
    const take = Math.min(lot.quantityRemaining, remaining)
    if (take <= EPSILON) continue
    draws.push({ lotId: lot.id, quantity: take, unitCost: lot.unitCost })
    remaining -= take
  }

  return draws
}

/**
 * Consumes `quantity` of an item via LIFO-then-FIFO draw-down, writing one
 * InventoryTransaction per lot actually touched (each keeping its own real
 * price — never averaged). Must be called with a transaction the caller
 * already opened (order fulfillment, prep production, and waste all need to
 * lock/consume multiple items or lots atomically in one outer transaction).
 */
export async function consumeStock(
  tx: TxClient,
  params: {
    inventoryItemId: string
    quantity: number
    referenceId?: string
    source: InventoryTransactionSource
    recordedById: string
  }
): Promise<{ totalCost: number; draws: LotDraw[] }> {
  const { inventoryItemId, quantity, referenceId, source, recordedById } = params
  const draws = await drawFromLots(tx, inventoryItemId, quantity)

  let totalCost = 0
  for (const draw of draws) {
    await tx.inventoryLot.update({
      where: { id: draw.lotId },
      data: { quantityRemaining: { decrement: draw.quantity } },
    })
    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId,
        lotId: draw.lotId,
        type: 'consumption',
        source,
        quantity: -draw.quantity,
        unitCost: draw.unitCost,
        referenceId,
        recordedById,
      },
    })
    totalCost += draw.quantity * draw.unitCost
  }

  await syncCurrentStock(tx, inventoryItemId)
  return { totalCost, draws }
}

/**
 * Read-only check: would `quantity` of this item be available to draw right
 * now? Used to pre-validate a whole batch (order line, prep production run)
 * before committing to consuming any of it. Does NOT lock rows — it's a
 * best-effort check; the actual consumeStock call re-validates under lock.
 */
export async function hasSufficientStock(
  tx: TxClient,
  inventoryItemId: string,
  quantity: number
): Promise<boolean> {
  const item = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } })
  return (item?.currentStock ?? 0) + EPSILON >= quantity
}

/**
 * Compensates a prior consumption (order item void) by crediting back the
 * exact lots it was drawn from, at the exact prices originally used — not a
 * flag flip. Looks up the original consumption transactions by referenceId
 * (the order item's id).
 */
export async function reverseConsumption(
  tx: TxClient,
  params: { inventoryItemId: string; referenceId: string; recordedById: string; reasonCode: string }
) {
  const { inventoryItemId, referenceId, recordedById, reasonCode } = params

  const original = await tx.inventoryTransaction.findMany({
    where: { inventoryItemId, referenceId, type: 'consumption' },
  })

  for (const txn of original) {
    await tx.inventoryLot.update({
      where: { id: txn.lotId },
      data: { quantityRemaining: { increment: -txn.quantity } }, // txn.quantity is negative
    })
    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId,
        lotId: txn.lotId,
        type: 'adjustment',
        source: 'manual_adjustment',
        quantity: -txn.quantity,
        unitCost: txn.unitCost,
        referenceId,
        reasonCode,
        recordedById,
      },
    })
  }

  await syncCurrentStock(tx, inventoryItemId)
}

/**
 * Creates one InventoryLot + receipt transaction for a single goods-receipt
 * line. The receiver picks the costing method explicitly per line — never
 * defaulted from the item or PO.
 */
export async function receiveGoodsLine(
  tx: TxClient,
  params: {
    inventoryItemId: string
    supplierId?: string | null
    quantity: number
    unitCost: number
    costingMethod: 'fifo' | 'lifo'
    referenceId?: string
    recordedById: string
  }
) {
  const { inventoryItemId, supplierId, quantity, unitCost, costingMethod, referenceId, recordedById } =
    params

  const lot = await tx.inventoryLot.create({
    data: {
      inventoryItemId,
      supplierId: supplierId ?? undefined,
      costingMethod,
      unitCost,
      quantityReceived: quantity,
      quantityRemaining: quantity,
    },
  })

  await tx.inventoryTransaction.create({
    data: {
      inventoryItemId,
      lotId: lot.id,
      type: 'receipt',
      source: 'purchase_order',
      quantity,
      unitCost,
      referenceId,
      recordedById,
    },
  })

  await syncCurrentStock(tx, inventoryItemId)
  return lot
}

/**
 * Waste/spoilage write-off. Always lot-specific — the caller must say which
 * batch was wasted, not just which item.
 */
export async function logWaste(
  tx: TxClient,
  params: { lotId: string; quantity: number; recordedById: string; notes?: string }
) {
  const { lotId, quantity, recordedById, notes } = params
  if (quantity <= 0) throw new BusinessRuleError('Waste quantity must be positive')

  const [lot] = await tx.$queryRaw<
    { id: string; inventoryItemId: string; quantityRemaining: number; unitCost: number }[]
  >`
    SELECT id, "inventoryItemId", "quantityRemaining", "unitCost" FROM inventory_lots
    WHERE id = ${lotId}
    FOR UPDATE
  `
  if (!lot) throw new NotFoundError('Inventory lot not found')
  if (lot.quantityRemaining + EPSILON < quantity) {
    throw new InsufficientStockError(
      `Cannot waste ${quantity} from a lot that only has ${lot.quantityRemaining} remaining`
    )
  }

  await tx.inventoryLot.update({
    where: { id: lotId },
    data: { quantityRemaining: { decrement: quantity } },
  })
  await tx.inventoryTransaction.create({
    data: {
      inventoryItemId: lot.inventoryItemId,
      lotId,
      type: 'waste',
      source: 'waste',
      quantity: -quantity,
      unitCost: lot.unitCost,
      recordedById,
      notes,
    },
  })

  await syncCurrentStock(tx, lot.inventoryItemId)
}

/**
 * Corrects a lot's unit cost (e.g. the receiving price was entered wrong).
 * No stock moves, so it's logged as a zero-quantity adjustment transaction —
 * separate from adjustStock, which exists specifically to reject zero deltas
 * for quantity corrections.
 */
export async function adjustLotPrice(
  tx: TxClient,
  params: {
    lotId: string
    newUnitCost: number
    reasonCode: string
    recordedById: string
    notes?: string
  }
) {
  const { lotId, newUnitCost, reasonCode, recordedById, notes } = params
  if (!reasonCode) throw new BusinessRuleError('A reason code is required for price corrections')
  if (newUnitCost <= 0) throw new BusinessRuleError('Unit cost must be positive')

  const [lot] = await tx.$queryRaw<
    { id: string; inventoryItemId: string; unitCost: number }[]
  >`
    SELECT id, "inventoryItemId", "unitCost" FROM inventory_lots
    WHERE id = ${lotId}
    FOR UPDATE
  `
  if (!lot) throw new NotFoundError('Inventory lot not found')
  if (newUnitCost === lot.unitCost) {
    throw new BusinessRuleError('New unit cost is the same as the current unit cost')
  }

  await tx.inventoryLot.update({
    where: { id: lotId },
    data: { unitCost: newUnitCost },
  })
  await tx.inventoryTransaction.create({
    data: {
      inventoryItemId: lot.inventoryItemId,
      lotId,
      type: 'adjustment',
      source: 'manual_adjustment',
      quantity: 0,
      unitCost: newUnitCost,
      reasonCode,
      recordedById,
      notes: `Unit cost corrected from ${lot.unitCost} to ${newUnitCost}${notes ? ` — ${notes}` : ''}`,
    },
  })
}

/**
 * Manual stock correction against one specific lot. Positive = found stock,
 * negative = correction — either way requires a reason code, and a negative
 * adjustment can never take a lot below zero remaining.
 */
export async function adjustStock(
  tx: TxClient,
  params: {
    lotId: string
    quantity: number // signed delta
    reasonCode: string
    recordedById: string
    notes?: string
  }
) {
  const { lotId, quantity, reasonCode, recordedById, notes } = params
  if (!reasonCode) throw new BusinessRuleError('A reason code is required for manual adjustments')
  if (quantity === 0) throw new BusinessRuleError('Adjustment quantity cannot be zero')

  const [lot] = await tx.$queryRaw<
    { id: string; inventoryItemId: string; quantityRemaining: number; unitCost: number }[]
  >`
    SELECT id, "inventoryItemId", "quantityRemaining", "unitCost" FROM inventory_lots
    WHERE id = ${lotId}
    FOR UPDATE
  `
  if (!lot) throw new NotFoundError('Inventory lot not found')
  if (lot.quantityRemaining + quantity < -EPSILON) {
    throw new BusinessRuleError('Adjustment would take this lot below zero remaining')
  }

  await tx.inventoryLot.update({
    where: { id: lotId },
    data: { quantityRemaining: { increment: quantity } },
  })
  await tx.inventoryTransaction.create({
    data: {
      inventoryItemId: lot.inventoryItemId,
      lotId,
      type: 'adjustment',
      source: 'manual_adjustment',
      quantity,
      unitCost: lot.unitCost,
      reasonCode,
      recordedById,
      notes,
    },
  })

  await syncCurrentStock(tx, lot.inventoryItemId)
}
