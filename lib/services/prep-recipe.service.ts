import { prisma } from '@/lib/db/prisma'
import { consumeStock, hasSufficientStock, syncCurrentStock } from './inventory.service'
import { InsufficientStockError, BusinessRuleError, NotFoundError } from '@/lib/errors'

/**
 * Walks the PrepRecipeItem -> PrepRecipe.outputItem graph transitively from
 * each proposed input to make sure none of them (directly or through their
 * own sub-recipe) ever produces `outputItemId` — a prepared item can't be
 * one of its own ingredients, however indirectly.
 */
async function assertNoCircularDependency(outputItemId: string, inputItemIds: string[]) {
  const visited = new Set<string>()
  const queue = [...inputItemIds]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === outputItemId) {
      throw new BusinessRuleError('Circular prep recipe: an item cannot be an ingredient of itself')
    }
    if (visited.has(current)) continue
    visited.add(current)

    const recipe = await prisma.prepRecipe.findUnique({
      where: { outputItemId: current },
      include: { inputs: true },
    })
    if (recipe) {
      queue.push(...recipe.inputs.map((i) => i.inputItemId))
    }
  }
}

export async function createPrepRecipe(params: {
  outputItemId: string
  yieldQuantity: number
  batchInputNote?: string
  inputs: { inputItemId: string; quantity: number }[]
}) {
  const { outputItemId, yieldQuantity, batchInputNote, inputs } = params

  if (inputs.some((i) => i.inputItemId === outputItemId)) {
    throw new BusinessRuleError('Circular prep recipe: an item cannot be an ingredient of itself')
  }
  await assertNoCircularDependency(
    outputItemId,
    inputs.map((i) => i.inputItemId)
  )

  return prisma.prepRecipe.create({
    data: {
      outputItemId,
      yieldQuantity,
      batchInputNote,
      inputs: { create: inputs },
    },
    include: { inputs: true },
  })
}

/**
 * Runs one production batch: checks every input has enough stock BEFORE
 * consuming any of it (input 2-of-3 short => nothing is consumed), then
 * draws each input via the shared consumeStock function, and prices the
 * output lot from what was ACTUALLY consumed (+ labor) over the ACTUAL
 * quantity produced — never the recipe's theoretical yield/cost.
 */
export async function producePrepRecipe(params: {
  prepRecipeId: string
  quantityProduced: number
  laborCost: number
  costingMethod: 'fifo' | 'lifo'
  recordedById: string
}) {
  const { prepRecipeId, quantityProduced, laborCost, costingMethod, recordedById } = params

  return prisma.$transaction(async (tx) => {
    const recipe = await tx.prepRecipe.findUnique({
      where: { id: prepRecipeId },
      include: { inputs: true },
    })
    if (!recipe) throw new NotFoundError('Prep recipe not found')

    for (const input of recipe.inputs) {
      const sufficient = await hasSufficientStock(tx, input.inputItemId, input.quantity)
      if (!sufficient) {
        const item = await tx.inventoryItem.findUnique({ where: { id: input.inputItemId } })
        throw new InsufficientStockError(
          `Cannot start production run: insufficient stock for ${item?.name ?? input.inputItemId}`
        )
      }
    }

    let consumedCost = 0
    for (const input of recipe.inputs) {
      const { totalCost } = await consumeStock(tx, {
        inventoryItemId: input.inputItemId,
        quantity: input.quantity,
        source: 'prep_production',
        referenceId: prepRecipeId,
        recordedById,
      })
      consumedCost += totalCost
    }

    const unitCost = (consumedCost + laborCost) / quantityProduced

    const producedLot = await tx.inventoryLot.create({
      data: {
        inventoryItemId: recipe.outputItemId,
        costingMethod,
        unitCost,
        quantityReceived: quantityProduced,
        quantityRemaining: quantityProduced,
      },
    })

    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId: recipe.outputItemId,
        lotId: producedLot.id,
        type: 'receipt',
        source: 'prep_production',
        quantity: quantityProduced,
        unitCost,
        referenceId: prepRecipeId,
        recordedById,
      },
    })

    const run = await tx.prepProductionRun.create({
      data: {
        prepRecipeId,
        quantityProduced,
        laborCost,
        producedLotId: producedLot.id,
        recordedById,
      },
    })

    await syncCurrentStock(tx, recipe.outputItemId)

    return run
  })
}
