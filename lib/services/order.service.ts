import { prisma } from '@/lib/db/prisma'
import type { OrderStatus, OrderItemStatus, Prisma } from '@prisma/client'
import { consumeStock, reverseConsumption } from './inventory.service'
import { writeAuditLog } from '@/lib/audit'
import { assertDiscountAllowed } from '@/lib/rbac'
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors'

type TxClient = Prisma.TransactionClient
type OrderItemInput = { menuItemId: string; quantity: number }
const EPSILON = 1e-6

/**
 * Order.status is never written independently of its items — it's always
 * derived from them so the two can never drift apart. Based purely on the
 * PREP (requiresPreparation) items' collective stage: a direct-serve item
 * being served early (e.g. a Coke handed over while a dish is still
 * cooking) never on its own flips the order out of 'preparing', matching
 * how kitchen work actually finishes. Only the final "served" check looks
 * at every non-voided item, since that's the point nothing is left to hand
 * over at all. An order with no prep items (pure direct-serve) is 'pending'
 * until the first item is served, then 'ready' (nothing left to cook, still
 * something to hand over/pay) until everything is served.
 */
export function computeOrderStatus(
  items: { status: OrderItemStatus; requiresPreparation: boolean }[]
): Exclude<OrderStatus, 'paid' | 'cancelled'> {
  const active = items.filter((i) => i.status !== 'voided')
  if (active.length === 0) return 'pending'
  if (active.every((i) => i.status === 'served')) return 'served'

  const prepItems = active.filter((i) => i.requiresPreparation)
  if (prepItems.length === 0) {
    return active.every((i) => i.status === 'pending') ? 'pending' : 'ready'
  }

  if (prepItems.every((i) => i.status === 'pending')) return 'pending'
  if (prepItems.every((i) => i.status === 'ready' || i.status === 'served')) return 'ready'
  return 'preparing'
}

/**
 * Recomputes and persists Order.status from its items, inside the same
 * transaction as whatever just changed them — same "denormalized cache,
 * recomputed synchronously" pattern already used for
 * InventoryItem.currentStock (syncCurrentStock) and MenuItem.isAvailable
 * (recomputeAvailability). 'paid' and 'cancelled' are terminal, explicit
 * writes (payment service / cancellation) and are never recomputed here.
 */
export async function syncOrderStatus(tx: TxClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
  if (order.status === 'paid' || order.status === 'cancelled') return order

  const computed = computeOrderStatus(order.items)
  if (computed === order.status) return order
  return tx.order.update({ where: { id: orderId }, data: { status: computed } })
}

/**
 * Resolves each requested line to its recipe, aggregates required quantity
 * per ingredient across ALL lines in the request (so two lines sharing an
 * ingredient can't each pass an independent check that together overshoot
 * stock), and rejects with the specific ingredient that's short. This is a
 * best-effort early check — the authoritative, lock-protected check happens
 * again at fulfillment (kitchen 'ready', or direct-serve 'serve') since
 * stock can move between now and then.
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
 * stock (never silently accepting and failing later at fulfillment). A
 * table can carry more than one open order at once — a second round
 * ordered before the first is paid, or a split bill — the same situation
 * `splitOrder` already produces deliberately, with `mergeOrders` there to
 * consolidate them back if needed. Each line snapshots the menu item's
 * requiresPreparation flag so a later menu edit never retroactively
 * changes how an already-placed line behaves.
 */
export async function createOrder(params: {
  table: string
  items: OrderItemInput[]
  createdById: string
}) {
  const { table, items, createdById } = params

  return prisma.$transaction(async (tx) => {
    const menuItems = await assertItemsServable(tx, items)

    const snapshotItems = items.map((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId)!
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        priceAtSale: menuItem.price,
        costAtSale: 0, // finalized with the real consumed cost at fulfillment
        requiresPreparation: menuItem.requiresPreparation,
        status: 'pending' as const,
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

/**
 * Adds/removes lines. Adding is always allowed (until the order is
 * paid/cancelled) — a waiter can add a Coke to a table whose grilled
 * chicken is already preparing. Removing is checked per line: a prep item
 * locks once it's been sent to the kitchen (sentToKitchenAt set); a
 * direct-serve item locks the moment it leaves 'pending' — i.e. once
 * cashier has confirmed it and its stock is already deducted, same as a
 * prep item locking at the kitchen-ticket stage rather than waiting for
 * 'served'. A new prep item added to an order the kitchen has already
 * claimed joins the kitchen queue immediately (auto-sent) rather than
 * waiting for a claim that already happened; one added before any claim
 * waits for the next claim like everything else.
 */
export async function updateOrderItems(params: {
  orderId: string
  add: OrderItemInput[]
  removeItemIds: string[]
  userId: string
  role: string
}) {
  const { orderId, add, removeItemIds, userId, role } = params

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order) throw new NotFoundError('Order not found')
    if (role !== 'admin' && order.createdById !== userId) {
      throw new ForbiddenError('Only the order\'s own waiter or an admin can edit its items')
    }
    if (order.status === 'paid' || order.status === 'cancelled') {
      throw new BusinessRuleError(`Order items can only be edited while the order is not ${order.status}`)
    }

    if (removeItemIds.length > 0) {
      for (const itemId of removeItemIds) {
        const item = order.items.find((i) => i.id === itemId)
        if (!item) throw new NotFoundError(`Order item ${itemId} not found on this order`)
        const locked = item.requiresPreparation ? item.sentToKitchenAt !== null : item.status !== 'pending'
        if (locked) {
          throw new BusinessRuleError(
            item.requiresPreparation
              ? 'Cannot remove an item that has already been sent to the kitchen'
              : 'Cannot remove an item that has already been confirmed by cashier'
          )
        }
      }
      await tx.orderItem.deleteMany({ where: { id: { in: removeItemIds }, orderId } })
    }

    if (add.length > 0) {
      const menuItems = await assertItemsServable(tx, add)
      const kitchenAlreadyClaimed = order.startedById !== null
      await tx.orderItem.createMany({
        data: add.map((item) => {
          const menuItem = menuItems.find((m) => m.id === item.menuItemId)!
          const autoJoinKitchen = menuItem.requiresPreparation && kitchenAlreadyClaimed
          return {
            orderId,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            priceAtSale: menuItem.price,
            costAtSale: 0,
            requiresPreparation: menuItem.requiresPreparation,
            status: autoJoinKitchen ? 'preparing' : 'pending',
            sentToKitchenAt: autoJoinKitchen ? new Date() : null,
          }
        }),
      })
    }

    await syncOrderStatus(tx, orderId)

    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
  })
}

const ROLE_ALLOWED_ORDER_ACTIONS: Record<string, ('preparing' | 'cancelled')[]> = {
  admin: ['preparing', 'cancelled'],
  kitchen: ['preparing'],
  waiter: ['cancelled'],
}

/**
 * The only two order-level actions left: kitchen (or admin) claiming an
 * order's pending prep items off the queue, and cancelling an order that
 * hasn't been touched at all yet. Everything else (kitchen marking one item
 * ready, a waiter serving one item) now happens per-item — see
 * markOrderItemReady / serveOrderItem below.
 */
export async function updateOrderStatus(params: {
  orderId: string
  newStatus: 'preparing' | 'cancelled'
  userId: string
  role: string
}) {
  const { orderId, newStatus, userId, role } = params

  if (!ROLE_ALLOWED_ORDER_ACTIONS[role]?.includes(newStatus)) {
    throw new ForbiddenError(`${role} cannot perform this action`)
  }

  return prisma.$transaction(async (tx) => {
    // Lock the row before checking claim ownership — without this, two
    // kitchen users clicking "Start preparing" on the same order at once
    // could both succeed, defeating "whoever starts it owns it".
    const [locked] = await tx.$queryRaw<{ id: string; status: string; startedById: string | null }[]>`
      SELECT id, status, "startedById" FROM orders WHERE id = ${orderId} FOR UPDATE
    `
    if (!locked) throw new NotFoundError('Order not found')

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })

    if (role === 'waiter' && order.createdById !== userId) {
      throw new ForbiddenError('Only the order\'s own waiter or an admin can update it')
    }

    if (newStatus === 'preparing') {
      if (locked.startedById) {
        throw new ConflictError(
          locked.startedById === userId
            ? 'This order has already been started'
            : 'This order is already being handled by another kitchen user'
        )
      }
      const pendingPrepItems = order.items.filter((i) => i.requiresPreparation && i.status === 'pending')
      if (pendingPrepItems.length === 0) {
        throw new BusinessRuleError('This order has no kitchen items waiting to be started')
      }

      const now = new Date()
      await tx.orderItem.updateMany({
        where: { id: { in: pendingPrepItems.map((i) => i.id) } },
        data: { status: 'preparing', sentToKitchenAt: now },
      })
      await tx.order.update({ where: { id: orderId }, data: { startedById: userId, startedAt: now } })
    }

    if (newStatus === 'cancelled') {
      const untouched = order.items.every((i) => i.status === 'pending' || i.status === 'voided')
      if (!untouched) {
        throw new BusinessRuleError('Cannot cancel an order that already has items in progress or served')
      }
      await tx.order.update({ where: { id: orderId }, data: { status: 'cancelled' } })
    }

    const updated = await syncOrderStatus(tx, orderId)

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

/**
 * Marks ONE item ready — this is where stock actually leaves the shelf for
 * that item, re-validated under lock since it may have moved since the
 * order was created or claimed. Two independent fulfillment paths land
 * here: kitchen confirms a prep item once it's been claimed and is
 * 'preparing'; cashier confirms a direct-serve item straight off 'pending'
 * (no claim/kitchen-ticket concept for those — it's a single checkpoint,
 * not a cook queue). Either way the waiter still does the final 'served'
 * hand-off — see serveOrderItem — so no item is ever fulfilled by the same
 * person who's about to hand it to the customer.
 */
export async function markOrderItemReady(params: { orderItemId: string; userId: string; role: string }) {
  const { orderItemId, userId, role } = params

  return prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true, menuItem: { include: { recipeItems: true } } },
    })
    if (!item) throw new NotFoundError('Order item not found')

    if (item.requiresPreparation) {
      if (role !== 'admin' && role !== 'kitchen') {
        throw new ForbiddenError('Only kitchen or admin can mark a kitchen item ready')
      }
      if (role === 'kitchen' && item.order.startedById && item.order.startedById !== userId) {
        throw new ForbiddenError('This order is already being handled by another kitchen user')
      }
      if (item.status !== 'preparing') {
        throw new BusinessRuleError(`Cannot mark ready an item in status ${item.status}`)
      }
    } else {
      if (role !== 'admin' && role !== 'cashier') {
        throw new ForbiddenError('Only cashier or admin can mark a direct-serve item ready')
      }
      if (item.status !== 'pending') {
        throw new BusinessRuleError(`Cannot mark ready an item in status ${item.status}`)
      }
    }

    let ingredientCost = 0
    for (const recipeItem of item.menuItem.recipeItems) {
      const { totalCost } = await consumeStock(tx, {
        inventoryItemId: recipeItem.inventoryItemId,
        quantity: recipeItem.quantity * item.quantity,
        source: 'sale',
        referenceId: item.id,
        recordedById: userId,
      })
      ingredientCost += totalCost
    }

    const costPerUnit = ingredientCost / item.quantity + item.menuItem.preparationCost
    const updated = await tx.orderItem.update({
      where: { id: orderItemId },
      data: { status: 'ready', costAtSale: costPerUnit, preparedById: userId, preparedAt: new Date() },
    })

    await syncOrderStatus(tx, item.orderId)

    await writeAuditLog(tx, {
      userId,
      action: 'order_item.ready',
      entityType: 'OrderItem',
      entityId: orderItemId,
      beforeData: { status: item.status },
      afterData: { status: updated.status },
    })

    return updated
  })
}

/**
 * Hands an item to the customer — the final step for every item, prep or
 * direct-serve alike. Stock already left the shelf at the 'ready' step
 * (kitchen for prep items, cashier for direct-serve ones — see
 * markOrderItemReady), so this is purely the "it's in the customer's
 * hands" record, never a stock-consuming action itself. Waiter-only (their
 * own order) or admin.
 */
export async function serveOrderItem(params: { orderItemId: string; userId: string; role: string }) {
  const { orderItemId, userId, role } = params
  if (role !== 'admin' && role !== 'waiter') {
    throw new ForbiddenError('Only a waiter or admin can serve an item')
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    })
    if (!item) throw new NotFoundError('Order item not found')
    if (role === 'waiter' && item.order.createdById !== userId) {
      throw new ForbiddenError('Only the order\'s own waiter or an admin can serve its items')
    }
    if (item.status !== 'ready') {
      throw new BusinessRuleError(`Cannot serve an item in status ${item.status} — it isn't ready yet`)
    }

    const updated = await tx.orderItem.update({ where: { id: orderItemId }, data: { status: 'served' } })
    await syncOrderStatus(tx, item.orderId)
    await writeAuditLog(tx, {
      userId,
      action: 'order_item.served',
      entityType: 'OrderItem',
      entityId: orderItemId,
      beforeData: { status: item.status },
      afterData: { status: updated.status },
    })
    return updated
  })
}

/**
 * Voids an item. Both paths now mirror each other exactly: whoever
 * confirms fulfillment is also who can undo it. Prep items: kitchen/admin
 * only, once it's passed pending (sentToKitchenAt set). Direct-serve
 * items: cashier/admin only, once cashier has confirmed it ('ready' or
 * 'served') — a still-pending direct-serve item (nothing drawn from stock
 * yet, cashier hasn't touched it) is simply removed via updateOrderItems
 * instead. Either way this is an immediate reversal with a required
 * reason — no cap, no approval queue.
 */
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
    if (orderItem.status === 'voided') throw new ConflictError('Order item is already voided')

    let stockAlreadyDeducted: boolean

    if (orderItem.requiresPreparation) {
      if (role !== 'admin' && role !== 'kitchen') {
        throw new ForbiddenError('Only kitchen or admin can void a kitchen item')
      }
      if (role === 'kitchen' && orderItem.order.startedById && orderItem.order.startedById !== userId) {
        throw new ForbiddenError('This order is already being handled by another kitchen user')
      }
      if (orderItem.status === 'pending') {
        throw new BusinessRuleError('Cannot void an item that has not been sent to the kitchen yet — remove it instead')
      }
      // Stock only actually leaves the shelf once a prep item reaches 'ready'.
      stockAlreadyDeducted = orderItem.status === 'ready' || orderItem.status === 'served'
    } else {
      if (role !== 'admin' && role !== 'cashier') {
        throw new ForbiddenError('Only cashier or admin can void a direct-serve item')
      }
      if (orderItem.status === 'pending') {
        throw new BusinessRuleError('Cannot void a direct-serve item that has not been confirmed yet — remove it instead')
      }
      // Stock only actually leaves the shelf once cashier confirms it ('ready').
      stockAlreadyDeducted = orderItem.status === 'ready' || orderItem.status === 'served'
    }

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
      data: { status: 'voided', isVoided: true, voidedById: userId, voidedAt: new Date(), voidReason },
    })

    await syncOrderStatus(tx, orderItem.orderId)

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
 * price/cost/prep snapshot and status — nothing is re-priced or
 * re-consumed, this is purely a billing split of stock that's already been
 * accounted for.
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
      if (item.status === 'voided') throw new BusinessRuleError('Cannot split a voided item onto a new order')
      if (quantity > item.quantity) {
        throw new BusinessRuleError(`Cannot split ${quantity} — only ${item.quantity} on that line`)
      }
    }

    const totalActiveQty = order.items.filter((i) => i.status !== 'voided').reduce((s, i) => s + i.quantity, 0)
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
            requiresPreparation: item.requiresPreparation,
            status: item.status,
            sentToKitchenAt: item.sentToKitchenAt,
            preparedById: item.preparedById,
            preparedAt: item.preparedAt,
          },
        })
      }
    }

    await syncOrderStatus(tx, orderId)
    await syncOrderStatus(tx, newOrder.id)

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

    await syncOrderStatus(tx, targetOrderId)

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
  role: 'admin' | 'kitchen' | 'waiter' | 'cashier'
}) {
  const { orderId, discountPercent, discountAmount, discountReason, userId, role } = params

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order) throw new NotFoundError('Order not found')
    // Only waiter is scoped to their own orders — admin and cashier (its
    // oversight extends to every order, not just ones they created) can
    // discount anything, just capped lower than admin by DISCOUNT_CAPS.
    if (role === 'waiter' && order.createdById !== userId) {
      throw new ForbiddenError('Only the order\'s own waiter or an admin can apply a discount')
    }
    if (order.status === 'paid' || order.status === 'cancelled') {
      throw new BusinessRuleError(`Cannot discount an order in status ${order.status}`)
    }

    const subtotal = order.items
      .filter((i) => i.status !== 'voided')
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
        },
      },
      createdBy: { select: { name: true } },
      startedBy: { select: { name: true } },
    },
  })
}
