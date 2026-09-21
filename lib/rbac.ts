import type { Role } from '@prisma/client'
import { BusinessRuleError } from '@/lib/errors'

// Maximum discount percent each role may apply to an order/payment, server-enforced.
// The UI hiding a bigger discount field is not access control — every discount
// request is re-checked here regardless of what the client sent.
export const DISCOUNT_CAPS: Record<Role, number> = {
  waiter: 15,
  kitchen: 0,
  cashier: 15,
  admin: 100,
}

export function assertDiscountAllowed(role: Role, discountPercent: number) {
  const cap = DISCOUNT_CAPS[role]
  if (discountPercent > cap) {
    throw new BusinessRuleError(
      `${role} may not apply a discount above ${cap}% (requested ${discountPercent}%)`,
      'DISCOUNT_CAP_EXCEEDED'
    )
  }
}
