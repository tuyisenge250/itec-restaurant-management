import { z } from 'zod'

export const recordGoodsReturnSchema = z.object({
  quantityReturned: z.number().positive(),
  reason: z.string().min(1, 'A reason is required'),
})
