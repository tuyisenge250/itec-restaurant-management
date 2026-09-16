import { z } from 'zod'

// Waste is always lot-specific — the caller says which batch was wasted, not
// just which item, so cost/traceability stays exact.
export const logWasteSchema = z.object({
  lotId: z.string().min(1),
  quantity: z.number().positive(),
  notes: z.string().optional(),
})

// Manual correction against one lot. Positive = found stock, negative =
// correction; a reason code is always required.
export const adjustStockSchema = z.object({
  lotId: z.string().min(1),
  quantity: z.number().refine((n) => n !== 0, 'Adjustment quantity cannot be zero'),
  reasonCode: z.string().min(1),
  notes: z.string().optional(),
})

// Corrects a lot's unit cost (e.g. the receiving price was a data-entry
// mistake) without moving any stock — a separate action from adjustStock.
export const adjustLotPriceSchema = z.object({
  lotId: z.string().min(1),
  newUnitCost: z.number().positive(),
  reasonCode: z.string().min(1),
  notes: z.string().optional(),
})
