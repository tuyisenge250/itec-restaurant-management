export function rwf(amount: number) {
  return `RWF ${Math.round(amount).toLocaleString()}`
}
// Menu items can intentionally share a name at different sizes/prices (Soda
// 0.3 L vs 0.5 L) — this is the plain-text form of "name + size" used
// anywhere a styled two-tone label isn't practical (dialog titles, aria
// labels, receipts).
export function menuItemLabel(name: string, variantLabel: string | null | undefined) {
  return variantLabel ? `${name} · ${variantLabel}` : name
}
// poNumber/grnNumber are global autoincrements (see prisma/schema.prisma) —
// the year here is just display context from when the record was created,
// not part of the sequence, so it never resets and never collides.
export function formatPoNumber(poNumber: number, createdAt: string | Date) {
  return `PO-${new Date(createdAt).getFullYear()}-${String(poNumber).padStart(4, '0')}`
}
export function formatGrnNumber(grnNumber: number, receivedAt: string | Date) {
  return `GRN-${new Date(receivedAt).getFullYear()}-${String(grnNumber).padStart(4, '0')}`
}
export { cn } from "cn"
