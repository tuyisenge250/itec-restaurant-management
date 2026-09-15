import type { Prisma } from '@prisma/client'

type TxClient = Prisma.TransactionClient
const EPSILON = 1e-6

export async function findMenuItemsUsingIngredient(
  tx: TxClient,
  inventoryItemId: string
): Promise<string[]> {
  const items = await tx.menuItem.findMany({
    where: { recipeItems: { some: { inventoryItemId } } },
    select: { id: true },
  })
  return items.map((i) => i.id)
}

/**
 * isAvailable = every ingredient in the BOM currently has enough stock for
 * at least one unit. Recomputed synchronously right after the transaction
 * that changed stock — no polling job.
 */
export async function recomputeAvailability(tx: TxClient, menuItemIds: string[]) {
  for (const menuItemId of menuItemIds) {
    const recipeItems = await tx.recipeItem.findMany({
      where: { menuItemId },
      include: { inventoryItem: true },
    })
    const isAvailable =
      recipeItems.length > 0 &&
      recipeItems.every((ri) => ri.inventoryItem.currentStock + EPSILON >= ri.quantity)

    await tx.menuItem.update({ where: { id: menuItemId }, data: { isAvailable } })
  }
}

export async function recomputeAvailabilityForIngredient(tx: TxClient, inventoryItemId: string) {
  const menuItemIds = await findMenuItemsUsingIngredient(tx, inventoryItemId)
  await recomputeAvailability(tx, menuItemIds)
}
