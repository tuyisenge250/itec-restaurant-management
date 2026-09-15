// Money fields are stored as Float in Postgres (no schema-level Decimal type
// in use), so every comparison/sum that must be exact (payments, refunds,
// discounts) is done in integer cents here rather than on raw floats.

export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

export function sumCents(amounts: number[]): number {
  return amounts.reduce((sum, a) => sum + toCents(a), 0)
}
