import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Truck,
  ClipboardList,
  Boxes,
  UtensilsCrossed,
  BookOpen,
  Users,
  BarChart3,
  ChefHat,
  Receipt,
  CreditCard,
  Trash2,
  ListOrdered,
  Wallet,
  Package,
  ArrowLeftRight,
  ShieldCheck,
} from 'lucide-react'

export type Role = 'admin' | 'kitchen' | 'waiter' | 'cashier'

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  // Any one of these unlocks the item (same OR semantics as requirePermission
  // server-side) — the permission that actually gates the page's main data,
  // not necessarily every sub-action on it. Omitted = always visible to
  // anyone in this homeArea (shell roots / pages with no permission gate).
  permissions?: string[]
}

export const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
    { title: 'Orders', url: '/admin/orders', icon: ListOrdered, permissions: ['orders.view_all'] },
    { title: 'Suppliers', url: '/admin/suppliers', icon: Truck, permissions: ['suppliers.manage'] },
    { title: 'Purchase orders', url: '/admin/purchase-orders', icon: ClipboardList, permissions: ['purchase_orders.manage'] },
    { title: 'Inventory', url: '/admin/inventory', icon: Boxes, permissions: ['inventory.view'] },
    { title: 'Requisitions', url: '/admin/requisitions', icon: ArrowLeftRight, permissions: ['requisitions.manage'] },
    { title: 'Recipes', url: '/admin/recipes', icon: BookOpen, permissions: ['prep_recipes.view'] },
    { title: 'Menu', url: '/admin/menu', icon: UtensilsCrossed, permissions: ['menu.manage'] },
    { title: 'Users', url: '/admin/users', icon: Users, permissions: ['users.view'] },
    { title: 'Roles', url: '/admin/roles', icon: ShieldCheck, permissions: ['roles.manage', 'users.manage'] },
    { title: 'Expenses', url: '/admin/expenses', icon: Wallet, permissions: ['expenses.manage'] },
    { title: 'Reports', url: '/admin/reports', icon: BarChart3, permissions: ['reports.view'] },
  ],
  kitchen: [
    { title: 'Orders', url: '/kitchen/orders', icon: ChefHat, permissions: ['order_items.fulfill_prep'] },
    { title: 'Finished stock', url: '/kitchen/stock', icon: Package, permissions: ['inventory.view'] },
    { title: 'Stock requests', url: '/kitchen/requisitions', icon: ArrowLeftRight, permissions: ['requisitions.manage'] },
    { title: 'Waste', url: '/kitchen/waste', icon: Trash2, permissions: ['inventory.waste'] },
  ],
  waiter: [
    { title: 'New order', url: '/waiter/orders/new', icon: Receipt, permissions: ['orders.manage_own', 'orders.manage_all'] },
    { title: 'Orders', url: '/waiter/orders', icon: ClipboardList, permissions: ['orders.manage_own', 'orders.manage_all'] },
    { title: 'Payments', url: '/waiter/payments', icon: CreditCard, permissions: ['orders.manage_own', 'orders.manage_all'] },
  ],
  cashier: [
    { title: 'To confirm', url: '/cashier/queue', icon: Receipt, permissions: ['order_items.fulfill_direct'] },
    { title: 'Payments', url: '/cashier/payments', icon: CreditCard, permissions: ['payments.confirm'] },
    { title: 'Orders', url: '/cashier/orders', icon: ListOrdered, permissions: ['orders.view_all'] },
    { title: 'Stock requests', url: '/cashier/requisitions', icon: ArrowLeftRight, permissions: ['requisitions.manage'] },
  ],
}