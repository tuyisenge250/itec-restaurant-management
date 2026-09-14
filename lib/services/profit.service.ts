import { prisma } from '@/lib/db/prisma'

/**
 * Overall profit summary for paid orders in a date range.
 * Uses priceAtSale / costAtSale snapshots exclusively — this is what
 * makes the report correct even months after ingredient prices changed.
 */
export async function getProfitSummary(params: { from: Date; to: Date }) {
  const { from, to } = params

  const orders = await prisma.order.findMany({
    where: {
      status: 'paid',
      updatedAt: { gte: from, lte: to },
    },
    include: { items: true, payments: true },
  })

  let revenue = 0
  let cogs = 0
  let discountTotal = 0

  for (const order of orders) {
    for (const item of order.items) {
      revenue += item.priceAtSale * item.quantity
      cogs += item.costAtSale * item.quantity
    }
    for (const payment of order.payments) {
      discountTotal += payment.discount
    }
  }

  const netRevenue = revenue - discountTotal
  const profit = netRevenue - cogs
  const marginPct = netRevenue > 0 ? (profit / netRevenue) * 100 : 0

  return {
    orderCount: orders.length,
    revenue,
    discountTotal,
    netRevenue,
    cogs,
    profit,
    marginPct,
  }
}

/**
 * Profit broken down per menu item — useful for "which dishes actually make money".
 */
export async function getProfitByMenuItem(params: { from: Date; to: Date }) {
  const { from, to } = params

  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: { status: 'paid', updatedAt: { gte: from, lte: to } },
    },
    include: { menuItem: { select: { name: true } } },
  })

  const byItem = new Map<
    string,
    { name: string; quantitySold: number; revenue: number; cogs: number }
  >()

  for (const item of orderItems) {
    const key = item.menuItemId
    const existing = byItem.get(key) ?? {
      name: item.menuItem.name,
      quantitySold: 0,
      revenue: 0,
      cogs: 0,
    }
    existing.quantitySold += item.quantity
    existing.revenue += item.priceAtSale * item.quantity
    existing.cogs += item.costAtSale * item.quantity
    byItem.set(key, existing)
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

/**
 * Waste cost for a date range — inventory written off, not sold.
 * This is pure loss and belongs on the P&L as a separate line from COGS.
 */
export async function getWasteCost(params: { from: Date; to: Date }) {
  const { from, to } = params

  const wasteTransactions = await prisma.inventoryTransaction.findMany({
    where: { type: 'waste', createdAt: { gte: from, lte: to } },
  })

  const totalCost = wasteTransactions.reduce(
    (sum, tx) => sum + Math.abs(tx.quantity) * (tx.unitCost ?? 0),
    0
  )

  return { transactionCount: wasteTransactions.length, totalCost }
}