import { z } from 'zod'

export const createPaymentSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(['cash', 'card', 'momo', 'other']),
  amount: z.number().positive(),
  discount: z.number().min(0).default(0),
  discountReason: z.string().optional(),
  notes: z.string().optional(),
})

export const refundPaymentSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
})

export const requestRefundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
})

export const denyRefundRequestSchema = z.object({
  denialReason: z.string().optional(),
})