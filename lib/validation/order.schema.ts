import { z } from 'zod'

export const createOrderSchema = z.object({
  tableNumber: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
})

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'served', 'paid', 'cancelled']),
})