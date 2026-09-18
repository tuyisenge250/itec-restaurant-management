import { prisma } from '@/lib/db/prisma'
import type { Prisma } from '@prisma/client'
import { consumeStock, hasSufficientStock, syncCurrentStock } from './inventory.service'
import { InsufficientStockError, BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors'

type TxClient = Prisma.TransactionClient

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

  // outputItemId is @unique — each item can only ever be made by one
  // recipe. Check first so the caller gets a clean message instead of a
  // raw database constraint error.
  const existing = await prisma.prepRecipe.findUnique({
    where: { outputItemId },
    include: { outputItem: { select: { name: true } } },
  })
  if (existing) {
    throw new ConflictError(`${existing.outputItem.name} already has a prep recipe — each item can only be made by one recipe`)
  }

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
 * Ingredients are never a fixed per-run amount — they always scale from the
 * recipe's own ratio (each input's registered quantity, relative to
 * yieldQuantity) up to whatever quantity is actually in play. A recipe of
 * "5kg flour + 5L oil -> 100 mandazi" scaled to 1000 needs 50kg + 50L; scaled
 * to 137 needs 6.85kg + 6.85L — continuous, not batch multiples.
 */
function scaleInputs(recipe: { yieldQuantity: number; inputs: { inputItemId: string; quantity: number }[] }, quantity: number) {
  const scale = quantity / recipe.yieldQuantity
  return recipe.inputs.map((input) => ({ inputItemId: input.inputItemId, quantity: input.quantity * scale }))
}

/**
 * Checks every scaled input has enough stock BEFORE consuming any of it
 * (input 2-of-3 short => nothing is consumed), then draws each one via the
 * shared consumeStock function. Used both for an internal run (consumed at
 * fulfillment) and for an outside order (consumed at creation, since that's
 * when the ingredients are handed to the third party).
 */
async function consumeScaledInputs(
  tx: TxClient,
  recipe: { yieldQuantity: number; inputs: { inputItemId: string; quantity: number }[] },
  quantity: number,
  params: { referenceId?: string; recordedById: string }
) {
  const scaled = scaleInputs(recipe, quantity)

  for (const input of scaled) {
    const sufficient = await hasSufficientStock(tx, input.inputItemId, input.quantity)
    if (!sufficient) {
      const item = await tx.inventoryItem.findUnique({ where: { id: input.inputItemId } })
      throw new InsufficientStockError(
        `Cannot start production: insufficient stock for ${item?.name ?? input.inputItemId}`
      )
    }
  }

  let consumedCost = 0
  for (const input of scaled) {
    const { totalCost } = await consumeStock(tx, {
      inventoryItemId: input.inputItemId,
      quantity: input.quantity,
      source: 'prep_production',
      referenceId: params.referenceId,
      recordedById: params.recordedById,
    })
    consumedCost += totalCost
  }
  return consumedCost
}

/**
 * Runs one production batch and creates its output lot. `laborCost` is
 * recorded for reference but deliberately NOT folded into unitCost/COGS —
 * labor is tracked as a period Expense instead (see expense.service.ts), so
 * recipe costing only ever reflects ingredients (+ a paid service fee for
 * outside). Folding labor in too would double-count it once it's also
 * logged as a "Salaries"-type expense.
 *
 * `ingredientCostOverride` is set only when this call is fulfilling an
 * outside PrepProductionOrder — its ingredients were already consumed (and
 * their cost locked in) at order creation, so this run must NOT consume
 * again; it just reads that reserved cost back. Every other case (ad-hoc of
 * either source, or an internal order's fulfillment) consumes ingredients
 * right here, scaled to `quantityProduced`.
 *
 * Takes the transaction client directly (rather than opening its own) so
 * `fulfillProductionOrder` (prep-production-order.service.ts) can run this
 * in the SAME transaction as locking/validating/closing out the order it's
 * fulfilling — production and the order's status must succeed or fail
 * together. `producePrepRecipe` below is the ad-hoc entry point that opens
 * its own transaction for a run started without an order.
 */
export async function runProductionBatch(
  tx: TxClient,
  params: {
    prepRecipeId: string
    quantityProduced: number
    laborCost: number
    costingMethod: 'fifo' | 'lifo'
    expiresAt?: Date | null
    source: 'internal' | 'outside'
    outsideCost?: number
    ingredientCostOverride?: number
    productionOrderId?: string
    recordedById: string
  }
) {
  const {
    prepRecipeId, quantityProduced, laborCost, costingMethod, expiresAt,
    source, outsideCost, ingredientCostOverride, productionOrderId, recordedById,
  } = params

  if (source === 'outside' && ingredientCostOverride === undefined && (!outsideCost || outsideCost < 0)) {
    throw new BusinessRuleError('The service fee paid for an outside-produced batch is required')
  }

  const recipe = await tx.prepRecipe.findUnique({
    where: { id: prepRecipeId },
    include: { inputs: true },
  })
  if (!recipe) throw new NotFoundError('Prep recipe not found')

  const ingredientCost = ingredientCostOverride !== undefined
    ? ingredientCostOverride
    : await consumeScaledInputs(tx, recipe, quantityProduced, {
        referenceId: productionOrderId ?? prepRecipeId,
        recordedById,
      })

  const unitCost = (ingredientCost + (source === 'outside' ? (outsideCost ?? 0) : 0)) / quantityProduced

  const producedLot = await tx.inventoryLot.create({
    data: {
      inventoryItemId: recipe.outputItemId,
      costingMethod,
      unitCost,
      quantityReceived: quantityProduced,
      quantityRemaining: quantityProduced,
      expiresAt: expiresAt ?? undefined,
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
      source,
      laborCost: source === 'internal' ? laborCost : 0,
      outsideCost: source === 'outside' ? outsideCost : null,
      productionOrderId: productionOrderId ?? undefined,
      producedLotId: producedLot.id,
      recordedById,
    },
  })

  await syncCurrentStock(tx, recipe.outputItemId)

  return run
}

/** Ad-hoc production, started without a PrepProductionOrder — opens its own transaction. */
export async function producePrepRecipe(params: {
  prepRecipeId: string
  quantityProduced: number
  laborCost: number
  costingMethod: 'fifo' | 'lifo'
  expiresAt?: Date | null
  source: 'internal' | 'outside'
  outsideCost?: number
  recordedById: string
}) {
  return prisma.$transaction((tx) => runProductionBatch(tx, params))
}

export { scaleInputs, consumeScaledInputs }
