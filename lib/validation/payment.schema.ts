import { z } from 'zod'

export const createPaymentSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(['cash', 'card', 'upi', 'other']),
  amount: z.number().positive(),
  discount: z.number().min(0).default(0),
  notes: z.string().optional(),
})

export const receiveStockSchema = z.object({
  inventoryItemId: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
})

export const logWasteSchema = z.object({
  inventoryItemId: z.string().min(1),
  quantity: z.number().positive(),
  notes: z.string().optional(),
})