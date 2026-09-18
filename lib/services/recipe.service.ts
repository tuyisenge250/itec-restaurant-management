import { prisma } from '@/lib/db/prisma'
import { NotFoundError } from '@/lib/errors'
import { simulateDrawCost as simulateNextCost } from './inventory.service'

/**
 * Cost to make one unit of a menu item RIGHT NOW: the ingredient cost is
 * whatever the next lot(s) in draw order would actually charge, plus the
 * dish's own preparation cost. This is a live estimate for pricing/margin
 * display — historical orders use their OrderItem.costAtSale snapshot
 * instead, which is the cost actually realized at fulfillment.
 */
export async function getCurrentRecipeCost(menuItemId: string): Promise<number> {
  const [menuItem, recipeItems] = await Promise.all([
    prisma.menuItem.findUnique({ where: { id: menuItemId } }),
    prisma.recipeItem.findMany({ where: { menuItemId } }),
  ])
  if (!menuItem) throw new NotFoundError('Menu item not found')
  if (recipeItems.length === 0) throw new NotFoundError(`No recipe defined for menu item ${menuItemId}`)

  const lineCosts = await Promise.all(
    recipeItems.map((item) => simulateNextCost(item.inventoryItemId, item.quantity))
  )

  return lineCosts.reduce((sum, c) => sum + c, 0) + menuItem.preparationCost
}

export async function getRecipeCostBreakdown(menuItemId: string) {
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: { recipeItems: { include: { inventoryItem: true } } },
  })
  if (!menuItem) throw new NotFoundError('Menu item not found')

  const ingredients = await Promise.all(
    menuItem.recipeItems.map(async (item) => {
      const lineCost = await simulateNextCost(item.inventoryItemId, item.quantity)
      return {
        name: item.inventoryItem.name,
        quantity: item.quantity,
        unit: item.inventoryItem.unit,
        unitCost: item.quantity > 0 ? lineCost / item.quantity : 0,
        lineCost,
      }
    })
  )

  const ingredientCost = ingredients.reduce((sum, i) => sum + i.lineCost, 0)
  const cost = ingredientCost + menuItem.preparationCost
  const price = menuItem.price
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0

  return {
    menuItemId,
    name: menuItem.name,
    price,
    preparationCost: menuItem.preparationCost,
    cost,
    margin,
    ingredients,
  }
}

/**
 * Whole units of this menu item that could be made right now given current
 * stock (used for a quick "can we still sell this" check).
 */
export async function getMaxServable(menuItemId: string): Promise<number> {
  const recipeItems = await prisma.recipeItem.findMany({
    where: { menuItemId },
    include: { inventoryItem: true },
  })
  if (recipeItems.length === 0) return 0

  return Math.floor(Math.min(...recipeItems.map((item) => item.inventoryItem.currentStock / item.quantity)))
}
