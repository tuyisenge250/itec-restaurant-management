import { prisma } from '@/lib/db/prisma'
import type { Order, OrderItem, Payment } from '@prisma/client'
import { NotFoundError } from '@/lib/errors'

type PaidOrder = Order & { items: OrderItem[]; payments: Payment[] }

function orderDiscountAmount(order: Order, subtotal: number): number {
  if (order.discountAmount) return order.discountAmount
  if (order.discountPercent) return (subtotal * order.discountPercent) / 100
  return 0
}

function orderRevenueAndCogs(order: PaidOrder) {
  const sold = order.items.filter((i) => !i.isVoided)
  const revenue = sold.reduce((sum, i) => sum + i.priceAtSale * i.quantity, 0)
  // costAtSale already folds in the ingredient cost actually consumed AND
  // the dish's preparationCost (set once, at fulfillment) — no re-adding it here.
  const cogs = sold.reduce((sum, i) => sum + i.costAtSale * i.quantity, 0)
  const paymentDiscounts = order.payments.reduce((sum, p) => sum + p.discount, 0)
  const discount = orderDiscountAmount(order, revenue) + paymentDiscounts
  return { revenue, cogs, discount }
}

/**
 * Revenue is recognized when an order is actually paid, not when it's
 * created — every report below anchors on the order's completing payment
 * (its latest Payment.createdAt), applied consistently so numbers reconcile
 * across summary/by-item/trend.
 */
async function getPaidOrdersInRange(from: Date, to: Date): Promise<PaidOrder[]> {
  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { orderId: true },
    distinct: ['orderId'],
  })
  if (payments.length === 0) return []

  const orders = await prisma.order.findMany({
    where: { id: { in: payments.map((p) => p.orderId) }, status: 'paid' },
    include: { items: true, payments: true },
  })

  return orders.filter((o) => {
    const paidAt = o.payments.reduce((max, p) => (p.createdAt > max ? p.createdAt : max), new Date(0))
    return paidAt >= from && paidAt <= to
  })
}

export async function getProfitSummary(params: { from: Date; to: Date }) {
  const orders = await getPaidOrdersInRange(params.from, params.to)

  let revenue = 0
  let cogs = 0
  let discountTotal = 0
  for (const order of orders) {
    const r = orderRevenueAndCogs(order)
    revenue += r.revenue
    cogs += r.cogs
    discountTotal += r.discount
  }

  const netRevenue = revenue - discountTotal
  const profit = netRevenue - cogs
  const marginPct = netRevenue > 0 ? (profit / netRevenue) * 100 : 0

  return { orderCount: orders.length, revenue, discountTotal, netRevenue, cogs, profit, marginPct }
}

export async function getProfitByMenuItem(params: { from: Date; to: Date }) {
  const orders = await getPaidOrdersInRange(params.from, params.to)
  const menuItems = await prisma.menuItem.findMany({ select: { id: true, name: true } })
  const nameById = new Map(menuItems.map((m) => [m.id, m.name]))

  const byItem = new Map<string, { name: string; quantitySold: number; revenue: number; cogs: number }>()

  for (const order of orders) {
    for (const item of order.items) {
      if (item.isVoided) continue
      const existing = byItem.get(item.menuItemId) ?? {
        name: nameById.get(item.menuItemId) ?? 'Unknown item',
        quantitySold: 0,
        revenue: 0,
        cogs: 0,
      }
      existing.quantitySold += item.quantity
      existing.revenue += item.priceAtSale * item.quantity
      existing.cogs += item.costAtSale * item.quantity
      byItem.set(item.menuItemId, existing)
    }
  }

  return Array.from(byItem.entries())
    .map(([menuItemId, data]) => ({
      menuItemId,
      ...data,
      profit: data.revenue - data.cogs,
      marginPct: data.revenue > 0 ? ((data.revenue - data.cogs) / data.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.profit - a.profit)
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

/**
 * Daily revenue/cogs/profit for a date range — zero-filled so a chart never
 * mistakes "no data returned" for "no sales that day".
 */
export async function getProfitTrend(params: { from: Date; to: Date }) {
  const { from, to } = params
  const orders = await getPaidOrdersInRange(from, to)

  const byDay = new Map<string, { revenue: number; cogs: number }>()
  for (const order of orders) {
    const paidAt = order.payments.reduce((max, p) => (p.createdAt > max ? p.createdAt : max), new Date(0))
    const key = dateKey(paidAt)
    const existing = byDay.get(key) ?? { revenue: 0, cogs: 0 }
    const r = orderRevenueAndCogs(order)
    existing.revenue += r.revenue
    existing.cogs += r.cogs
    byDay.set(key, existing)
  }

  const days: { date: string; revenue: number; cogs: number; profit: number }[] = []
  for (let d = new Date(dateKey(from)); dateKey(d) <= dateKey(to); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = dateKey(d)
    const { revenue, cogs } = byDay.get(key) ?? { revenue: 0, cogs: 0 }
    days.push({ date: key, revenue, cogs, profit: revenue - cogs })
  }
  return days
}

/**
 * Revenue collected per payment method for a date range (cash/card/momo/
 * other reconciliation) — anchored on Payment.createdAt directly, same as
 * every other report.
 */
export async function getPaymentMethodBreakdown(params: { from: Date; to: Date }) {
  const { from, to } = params

  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: from, lte: to } },
  })

  const byMethod = new Map<string, { amount: number; count: number }>()
  for (const p of payments) {
    const existing = byMethod.get(p.method) ?? { amount: 0, count: 0 }
    existing.amount += p.amount
    existing.count += 1
    byMethod.set(p.method, existing)
  }

  return Array.from(byMethod.entries()).map(([method, data]) => ({ method, ...data }))
}

/**
 * Waste cost for a date range — pure loss, kept separate from sold COGS
 * (the caller folds it into expenses/netProfit instead). Anchored on its
 * own createdAt (waste isn't tied to a payment).
 */
export async function getWasteCost(params: { from: Date; to: Date }) {
  const { from, to } = params

  const wasteTransactions = await prisma.inventoryTransaction.findMany({
    where: { type: 'waste', createdAt: { gte: from, lte: to } },
  })

  const totalCost = wasteTransactions.reduce((sum, tx) => sum + Math.abs(tx.quantity) * tx.unitCost, 0)

  return { transactionCount: wasteTransactions.length, totalCost }
}

/**
 * Per-menu-item drill-down for the "Profit by menu item" row: exactly which
 * ingredient consumption produced its COGS, plus waste on that same item's
 * ingredients over the same range — context for why a row's margin looks
 * the way it does. Consumption is read from the actual recorded
 * InventoryTransaction rows (source: 'sale', referenceId: the sold
 * OrderItem's id) rather than recomputed from the recipe, so it reflects
 * the real lot draws (FIFO/LIFO) rather than a flat recipe-quantity estimate.
 */
export async function getMenuItemDetail(params: { menuItemId: string; from: Date; to: Date }) {
  const { menuItemId, from, to } = params

  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: { recipeItems: { select: { inventoryItemId: true } } },
  })
  if (!menuItem) throw new NotFoundError('Menu item not found')

  const orders = await getPaidOrdersInRange(from, to)
  const soldItemIds: string[] = []
  let quantitySold = 0
  for (const order of orders) {
    for (const item of order.items) {
      if (item.isVoided || item.menuItemId !== menuItemId) continue
      soldItemIds.push(item.id)
      quantitySold += item.quantity
    }
  }

  const consumptionTx = soldItemIds.length
    ? await prisma.inventoryTransaction.findMany({
        where: { type: 'consumption', source: 'sale', referenceId: { in: soldItemIds } },
        include: { inventoryItem: { select: { name: true, unit: true } } },
      })
    : []

  const consumptionByItem = new Map<string, { name: string; unit: string; quantity: number; cost: number }>()
  for (const tx of consumptionTx) {
    const existing = consumptionByItem.get(tx.inventoryItemId) ??
      { name: tx.inventoryItem.name, unit: tx.inventoryItem.unit, quantity: 0, cost: 0 }
    existing.quantity += Math.abs(tx.quantity)
    existing.cost += Math.abs(tx.quantity) * tx.unitCost
    consumptionByItem.set(tx.inventoryItemId, existing)
  }

  const recipeIngredientIds = menuItem.recipeItems.map((r) => r.inventoryItemId)
  const wasteTx = recipeIngredientIds.length
    ? await prisma.inventoryTransaction.findMany({
        where: { type: 'waste', inventoryItemId: { in: recipeIngredientIds }, createdAt: { gte: from, lte: to } },
        include: { inventoryItem: { select: { name: true, unit: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const wasteByItem = new Map<string, { name: string; unit: string; quantity: number; cost: number; transactionCount: number }>()
  for (const tx of wasteTx) {
    const existing = wasteByItem.get(tx.inventoryItemId) ??
      { name: tx.inventoryItem.name, unit: tx.inventoryItem.unit, quantity: 0, cost: 0, transactionCount: 0 }
    existing.quantity += Math.abs(tx.quantity)
    existing.cost += Math.abs(tx.quantity) * tx.unitCost
    existing.transactionCount += 1
    wasteByItem.set(tx.inventoryItemId, existing)
  }

  return {
    menuItemId,
    name: menuItem.name,
    quantitySold,
    consumption: Array.from(consumptionByItem.entries()).map(([inventoryItemId, d]) => ({ inventoryItemId, ...d })),
    waste: Array.from(wasteByItem.entries()).map(([inventoryItemId, d]) => ({ inventoryItemId, ...d })),
  }
}
