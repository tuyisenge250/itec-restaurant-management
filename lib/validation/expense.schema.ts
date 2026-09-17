import { z } from 'zod'

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1),
})

export const updateExpenseCategorySchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
})

export const createExpenseSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().positive(),
  expenseDate: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), 'Invalid date'),
  description: z.string().optional(),
  isRecurring: z.boolean().default(false),
})

// expenseDate is deliberately not editable here — see updateExpense in
// expense.service.ts for why.
export const updateExpenseSchema = z.object({
  categoryId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  description: z.string().optional(),
  isRecurring: z.boolean().optional(),
})
