import { z } from 'zod'

export const createProductionOrderSchema = z
  .object({
    prepRecipeId: z.string().min(1),
    targetQuantity: z.number().positive(),
    // Decided once, at order creation — internal goes to the assigned team's
    // queue, outside consumes its ingredients right away (see the service).
    // Can't be changed once the order exists.
    source: z.enum(['internal', 'outside']),
    // Required for internal (who executes it); meaningless for outside, so
    // never sent there — admin is always the one who receives an outside order.
    assignedTeam: z.enum(['kitchen', 'waiter']).optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.source !== 'internal' || !!data.assignedTeam, {
    message: 'An in-house production order needs to be assigned to kitchen or waiter',
    path: ['assignedTeam'],
  })

// Fulfilling an order records what ACTUALLY happened — quantityProduced can
// (and often will) differ from the order's targetQuantity, and for an
// internal order that's also what ingredient consumption is scaled to
// (outside already consumed its ingredients at creation, scaled to the
// target). source is never passed here: it's inherited from the order
// itself, and the service layer rejects a missing outsideCost when the
// order's source is 'outside'.
export const fulfillProductionOrderSchema = z.object({
  quantityProduced: z.number().positive(),
  laborCost: z.number().nonnegative().default(0),
  outsideCost: z.number().nonnegative().optional(),
  costingMethod: z.enum(['fifo', 'lifo']).default('fifo'),
  expiresAt: z.coerce.date().optional(),
})
