import { prisma } from '@/lib/db/prisma'
import type { Prisma, StockLocation } from '@prisma/client'
import { consumeStock } from './inventory.service'
import { writeAuditLog } from '@/lib/audit'
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/errors'

type TxClient = Prisma.TransactionClient

const EPSILON = 1e-6

// Kitchen location maps to the `kitchen` homeArea; bar maps to `cashier` —
// there is no separate "bar" homeArea in this app. This is a business-routing
// concept (which team owns this location), not a permission — a role needs
// both the base requisitions.manage permission AND a matching homeArea,
// unless it holds requisitions.review (today: only admin), which — same as
// orders.manage_all / production_orders.fulfill_any elsewhere — bypasses the
// location match entirely.
const LOCATION_HOME_AREA: Record<StockLocation, string> = { kitchen: 'kitchen', bar: 'cashier' }

const REQUISITION_DETAIL_INCLUDE = {
  items: { include: { inventoryItem: { select: { name: true, unit: true } } } },
  requestedBy: { select: { name: true } },
  reviewedBy: { select: { name: true } },
  receivedBy: { select: { name: true } },
} satisfies Prisma.StockRequisitionInclude

/**
 * Places a requisition — pure planning, nothing moves yet. Kitchen can only
 * request for kitchen, cashier only for bar (their location's counterpart);
 * admin can request for either on someone's behalf.
 */
export async function createRequisition(params: {
  location: StockLocation
  items: { inventoryItemId: string; quantityRequested: number }[]
  notes?: string
  requestedById: string
  permissions: string[]
  homeArea: string
}) {
  const { location, items, notes, requestedById, permissions, homeArea } = params
  const canManageAnyLocation = permissions.includes('requisitions.review')
  if (!canManageAnyLocation && homeArea !== LOCATION_HOME_AREA[location]) {
    throw new ForbiddenError(`Only ${LOCATION_HOME_AREA[location]} or admin can request stock for ${location}`)
  }

  return prisma.$transaction(async (tx) => {
    const requisition = await tx.stockRequisition.create({
      data: {
        location,
        notes,
        requestedById,
        items: {
          create: items.map((i) => ({ inventoryItemId: i.inventoryItemId, quantityRequested: i.quantityRequested })),
        },
      },
      include: REQUISITION_DETAIL_INCLUDE,
    })

    await writeAuditLog(tx, {
      userId: requestedById,
      action: 'stock_requisition.created',
      entityType: 'StockRequisition',
      entityId: requisition.id,
      afterData: requisition,
    })

    return requisition
  })
}

/**
 * Admin sends the requisition: stock actually leaves main storage right
 * here, drawn LIFO-then-FIFO exactly like any other consumption, scaled to
 * whatever quantityApproved admin sets per line (may be less than what was
 * requested — a partial send, not a reject). Locks the row first so it can't
 * be reviewed twice at once.
 */
export async function approveRequisition(params: {
  requisitionId: string
  items: { itemId: string; quantityApproved: number }[]
  reviewNotes?: string
  userId: string
  permissions: string[]
}) {
  const { requisitionId, items, reviewNotes, userId, permissions } = params
  if (!permissions.includes('requisitions.review')) {
    throw new ForbiddenError('Only admin can approve a stock requisition')
  }

  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status FROM stock_requisitions WHERE id = ${requisitionId} FOR UPDATE
    `
    if (!locked) throw new NotFoundError('Stock requisition not found')
    if (locked.status !== 'pending') {
      throw new BusinessRuleError(`Cannot approve a requisition in status ${locked.status}`)
    }

    const requisition = await tx.stockRequisition.findUniqueOrThrow({
      where: { id: requisitionId },
      include: { items: true },
    })

    for (const line of items) {
      const reqItem = requisition.items.find((i) => i.id === line.itemId)
      if (!reqItem) throw new NotFoundError(`Requisition line ${line.itemId} not found on this requisition`)

      if (line.quantityApproved > EPSILON) {
        await consumeStock(tx, {
          inventoryItemId: reqItem.inventoryItemId,
          quantity: line.quantityApproved,
          referenceId: requisitionId,
          source: 'stock_requisition',
          recordedById: userId,
        })
      }
      await tx.stockRequisitionItem.update({
        where: { id: line.itemId },
        data: { quantityApproved: line.quantityApproved },
      })
    }

    const updated = await tx.stockRequisition.update({
      where: { id: requisitionId },
      data: { status: 'approved', reviewedById: userId, reviewedAt: new Date(), reviewNotes },
    })

    await writeAuditLog(tx, {
      userId,
      action: 'stock_requisition.approved',
      entityType: 'StockRequisition',
      entityId: requisitionId,
      beforeData: { status: locked.status },
      afterData: { status: updated.status, items },
    })

    return tx.stockRequisition.findUniqueOrThrow({ where: { id: requisitionId }, include: REQUISITION_DETAIL_INCLUDE })
  })
}

/** Admin sends it back — terminal, nothing was ever deducted so nothing to reverse. */
export async function rejectRequisition(params: {
  requisitionId: string
  reviewNotes: string
  userId: string
  permissions: string[]
}) {
  const { requisitionId, reviewNotes, userId, permissions } = params
  if (!permissions.includes('requisitions.review')) {
    throw new ForbiddenError('Only admin can reject a stock requisition')
  }

  return prisma.$transaction(async (tx) => {
    const requisition = await tx.stockRequisition.findUnique({ where: { id: requisitionId } })
    if (!requisition) throw new NotFoundError('Stock requisition not found')
    if (requisition.status !== 'pending') {
      throw new BusinessRuleError(`Cannot reject a requisition in status ${requisition.status}`)
    }

    const updated = await tx.stockRequisition.update({
      where: { id: requisitionId },
      data: { status: 'rejected', reviewedById: userId, reviewedAt: new Date(), reviewNotes },
    })

    await writeAuditLog(tx, {
      userId,
      action: 'stock_requisition.rejected',
      entityType: 'StockRequisition',
      entityId: requisitionId,
      beforeData: { status: requisition.status },
      afterData: { status: updated.status, reviewNotes },
    })

    return updated
  })
}

/** The requester pulling back their own pending request, or admin doing it for them. */
export async function cancelRequisition(params: { requisitionId: string; userId: string; permissions: string[] }) {
  const { requisitionId, userId, permissions } = params

  return prisma.$transaction(async (tx) => {
    const requisition = await tx.stockRequisition.findUnique({ where: { id: requisitionId } })
    if (!requisition) throw new NotFoundError('Stock requisition not found')
    if (!permissions.includes('requisitions.review') && requisition.requestedById !== userId) {
      throw new ForbiddenError('Only the requester or admin can cancel this requisition')
    }
    if (requisition.status !== 'pending') {
      throw new BusinessRuleError(`Cannot cancel a requisition in status ${requisition.status}`)
    }

    const updated = await tx.stockRequisition.update({ where: { id: requisitionId }, data: { status: 'cancelled' } })

    await writeAuditLog(tx, {
      userId,
      action: 'stock_requisition.cancelled',
      entityType: 'StockRequisition',
      entityId: requisitionId,
      beforeData: { status: requisition.status },
      afterData: { status: updated.status },
    })

    return updated
  })
}

/**
 * The location confirms what actually arrived — may differ from
 * quantityApproved (breakage/shortage in transit). Credits LocationStock and
 * closes the requisition out; there's no partial-receipt state, one
 * confirmation per requisition.
 */
export async function receiveRequisition(params: {
  requisitionId: string
  items: { itemId: string; quantityReceived: number }[]
  userId: string
  permissions: string[]
  homeArea: string
}) {
  const { requisitionId, items, userId, permissions, homeArea } = params

  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: string; status: string; location: StockLocation }[]>`
      SELECT id, status, location FROM stock_requisitions WHERE id = ${requisitionId} FOR UPDATE
    `
    if (!locked) throw new NotFoundError('Stock requisition not found')
    if (locked.status !== 'approved') {
      throw new BusinessRuleError(`Cannot receive a requisition in status ${locked.status}`)
    }
    if (!permissions.includes('requisitions.review') && homeArea !== LOCATION_HOME_AREA[locked.location]) {
      throw new ForbiddenError(`Only ${LOCATION_HOME_AREA[locked.location]} or admin can receive this requisition`)
    }

    const requisition = await tx.stockRequisition.findUniqueOrThrow({
      where: { id: requisitionId },
      include: { items: true },
    })

    for (const line of items) {
      const reqItem = requisition.items.find((i) => i.id === line.itemId)
      if (!reqItem) throw new NotFoundError(`Requisition line ${line.itemId} not found on this requisition`)

      if (line.quantityReceived > EPSILON) {
        await tx.locationStock.upsert({
          where: { inventoryItemId_location: { inventoryItemId: reqItem.inventoryItemId, location: requisition.location } },
          create: { inventoryItemId: reqItem.inventoryItemId, location: requisition.location, quantity: line.quantityReceived },
          update: { quantity: { increment: line.quantityReceived } },
        })
        await tx.locationStockTransaction.create({
          data: {
            inventoryItemId: reqItem.inventoryItemId,
            location: requisition.location,
            type: 'receipt',
            quantity: line.quantityReceived,
            referenceId: requisitionId,
            recordedById: userId,
          },
        })
      }
      await tx.stockRequisitionItem.update({ where: { id: line.itemId }, data: { quantityReceived: line.quantityReceived } })
    }

    const updated = await tx.stockRequisition.update({
      where: { id: requisitionId },
      data: { status: 'received', receivedById: userId, receivedAt: new Date() },
    })

    await writeAuditLog(tx, {
      userId,
      action: 'stock_requisition.received',
      entityType: 'StockRequisition',
      entityId: requisitionId,
      beforeData: { status: locked.status },
      afterData: { status: updated.status, items },
    })

    return tx.stockRequisition.findUniqueOrThrow({ where: { id: requisitionId }, include: REQUISITION_DETAIL_INCLUDE })
  })
}

/**
 * Admin's direct correction of a location's stock — found stock, breakage
 * discovered later, etc. Always requires a reason code, mirrors
 * adjustStock's lot-level counterpart.
 */
export async function adjustLocationStock(params: {
  inventoryItemId: string
  location: StockLocation
  quantity: number
  reasonCode: string
  notes?: string
  userId: string
  permissions: string[]
}) {
  const { inventoryItemId, location, quantity, reasonCode, notes, userId, permissions } = params
  if (!permissions.includes('location_stock.adjust')) {
    throw new ForbiddenError('Only admin can adjust location stock directly')
  }

  return prisma.$transaction(async (tx: TxClient) => {
    const existing = await tx.locationStock.findUnique({
      where: { inventoryItemId_location: { inventoryItemId, location } },
    })
    const currentQty = existing?.quantity ?? 0
    if (currentQty + quantity < -EPSILON) {
      throw new BusinessRuleError('Adjustment would take this location stock below zero')
    }

    await tx.locationStock.upsert({
      where: { inventoryItemId_location: { inventoryItemId, location } },
      create: { inventoryItemId, location, quantity },
      update: { quantity: { increment: quantity } },
    })
    await tx.locationStockTransaction.create({
      data: { inventoryItemId, location, type: 'adjustment', quantity, reasonCode, recordedById: userId, notes },
    })

    await writeAuditLog(tx, {
      userId,
      action: 'location_stock.adjusted',
      entityType: 'LocationStock',
      entityId: `${inventoryItemId}:${location}`,
      beforeData: { quantity: currentQty },
      afterData: { quantity: currentQty + quantity },
    })
  })
}
