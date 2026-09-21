import { z } from 'zod'

export const createMenuItemSchema = z.object({
  name: z.string().min(1),
  // e.g. "0.3 L" / "0.5 L" / "Large" — lets the same product name be listed
  // more than once at different sizes/prices without looking like a
  // duplicate on the ordering screen.
  variantLabel: z.string().optional(),
  categoryId: z.string().optional(),
  price: z.number().positive(),
  preparationCost: z.number().nonnegative().default(0),
  // false = direct-serve: no kitchen ticket, served immediately by the waiter.
  requiresPreparation: z.boolean().default(true),
  recipe: z
    .array(z.object({ inventoryItemId: z.string().min(1), quantity: z.number().positive() }))
    .min(1),
})

export const updateMenuItemSchema = z.object({
  name: z.string().min(1).optional(),
  variantLabel: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  preparationCost: z.number().nonnegative().optional(),
  requiresPreparation: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
})

export const createMenuCategorySchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
})

export const updateMenuCategorySchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
})
