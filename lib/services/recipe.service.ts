import { prisma } from '@/lib/db/prisma'

/**
 * Computes the current cost to make one unit of a menu item,
 * based on its recipe (BOM) and each ingredient's current average unit cost.
 * This is a LIVE cost — use it for menu pricing decisions, not for
 * historical profit reports (those use the costAtSale snapshot instead).
 */
export async function getCurrentRecipeCost(menuItemId: string): Promise<number> {
  const recipeItems = await prisma.recipeItem.findMany({
    where: { menuItemId },
    include: { inventoryItem: true },
  })

  if (recipeItems.length === 0) {
    throw new Error(`No recipe defined for menu item ${menuItemId}`)
  }

  return recipeItems.reduce((total, item) => {
    return total + item.quantity * item.inventoryItem.avgUnitCost
  }, 0)
}

/**
 * Returns cost + margin info for a menu item, useful for the admin
 * pricing screen (e.g. "this dish costs $4.20 to make, sells for $12.50, 66% margin").
 */
export async function getRecipeCostBreakdown(menuItemId: string) {
  const menuItem = await prisma.menuItem.findUniqueOrThrow({
    where: { id: menuItemId },
    include: { recipeItems: { include: { inventoryItem: true } } },
  })

  const ingredients = menuItem.recipeItems.map((item) => ({
    name: item.inventoryItem.name,
    quantity: item.quantity,
    unit: item.inventoryItem.unit,
    unitCost: item.inventoryItem.avgUnitCost,
    lineCost: item.quantity * item.inventoryItem.avgUnitCost,
  }))

  const cost = ingredients.reduce((sum, i) => sum + i.lineCost, 0)
  const price = menuItem.price
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0

  return {
    menuItemId,
    name: menuItem.name,
    price,
    cost,
    margin,
    ingredients,
  }
}

/**
 * Checks whether a menu item can currently be made given available stock,
 * based on the smallest available-portions ratio across its ingredients.
 */
export async function getMaxServable(menuItemId: string): Promise<number> {
  const recipeItems = await prisma.recipeItem.findMany({
    where: { menuItemId },
    include: { inventoryItem: true },
  })

  if (recipeItems.length === 0) return 0

  return Math.floor(
    Math.min(
      ...recipeItems.map((item) => item.inventoryItem.currentStock / item.quantity)
    )
  )
}