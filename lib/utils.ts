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
export { cn } from "cn"
