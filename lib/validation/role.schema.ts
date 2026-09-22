import { z } from 'zod'
import { PERMISSION_KEYS } from '@/lib/permissions'

// A Postgres text[] has no DB-level constraint on its contents, so this is
// what stops an unknown/typo'd permission key from being silently granted
// (it would just never match anything requirePermission checks for).
const permissionsField = z
  .array(z.string())
  .refine((arr) => arr.every((k) => PERMISSION_KEYS.includes(k)), { message: 'Unknown permission key' })

export const createRoleSchema = z.object({
  name: z.string().min(1),
  homeArea: z.enum(['admin', 'kitchen', 'waiter', 'cashier']),
  maxDiscountPercent: z.number().min(0).max(100),
  permissions: permissionsField,
})

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  homeArea: z.enum(['admin', 'kitchen', 'waiter', 'cashier']).optional(),
  maxDiscountPercent: z.number().min(0).max(100).optional(),
  permissions: permissionsField.optional(),
})
