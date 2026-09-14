import { z } from 'zod'

export const createSupplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
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

export const receivePurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        purchaseOrderItemId: z.string().min(1),
        quantityReceived: z.number().positive(),
      })
    )
    .min(1),
})

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