import { z } from 'zod'

export const updateRecipeSchema = z.object({
  ingredients: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        quantity: z.number().positive(),
      })
    )
    .min(1),
})
