import { PERMISSION_KEYS } from '../lib/permissions'

// The 4 roles that replace today's hardcoded Role enum, with permission
// bundles chosen to reproduce today's effective access exactly (see the
// RBAC migration plan). Shared by prisma/scripts/backfill-roles.ts (existing
// DB) and prisma/seed.ts (fresh DB) so the bundle definitions live in one
// place.
export const SEED_ROLES = [
  {
    name: 'Admin',
    homeArea: 'admin' as const,
    maxDiscountPercent: 100,
    // Admin holds every permission that exists, not a hardcoded bypass —
    // a custom role with this same bundle behaves identically.
    permissions: [...PERMISSION_KEYS],
  },
  {
    name: 'Kitchen',
    homeArea: 'kitchen' as const,
    maxDiscountPercent: 0,
    permissions: [
      'inventory.view',
      'inventory.view_costing',
      'inventory.waste',
      'prep_recipes.view',
      'prep_recipes.produce',
      'production_orders.view',
      'production_orders.fulfill',
      'requisitions.manage',
      'location_stock.view',
      'order_items.fulfill_prep',
      'orders.view_all',
      'tables.view',
    ],
  },
  {
    name: 'Waiter',
    homeArea: 'waiter' as const,
    maxDiscountPercent: 15,
    permissions: [
      'orders.manage_own',
      'order_items.serve',
      'production_orders.view',
      'production_orders.fulfill',
      'prep_recipes.view',
      'tables.view',
      'inventory.view',
    ],
  },
  {
    name: 'Cashier',
    homeArea: 'cashier' as const,
    maxDiscountPercent: 15,
    permissions: [
      'users.view',
      'orders.view_all',
      'order_items.fulfill_direct',
      'payments.confirm',
      'orders.discount_any',
      'requisitions.manage',
      'location_stock.view',
      'inventory.view',
    ],
  },
]
