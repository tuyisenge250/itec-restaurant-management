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

export const producePrepRecipeSchema = z.object({
  quantityProduced: z.number().positive(),
  laborCost: z.number().nonnegative().default(0),
  costingMethod: z.enum(['fifo', 'lifo']).default('fifo'),
})
