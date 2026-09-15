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
} from 'lucide-react'

export type Role = 'admin' | 'kitchen' | 'waiter'

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
}

export const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
    { title: 'Suppliers', url: '/admin/suppliers', icon: Truck },
    { title: 'Purchase orders', url: '/admin/purchase-orders', icon: ClipboardList },
    { title: 'Inventory', url: '/admin/inventory', icon: Boxes },
    { title: 'Recipes', url: '/admin/recipes', icon: BookOpen },
    { title: 'Menu', url: '/admin/menu', icon: UtensilsCrossed },
    { title: 'Users', url: '/admin/users', icon: Users },
    { title: 'Reports', url: '/admin/reports', icon: BarChart3 },
  ],
  kitchen: [
    { title: 'Orders', url: '/kitchen/orders', icon: ChefHat },
    { title: 'Waste', url: '/kitchen/waste', icon: Trash2 },
  ],
  waiter: [
    { title: 'New order', url: '/waiter/orders/new', icon: Receipt },
    { title: 'Orders', url: '/waiter/orders', icon: ClipboardList },
    { title: 'Payments', url: '/waiter/payments', icon: CreditCard },
  ],
}