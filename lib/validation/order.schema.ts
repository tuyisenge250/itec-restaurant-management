import { z } from 'zod'

export const createOrderSchema = z.object({
  table: z.string().min(1),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
})

export const updateOrderItemsSchema = z.object({
  add: z
    .array(z.object({ menuItemId: z.string().min(1), quantity: z.number().int().positive() }))
    .default([]),
  removeItemIds: z.array(z.string().min(1)).default([]),
})

// 'pending' is the initial state only (not a PATCH target) and 'paid' is
// only ever set by the payment service once the balance is covered.
export const updateOrderStatusSchema = z.object({
  status: z.enum(['preparing', 'ready', 'served', 'cancelled']),
})

// Splits by QUANTITY per line, not whole rows — a line ordered ×3 can send
// 1 to the new order and keep 2 on this one.
export const splitOrderSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
})

export const mergeOrderSchema = z.object({
  targetOrderId: z.string().min(1),
})

export const voidOrderItemSchema = z.object({
  voidReason: z.string().min(1),
})

export const applyDiscountSchema = z
  .object({
    discountPercent: z.number().min(0).max(100).optional(),
    discountAmount: z.number().min(0).optional(),
    discountReason: z.string().optional(),
  })
  .refine((data) => data.discountPercent !== undefined || data.discountAmount !== undefined, {
    message: 'Either discountPercent or discountAmount is required',
  })
  .refine(
    (data) => {
      const nonZero = (data.discountPercent ?? 0) > 0 || (data.discountAmount ?? 0) > 0
      return !nonZero || !!data.discountReason
    },
    { message: 'discountReason is required when applying a non-zero discount', path: ['discountReason'] }
  )
