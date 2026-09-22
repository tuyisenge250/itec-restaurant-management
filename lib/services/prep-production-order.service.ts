import { prisma } from '@/lib/db/prisma'
import type { Prisma, ProductionTeam } from '@prisma/client'
import { runProductionBatch, scaleInputs, consumeScaledInputs } from './prep-recipe.service'
import { reverseConsumption, simulateDrawCost } from './inventory.service'
import { writeAuditLog } from '@/lib/audit'
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/errors'

type TxClient = Prisma.TransactionClient

/**
 * Places a production order. For an internal order this is pure planning —
 * nothing moves yet, it just lands in the assigned role's queue (kitchen or
 * waiter) to be run later, the same way a menu item's requiresPreparation
 * decides who eventually acts on it. For an outside order, the ingredients
 * leave the building right now: scaled to targetQuantity, consumed via the
 * same shared draw-down as an internal run, and their total cost locked in
 * as reservedIngredientCost — that's the moment they're actually handed to
 * the third party, not whenever the finished batch comes back.
 */
export async function createProductionOrder(params: {
  prepRecipeId: string
  targetQuantity: number
  source: 'internal' | 'outside'
  assignedTeam?: ProductionTeam
  notes?: string
  createdById: string
}) {
  const { prepRecipeId, targetQuantity, source, assignedTeam, notes, createdById } = params

  if (source === 'internal' && !assignedTeam) {
    throw new BusinessRuleError('An in-house production order needs to be assigned to kitchen or waiter')
  }

  return prisma.$transaction(async (tx) => {
    const recipe = await tx.prepRecipe.findUnique({ where: { id: prepRecipeId }, include: { inputs: true } })
    if (!recipe) throw new NotFoundError('Prep recipe not found')

    const order = await tx.prepProductionOrder.create({
      data: {
        prepRecipeId,
        targetQuantity,
        source,
        assignedTeam: source === 'internal' ? assignedTeam : null,
        notes,
        createdById,
      },
    })

    let reservedIngredientCost: number | undefined
    if (source === 'outside') {
      reservedIngredientCost = await consumeScaledInputs(tx, recipe, targetQuantity, {
        referenceId: order.id,
        recordedById: createdById,
      })
      await tx.prepProductionOrder.update({
        where: { id: order.id },
        data: { reservedIngredientCost },
      })
    }

    await writeAuditLog(tx, {
      userId: createdById,
      action: 'production_order.created',
      entityType: 'PrepProductionOrder',
      entityId: order.id,
      afterData: { ...order, reservedIngredientCost },
    })

    return tx.prepProductionOrder.findUniqueOrThrow({ where: { id: order.id } })
  })
}

/**
 * Closes out a pending order by actually running the production batch it
 * describes:
 * - internal: kitchen/waiter (whichever it's assigned to) or admin actually
 *   runs it — ingredients are consumed right here, scaled to whatever
 *   quantity they actually report producing.
 * - outside: admin records what the third party delivered — no ingredients
 *   move again (already consumed at order creation), this just reads back
 *   the reserved ingredient cost, adds the service fee paid, and prices the
 *   lot from both.
 * Locks the order row first so two people can't both fulfill the same order
 * at once. The run and the order's status change happen in one transaction:
 * either both succeed or neither does.
 */
export async function fulfillProductionOrder(params: {
  orderId: string
  quantityProduced: number
  laborCost: number
  outsideCost?: number
  costingMethod: 'fifo' | 'lifo'
  expiresAt?: Date | null
  recordedById: string
  permissions: string[]
  homeArea: string
}) {
  const { orderId, quantityProduced, laborCost, outsideCost, costingMethod, expiresAt, recordedById, permissions, homeArea } =
    params

  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<
      { id: string; status: string; source: string; assignedTeam: string | null; prepRecipeId: string; reservedIngredientCost: number | null }[]
    >`SELECT id, status, source, "assignedTeam", "prepRecipeId", "reservedIngredientCost" FROM prep_production_orders WHERE id = ${orderId} FOR UPDATE`
    if (!locked) throw new NotFoundError('Production order not found')
    if (locked.status !== 'pending') {
      throw new BusinessRuleError(`Cannot fulfill a production order in status ${locked.status}`)
    }

    // "Assigned team" (kitchen/waiter) is a business-routing concept, not a
    // permission — matching it is who this order was planned for, same idea
    // as stock-requisition.service.ts's LOCATION_HOME_AREA. fulfill_any
    // bypasses the match entirely (also required for an outside order,
    // since there's no in-house assignee to match against at all).
    const canFulfillAny = permissions.includes('production_orders.fulfill_any')
    if (locked.source === 'internal' && !canFulfillAny && homeArea !== locked.assignedTeam) {
      throw new ForbiddenError(`Only ${locked.assignedTeam} or admin can fulfill this production order`)
    }
    if (locked.source === 'outside' && !canFulfillAny) {
      throw new ForbiddenError('Only admin can record an outside production order as received')
    }

    const source = locked.source as 'internal' | 'outside'
    const run = await runProductionBatch(tx, {
      prepRecipeId: locked.prepRecipeId,
      quantityProduced,
      laborCost,
      costingMethod,
      expiresAt,
      source,
      outsideCost,
      ingredientCostOverride: source === 'outside' ? (locked.reservedIngredientCost ?? 0) : undefined,
      productionOrderId: orderId,
      recordedById,
    })

    const updated = await tx.prepProductionOrder.update({
      where: { id: orderId },
      data: { status: 'fulfilled' },
    })

    await writeAuditLog(tx, {
      userId: recordedById,
      action: 'production_order.fulfilled',
      entityType: 'PrepProductionOrder',
      entityId: orderId,
      beforeData: { status: locked.status },
      afterData: { status: updated.status, quantityProduced, runId: run.id },
    })

    return run
  })
}

async function reverseOutsideOrderConsumption(tx: TxClient, orderId: string, userId: string) {
  const consumptionTxns = await tx.inventoryTransaction.findMany({
    where: { referenceId: orderId, type: 'consumption' },
  })
  const inventoryItemIds = [...new Set(consumptionTxns.map((t) => t.inventoryItemId))]
  for (const inventoryItemId of inventoryItemIds) {
    await reverseConsumption(tx, {
      inventoryItemId,
      referenceId: orderId,
      recordedById: userId,
      reasonCode: 'production_order_cancelled',
    })
  }
}

export async function cancelProductionOrder(params: { orderId: string; userId: string; permissions: string[] }) {
  const { orderId, userId, permissions } = params
  if (!permissions.includes('production_orders.manage')) {
    throw new ForbiddenError('Only admin can cancel a production order')
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.prepProductionOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundError('Production order not found')
    if (order.status !== 'pending') {
      throw new BusinessRuleError(`Cannot cancel a production order in status ${order.status}`)
    }

    // An outside order already gave its ingredients away at creation —
    // cancelling it has to credit those back, or the stock is just gone
    // with nothing to show for it.
    if (order.source === 'outside') {
      await reverseOutsideOrderConsumption(tx, orderId, userId)
    }

    const updated = await tx.prepProductionOrder.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    })

    await writeAuditLog(tx, {
      userId,
      action: 'production_order.cancelled',
      entityType: 'PrepProductionOrder',
      entityId: orderId,
      beforeData: order,
      afterData: updated,
    })

    return updated
  })
}

/**
 * Read-only preview of what an order for `targetQuantity` of this recipe
 * would need — no stock is touched. Cost is a live estimate (whatever lots
 * would actually be drawn right now), scaled to `targetQuantity` rather than
 * a fixed batch amount, same as the ingredient quantities themselves.
 */
export async function previewProductionOrderIngredients(prepRecipeId: string, targetQuantity: number) {
  const recipe = await prisma.prepRecipe.findUnique({
    where: { id: prepRecipeId },
    include: { inputs: { include: { inputItem: true } } },
  })
  if (!recipe) throw new NotFoundError('Prep recipe not found')

  const scaled = scaleInputs(recipe, targetQuantity)
  return Promise.all(
    recipe.inputs.map(async (input) => {
      const needed = scaled.find((s) => s.inputItemId === input.inputItemId)!.quantity
      const lineCost = await simulateDrawCost(input.inputItemId, needed)
      return {
        inputItemId: input.inputItemId,
        name: input.inputItem.name,
        unit: input.inputItem.unit,
        needed,
        available: input.inputItem.currentStock,
        lineCost,
      }
    })
  )
}
