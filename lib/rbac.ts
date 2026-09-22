import { BusinessRuleError } from '@/lib/errors'

// The discount ceiling is now a per-role field (Role.maxDiscountPercent,
// admin-editable) rather than a hardcoded role->number map — the caller
// resolves it from the actor's role (already fetched by requireUser) and
// passes it straight in. Server-enforced regardless of what the client sent;
// the UI hiding a bigger discount field is not access control.
export function assertDiscountAllowed(maxDiscountPercent: number, discountPercent: number) {
  if (discountPercent > maxDiscountPercent) {
    throw new BusinessRuleError(
      `Your role may not apply a discount above ${maxDiscountPercent}% (requested ${discountPercent}%)`,
      'DISCOUNT_CAP_EXCEEDED'
    )
  }
}
