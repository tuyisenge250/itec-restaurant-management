import { z } from 'zod'

export const createSupplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
})

export const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const createSupplierNoteSchema = z.object({
  type: z.enum(['late_delivery', 'quality_issue', 'general']).default('general'),
  note: z.string().min(1),
})

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        quantityOrdered: z.number().positive(),
        unitCost: z.number().nonnegative(),
      })
    )
    .min(1),
})

export const updatePurchaseOrderStatusSchema = z.object({
  status: z.enum(['pending_approval', 'ordered', 'cancelled']),
})

export const receivePurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        purchaseOrderItemId: z.string().min(1),
        quantityReceived: z.number().positive(),
        unitCost: z.number().nonnegative().optional(),
        costingMethod: z.enum(['fifo', 'lifo']),
      })
    )
    .min(1),
})
