import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const EPSILON = 1e-9

type Limiting = { name: string; unit: string } | null

/**
 * Given a set of (requiredQuantity, availableStock) pairs, finds how many
 * whole units/batches can be made and which ingredient runs out first — the
 * same "every ingredient must have enough for at least one unit" logic
 * menu.service.ts uses for isAvailable, generalized to a max COUNT instead
 * of a boolean, and computed across ALL of a recipe's ingredients, not just
 * the one item this report was requested for.
 */
function maxProducible(lines: { quantity: number; name: string; unit: string; currentStock: number }[]) {
  let max = Infinity
  let limiting: Limiting = null
  for (const line of lines) {
    if (line.quantity <= 0) continue
    const possible = line.currentStock / line.quantity
    if (possible < max) {
      max = possible
      limiting = { name: line.name, unit: line.unit }
    }
  }
  const whole = Number.isFinite(max) ? Math.floor(max + EPSILON) : 0
  return { whole, limiting }
}

// "If I have 5kg of Potatoes, how many Chips (or how many batches of a prep
// mixture) can I actually make?" — walks every recipe/prep-recipe that uses
// this ingredient and finds the true bottleneck across ALL of that recipe's
// ingredients, not just this one.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params

    const [menuItems, prepRecipes] = await Promise.all([
      prisma.menuItem.findMany({
        where: { recipeItems: { some: { inventoryItemId: id } } },
        include: {
          recipeItems: {
            include: { inventoryItem: { select: { name: true, unit: true, currentStock: true } } },
          },
        },
      }),
      prisma.prepRecipe.findMany({
        where: { inputs: { some: { inputItemId: id } } },
        include: {
          outputItem: { select: { name: true, unit: true } },
          inputs: { include: { inputItem: { select: { name: true, unit: true, currentStock: true } } } },
        },
      }),
    ])

    const menuItemResults = menuItems.map((mi) => {
      const { whole, limiting } = maxProducible(
        mi.recipeItems.map((ri) => ({
          quantity: ri.quantity,
          name: ri.inventoryItem.name,
          unit: ri.inventoryItem.unit,
          currentStock: ri.inventoryItem.currentStock,
        }))
      )
      return { menuItemId: mi.id, menuItemName: mi.name, maxUnits: whole, limitingIngredient: limiting }
    })

    const prepRecipeResults = prepRecipes.map((pr) => {
      const { whole, limiting } = maxProducible(
        pr.inputs.map((i) => ({
          quantity: i.quantity,
          name: i.inputItem.name,
          unit: i.inputItem.unit,
          currentStock: i.inputItem.currentStock,
        }))
      )
      return {
        prepRecipeId: pr.id,
        outputItemName: pr.outputItem.name,
        outputUnit: pr.outputItem.unit,
        maxBatches: whole,
        estimatedOutputQuantity: whole * pr.yieldQuantity,
        limitingIngredient: limiting,
      }
    })

    return NextResponse.json({ menuItems: menuItemResults, prepRecipes: prepRecipeResults })
  } catch (err) {
    return handleApiError(err)
  }
}
