import { z } from 'zod'

export const createPrepRecipeSchema = z.object({
  outputItemId: z.string().min(1),
  yieldQuantity: z.number().positive(),
  batchInputNote: z.string().optional(),
  inputs: z
    .array(
      z.object({
        inputItemId: z.string().min(1),
        quantity: z.number().positive(),
      })
    )
    .min(1),
})

export const producePrepRecipeSchema = z
  .object({
    quantityProduced: z.number().positive(),
    // internal = made in-house (consumes the recipe's inputs, laborCost is reference-only).
    // outside = outsourced to a third party (no inputs consumed, outsideCost prices the lot).
    source: z.enum(['internal', 'outside']).default('internal'),
    laborCost: z.number().nonnegative().default(0),
    outsideCost: z.number().positive().optional(),
    costingMethod: z.enum(['fifo', 'lifo']).default('fifo'),
    // Meaningful mainly when the output is a finished_good held ahead of sale
    // (e.g. a cooked batch) — informational only, surfaced in the UI.
    expiresAt: z.coerce.date().optional(),
  })
  .refine((data) => data.source !== 'outside' || (data.outsideCost ?? 0) > 0, {
    message: 'The cost paid is required for an outside-produced batch',
    path: ['outsideCost'],
  })
