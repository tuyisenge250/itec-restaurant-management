import type { Role } from '@prisma/client'
import { BusinessRuleError } from '@/lib/errors'

// Maximum discount percent each role may apply to an order/payment, server-enforced.
// The UI hiding a bigger discount field is not access control — every discount
// request is re-checked here regardless of what the client sent.
export const DISCOUNT_CAPS: Record<Role, number> = {
  waiter: 15,
  kitchen: 0,
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

// Maximum a non-admin may refund on a single payment, as a percent of that
// payment's own amount (cumulative across all refunds on it) — a waiter can
// undo a small mistake themselves; anything bigger needs an admin, who has
// no cap. Kitchen never refunds (they don't take payments).
export const REFUND_CAPS: Record<Role, number> = {
  waiter: 20,
  kitchen: 0,
  admin: 100,
}

export function assertRefundAllowed(role: Role, cumulativeRefundPercent: number) {
  const cap = REFUND_CAPS[role]
  if (cumulativeRefundPercent > cap) {
    throw new BusinessRuleError(
      `${role} may not refund above ${cap}% of a payment (this would bring it to ${cumulativeRefundPercent.toFixed(1)}%)`,
      'REFUND_CAP_EXCEEDED'
    )
  }
}
