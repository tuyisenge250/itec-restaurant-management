import { prisma } from '@/lib/db/prisma'
import { getCurrentRecipeCost } from './recipe.service'
import { deductForOrder } from './inventory.service'

type OrderItemInput = { menuItemId: string; quantity: number }

/**
 * Creates an order and snapshots price + recipe cost for each item at
 * this moment. costAtSale must never be recomputed later from live
 * ingredient prices — that's what keeps historical profit reports accurate
 * even after supplier prices change.
 */
export async function createOrder(params: {
  items: OrderItemInput[]
  tableNumber?: string
  createdById: string
}) {
  const { items, tableNumber, createdById } = params

  if (items.length === 0) {
    throw new Error('Order must contain at least one item')
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) } },
  })

  const snapshotItems = await Promise.all(
    items.map(async (item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId)
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`)
      if (!menuItem.isAvailable) throw new Error(`${menuItem.name} is currently unavailable`)

      const costPerUnit = await getCurrentRecipeCost(item.menuItemId)

      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        priceAtSale: menuItem.price,
        costAtSale: costPerUnit,
      }
    })
  )

  return prisma.order.create({
    data: {
      tableNumber,
      createdById,
      status: 'pending',
      items: { create: snapshotItems },
    },
    include: { items: true },
  })
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served'],
  served: ['paid'],
  paid: [],
  cancelled: [],
}

/**
 * Transitions an order's status. When moving into 'ready', triggers
 * inventory deduction for every ingredient the order consumed — this is
 * the single point where kitchen activity turns into a stock movement.
 */
export async function updateOrderStatus(params: {
  orderId: string
  newStatus: string
  updatedById: string
}) {
  const { orderId, newStatus, updatedById } = params

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })

  const allowed = VALID_TRANSITIONS[order.status] ?? []
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition order from ${order.status} to ${newStatus}`)
  }

  if (newStatus === 'ready') {
    await deductForOrder(orderId, updatedById)
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus as any },
  })
}

export async function getOrderWithDetails(orderId: string) {
  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: { include: { menuItem: true } },
      payments: true,
      createdBy: { select: { name: true } },
    },
  })
}