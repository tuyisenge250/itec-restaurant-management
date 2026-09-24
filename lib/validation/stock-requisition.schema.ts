import { z } from 'zod'

export const createRequisitionSchema = z.object({
  location: z.enum(['kitchen', 'bar']),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        quantityRequested: z.number().positive(),
      })
    )
    .min(1),
})

// Approving is the moment stock leaves main — quantityApproved per line lets
// admin send less than requested (partial fulfillment) without rejecting the
// whole thing; a 0 line is skipped (nothing deducted for it).
export const approveRequisitionSchema = z.object({
  reviewNotes: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1), // StockRequisitionItem id
        quantityApproved: z.number().nonnegative(),
      })
    )
    .min(1),
})

// Required — this is the "sent back" reason the requester sees.
export const rejectRequisitionSchema = z.object({
  reviewNotes: z.string().min(1),
})

export const receiveRequisitionSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1), // StockRequisitionItem id
        quantityReceived: z.number().nonnegative(),
      })
    )
    .min(1),
})

export const recordLocationReturnSchema = z.object({
  quantityReturned: z.number().positive(),
  reason: z.string().min(1, 'A reason is required'),
})

export const adjustLocationStockSchema = z.object({
  inventoryItemId: z.string().min(1),
  location: z.enum(['kitchen', 'bar']),
  quantity: z.number().refine((n) => n !== 0, 'Adjustment quantity cannot be zero'),
  reasonCode: z.string().min(1),
  notes: z.string().optional(),
})
