import type { Role } from '@prisma/client'
import { ForbiddenError, BusinessRuleError } from '@/lib/errors'

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

// A purchase order may not be approved by the same user who created it
// (separation of duties). Flip this to a no-op if a single-admin deployment
// finds it impractical.
export function assertNotSelfApproval(createdById: string, approverId: string) {
  if (createdById === approverId) {
    throw new ForbiddenError('A purchase order cannot be approved by its own creator')
  }
}
