import { prisma } from '@/lib/db/prisma'
import type { OrderStatus, Prisma } from '@prisma/client'
import { consumeStock, reverseConsumption } from './inventory.service'
import { writeAuditLog } from '@/lib/audit'
import { assertDiscountAllowed } from '@/lib/rbac'
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors'

type TxClient = Prisma.TransactionClient
type OrderItemInput = { menuItemId: string; quantity: number }
const EPSILON = 1e-6

/**
 * Resolves each requested line to its recipe, aggregates required quantity
 * per ingredient across ALL lines in the request (so two lines sharing an
 * ingredient can't each pass an independent check that together overshoot
 * stock), and rejects with the specific ingredient that's short. This is a
 * best-effort early check — the authoritative, lock-protected check happens
 * again at kitchen fulfillment since stock can move between now and then.
 */
async function assertItemsServable(tx: TxClient, items: OrderItemInput[]) {
  const menuItems = await tx.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) } },
    include: { recipeItems: { include: { inventoryItem: true } } },
  })

  const required = new Map<string, { quantity: number; item: { name: string; unit: string; currentStock: number } }>()

  for (const line of items) {
    const menuItem = menuItems.find((m) => m.id === line.menuItemId)
    if (!menuItem) throw new NotFoundError(`Menu item ${line.menuItemId} not found`)
    if (!menuItem.isAvailable) {
      throw new BusinessRuleError(`${menuItem.name} is currently unavailable`)
    }

    for (const recipeItem of menuItem.recipeItems) {
      const need = recipeItem.quantity * line.quantity
      const existing = required.get(recipeItem.inventoryItemId)
      required.set(recipeItem.inventoryItemId, {
        quantity: (existing?.quantity ?? 0) + need,
        item: recipeItem.inventoryItem,
      })
    }
  }

  for (const [, { quantity, item }] of required) {
    if (item.currentStock + EPSILON < quantity) {
      throw new BusinessRuleError(
        `Insufficient stock for ${item.name}: need ${quantity}${item.unit}, have ${item.currentStock}${item.unit}`
      )
    }
  }

  return menuItems
}

/**
 * Creates an order after checking every line against current ingredient
 * stock (never silently accepting and failing later at fulfillment), and
 * rejects a second concurrent order on a table that already has one open.
 */
export async function createOrder(params: {
  table: string
  items: OrderItemInput[]
  createdById: string
}) {
  const { table, items, createdById } = params

  return prisma.$transaction(async (tx) => {
    const openOrder = await tx.order.findFirst({
      where: { table, status: { notIn: ['paid', 'cancelled'] } },
    })
    if (openOrder) {
      throw new ConflictError(`Table ${table} already has an open order`)
    }

    const menuItems = await assertItemsServable(tx, items)

    const snapshotItems = items.map((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId)!
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        priceAtSale: menuItem.price,
        costAtSale: 0, // finalized with the real consumed cost at fulfillment
      }
    })

    const created = await tx.order.create({
      data: {
        table,
        createdById,
        status: 'pending',
        items: { create: snapshotItems },
      },
      include: { items: true },
    })

    await writeAuditLog(tx, {
      userId: createdById,
      action: 'order.created',
      entityType: 'Order',
      entityId: created.id,
      afterData: created,
    })

    return created
  })
}

export async function updateOrderItems(params: {
  orderId: string
  add: OrderItemInput[]
  removeItemIds: string[]
  userId: string
  role: string
}) {
  const { orderId, add, removeItemIds, userId, role } = params

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundError('Order not found')
    if (role !== 'admin' && order.createdById !== userId) {
      throw new ForbiddenError('Only the order\'s own waiter or an admin can edit its items')
    }
    if (order.status !== 'pending') {
      throw new ConflictError('Order items can only be edited while the order is pending')
    }

    if (removeItemIds.length > 0) {
      await tx.orderItem.deleteMany({ where: { id: { in: removeItemIds }, orderId } })
    }

    if (add.length > 0) {
      const menuItems = await assertItemsServable(tx, add)
      await tx.orderItem.createMany({
        data: add.map((item) => ({
          orderId,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          priceAtSale: menuItems.find((m) => m.id === item.menuItemId)!.price,
          costAtSale: 0,
        })),
      })
    }

    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
  })
}

const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served'],
  served: [], // -> paid is only ever set by the payment service
  paid: [],
  cancelled: [],
}

// A waiter no longer pushes an order into the kitchen queue directly —
// sending it to the kitchen was a status change waiters could trigger
// themselves; now only kitchen (or admin) can pull an order out of pending
// by explicitly starting it, which is what pending->preparing now means.
const ROLE_ALLOWED_TARGETS: Record<string, OrderStatus[]> = {
  admin: ['preparing', 'ready', 'served', 'cancelled'],
  kitchen: ['preparing', 'ready'],
  waiter: ['served', 'cancelled'],
}

export async function updateOrderStatus(params: {
  orderId: string
  newStatus: 'preparing' | 'ready' | 'served' | 'cancelled'
  userId: string
  role: string
}) {
  const { orderId, newStatus, userId, role } = params

  if (!ROLE_ALLOWED_TARGETS[role]?.includes(newStatus)) {
    throw new ForbiddenError(`${role} cannot move an order to ${newStatus}`)
  }

  return prisma.$transaction(async (tx) => {
    // Lock the row before checking status/ownership — without this, two
    // kitchen users clicking "Start preparing" on the same pending order at
    // once could both succeed, defeating "whoever starts it owns it".
    const [locked] = await tx.$queryRaw<{ id: string; status: string; startedById: string | null }[]>`
      SELECT id, status, "startedById" FROM orders WHERE id = ${orderId} FOR UPDATE
    `
    if (!locked) throw new NotFoundError('Order not found')

    // Once a kitchen user has claimed an order (started it), only they —
    // or an admin — can advance it further; other kitchen staff can still
    // see it but any action on it is rejected.
    if (role === 'kitchen' && locked.startedById && locked.startedById !== userId) {
      throw new ForbiddenError('This order is already being handled by another kitchen user')
    }

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { menuItem: { include: { recipeItems: true } } } } },
    })

    const allowed = VALID_ORDER_TRANSITIONS[locked.status as OrderStatus]
    if (!allowed.includes(newStatus)) {
      throw new BusinessRuleError(`Cannot transition order from ${locked.status} to ${newStatus}`)
    }

    if (newStatus === 'ready') {
      // Stock only actually leaves the shelf here. Re-validate under lock —
      // it may have moved since the order was created — and reject cleanly
      // (not a crash) if something's now short.
      for (const orderItem of order.items) {
        if (orderItem.isVoided) continue

        let ingredientCost = 0
        for (const recipeItem of orderItem.menuItem.recipeItems) {
          const { totalCost } = await consumeStock(tx, {
            inventoryItemId: recipeItem.inventoryItemId,
            quantity: recipeItem.quantity * orderItem.quantity,
            source: 'sale',
            referenceId: orderItem.id,
            recordedById: userId,
          })
          ingredientCost += totalCost
        }

        const costPerUnit = ingredientCost / orderItem.quantity + orderItem.menuItem.preparationCost
        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: { costAtSale: costPerUnit, preparedById: userId, preparedAt: new Date() },
        })
      }
    }

    const data: Prisma.OrderUncheckedUpdateInput = { status: newStatus }
    if (locked.status === 'pending' && newStatus === 'preparing') {
      data.startedById = userId
      data.startedAt = new Date()
    }

    const updated = await tx.order.update({ where: { id: orderId }, data })

    await writeAuditLog(tx, {
      userId,
      action: 'order.status_changed',
      entityType: 'Order',
      entityId: orderId,
      beforeData: { status: order.status },
      afterData: { status: updated.status },
    })

    return updated
  })
}

export async function voidOrderItem(params: {
  orderItemId: string
  voidReason: string
  userId: string
  role: string
}) {
  const { orderItemId, voidReason, userId, role } = params

  return prisma.$transaction(async (tx) => {
    const orderItem = await tx.orderItem.findUnique({ where: { id: orderItemId }, include: { order: true } })
    if (!orderItem) throw new NotFoundError('Order item not found')
    if (role === 'kitchen' && orderItem.order.startedById && orderItem.order.startedById !== userId) {
      throw new ForbiddenError('This order is already being handled by another kitchen user')
    }
    if (orderItem.isVoided) throw new ConflictError('Order item is already voided')
    if (orderItem.order.status === 'pending' || orderItem.order.status === 'cancelled' || orderItem.order.status === 'paid') {
      throw new BusinessRuleError(`Cannot void an item on an order in status ${orderItem.order.status}`)
    }

    // Stock was only deducted once the order reached 'ready' or later.
    const stockAlreadyDeducted = orderItem.order.status === 'ready' || orderItem.order.status === 'served'
    if (stockAlreadyDeducted) {
      const consumptionTxns = await tx.inventoryTransaction.findMany({
        where: { referenceId: orderItemId, type: 'consumption' },
      })
      const inventoryItemIds = [...new Set(consumptionTxns.map((t) => t.inventoryItemId))]
      for (const inventoryItemId of inventoryItemIds) {
        await reverseConsumption(tx, {
          inventoryItemId,
          referenceId: orderItemId,
          recordedById: userId,
          reasonCode: 'order_item_void',
        })
      }
    }

    const updated = await tx.orderItem.update({
      where: { id: orderItemId },
      data: { isVoided: true, voidedById: userId, voidedAt: new Date(), voidReason },
    })

    await writeAuditLog(tx, {
      userId,
      action: 'order_item.voided',
      entityType: 'OrderItem',
      entityId: orderItemId,
      beforeData: orderItem,
      afterData: updated,
    })

    return updated
  })
}

/**
 * Splits by quantity per line, not whole rows: moving 1 of a ×3 line leaves
 * a ×2 row behind and creates a new ×1 row on the new order, copying the
 * price/cost/prep snapshot — nothing is re-priced or re-consumed, this is
 * purely a billing split of stock that's already been accounted for.
 */
export async function splitOrder(params: {
  orderId: string
  items: { orderItemId: string; quantity: number }[]
  userId: string
  role: string
}) {
  const { orderId, items: requestedItems, userId, role } = params

  const requestedIds = requestedItems.map((r) => r.orderItemId)
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new BusinessRuleError('Cannot split the same line twice in one request')
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order) throw new NotFoundError('Order not found')
    if (role !== 'admin' && order.createdById !== userId) {
      throw new ForbiddenError('Only the order\'s own waiter or an admin can split it')
    }
    if (order.status === 'paid' || order.status === 'cancelled') {
      throw new BusinessRuleError(`Cannot split an order in status ${order.status}`)
    }

    const requestedByItemId = new Map(requestedItems.map((r) => [r.orderItemId, r.quantity]))
    for (const [orderItemId, quantity] of requestedByItemId) {
      const item = order.items.find((i) => i.id === orderItemId)
      if (!item) throw new BusinessRuleError('One or more items do not belong to this order')
      if (item.isVoided) throw new BusinessRuleError('Cannot split a voided item onto a new order')
      if (quantity > item.quantity) {
        throw new BusinessRuleError(`Cannot split ${quantity} — only ${item.quantity} on that line`)
      }
    }

    const totalActiveQty = order.items.filter((i) => !i.isVoided).reduce((s, i) => s + i.quantity, 0)
    const totalMovedQty = [...requestedByItemId.values()].reduce((s, q) => s + q, 0)
    if (totalMovedQty >= totalActiveQty) {
      throw new BusinessRuleError('Cannot split every item off an order — nothing would remain')
    }

    const newOrder = await tx.order.create({
      data: {
        table: order.table,
        createdById: userId,
        status: order.status,
        splitFromId: order.id,
      },
    })

    for (const [orderItemId, quantity] of requestedByItemId) {
      const item = order.items.find((i) => i.id === orderItemId)!
      if (quantity === item.quantity) {
        await tx.orderItem.update({ where: { id: item.id }, data: { orderId: newOrder.id } })
      } else {
        await tx.orderItem.update({ where: { id: item.id }, data: { quantity: item.quantity - quantity } })
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            menuItemId: item.menuItemId,
            quantity,
            priceAtSale: item.priceAtSale,
            costAtSale: item.costAtSale,
            preparedById: item.preparedById,
            preparedAt: item.preparedAt,
          },
        })
      }
    }

    await writeAuditLog(tx, {
      userId,
      action: 'order.split',
      entityType: 'Order',
      entityId: orderId,
      beforeData: { itemCount: order.items.length },
      afterData: { newOrderId: newOrder.id, moved: requestedItems },
    })
    await writeAuditLog(tx, {
      userId,
      action: 'order.created_from_split',
      entityType: 'Order',
      entityId: newOrder.id,
      afterData: { splitFromId: orderId, moved: requestedItems },
    })

    return tx.order.findUniqueOrThrow({ where: { id: newOrder.id }, include: { items: true } })
  })
}

export async function mergeOrders(params: {
  sourceOrderId: string
  targetOrderId: string
  userId: string
  role: string
}) {
  const { sourceOrderId, targetOrderId, userId, role } = params
  if (sourceOrderId === targetOrderId) throw new BusinessRuleError('Cannot merge an order into itself')

  return prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.order.findUnique({ where: { id: sourceOrderId } }),
      tx.order.findUnique({ where: { id: targetOrderId } }),
    ])
    if (!source || !target) throw new NotFoundError('Order not found')
    // A waiter may only merge two orders they BOTH created — admin can merge
    // across waiters (e.g. tidying up after a mistake).
    if (role !== 'admin' && (source.createdById !== userId || target.createdById !== userId)) {
      throw new ForbiddenError('You can only merge orders you created')
    }
    if (source.status === 'paid' || source.status === 'cancelled' || target.status === 'paid' || target.status === 'cancelled') {
      throw new BusinessRuleError('Both orders must be unpaid and not cancelled to merge')
    }
    if (source.table !== target.table) {
      throw new BusinessRuleError('Orders can only be merged if they share the same table')
    }

    await tx.orderItem.updateMany({ where: { orderId: sourceOrderId }, data: { orderId: targetOrderId } })

    const updatedSource = await tx.order.update({
      where: { id: sourceOrderId },
      data: { status: 'cancelled', mergedIntoId: targetOrderId },
    })

    await writeAuditLog(tx, {
      userId,
      action: 'order.merged',
      entityType: 'Order',
      entityId: sourceOrderId,
      beforeData: source,
      afterData: updatedSource,
    })

    return tx.order.findUniqueOrThrow({ where: { id: targetOrderId }, include: { items: true } })
  })
}

export async function applyDiscount(params: {
  orderId: string
  discountPercent?: number
  discountAmount?: number
  discountReason?: string
  userId: string
  role: 'admin' | 'kitchen' | 'waiter'
}) {
  const { orderId, discountPercent, discountAmount, discountReason, userId, role } = params

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order) throw new NotFoundError('Order not found')
    if (role !== 'admin' && order.createdById !== userId) {
      throw new ForbiddenError('Only the order\'s own waiter or an admin can apply a discount')
    }
    if (order.status === 'paid' || order.status === 'cancelled') {
      throw new BusinessRuleError(`Cannot discount an order in status ${order.status}`)
    }

    const subtotal = order.items
      .filter((i) => !i.isVoided)
      .reduce((sum, i) => sum + i.priceAtSale * i.quantity, 0)

    const effectivePercent = discountPercent ?? (subtotal > 0 ? ((discountAmount ?? 0) / subtotal) * 100 : 0)
    assertDiscountAllowed(role, effectivePercent)

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        discountPercent: discountPercent ?? null,
        discountAmount: discountAmount ?? null,
        discountReason: discountReason ?? null,
      },
    })

    await writeAuditLog(tx, {
      userId,
      action: 'order.discount_applied',
      entityType: 'Order',
      entityId: orderId,
      beforeData: order,
      afterData: updated,
    })

    return updated
  })
}

export async function getOrderWithDetails(orderId: string) {
  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: {
        include: {
          menuItem: true,
          preparedBy: { select: { name: true } },
          voidedBy: { select: { name: true } },
        },
      },
      payments: {
        orderBy: { createdAt: 'asc' },
        include: {
          recordedBy: { select: { name: true } },
          refunds: { orderBy: { createdAt: 'asc' }, include: { recordedBy: { select: { name: true } } } },
          refundRequests: {
            orderBy: { createdAt: 'desc' },
            include: { requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } },
          },
        },
      },
      createdBy: { select: { name: true } },
      startedBy: { select: { name: true } },
    },
  })
}
