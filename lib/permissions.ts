// Single source of truth for every permission key checked anywhere in the
// app. A role's `permissions` column (see prisma/schema.prisma's Role model)
// is a Postgres text[] with no DB-level constraint, so PERMISSION_KEYS below
// is what stops a typo'd/unknown key from being silently granted — role
// create/update validation rejects anything not in this list.
//
// Keys are deliberately coarser than the ~81 individual `requireRole` call
// sites they replace: one key per resource-area-and-action-granularity that
// is actually distinct in the app's behavior today. Where a role's access to
// something depends on whether they own the resource, that's a `_own` vs
// `_all` (or a bespoke `_any`) pair rather than one flat key — see
// PERMISSIONS_README.md-equivalent notes inline below for the non-obvious
// ones.
export type Permission = { key: string; label: string; category: string }

export const PERMISSIONS: Permission[] = [
  // Users & Roles
  { key: 'users.view', label: 'View staff accounts', category: 'Users & Roles' },
  { key: 'users.manage', label: 'Create/edit/deactivate staff accounts', category: 'Users & Roles' },
  { key: 'roles.manage', label: 'Create/edit roles and permissions', category: 'Users & Roles' },

  // Suppliers
  { key: 'suppliers.manage', label: 'Manage suppliers', category: 'Suppliers' },

  // Purchase Orders
  { key: 'purchase_orders.manage', label: 'Manage purchase orders, receiving, and supplier payments', category: 'Purchase Orders' },

  // Inventory
  { key: 'inventory.view', label: 'View inventory items and stock levels', category: 'Inventory' },
  { key: 'inventory.view_costing', label: 'View lot-level costing and usage reports', category: 'Inventory' },
  { key: 'inventory.manage', label: 'Create/edit inventory items, adjust stock and prices', category: 'Inventory' },
  { key: 'inventory.waste', label: 'View and log waste', category: 'Inventory' },

  // Recipes & Production
  { key: 'prep_recipes.view', label: 'View prep recipes', category: 'Recipes & Production' },
  { key: 'prep_recipes.manage', label: 'Create/edit prep recipes', category: 'Recipes & Production' },
  { key: 'prep_recipes.produce', label: 'Run ad-hoc prep production', category: 'Recipes & Production' },
  { key: 'production_orders.view', label: 'View production orders', category: 'Recipes & Production' },
  { key: 'production_orders.manage', label: 'Create/cancel production orders', category: 'Recipes & Production' },
  { key: 'production_orders.fulfill', label: 'Fulfill a production order assigned to your team', category: 'Recipes & Production' },
  // Bypasses the "must be the order's assigned team" check, and is required
  // for outside-sourced orders regardless of team.
  { key: 'production_orders.fulfill_any', label: 'Fulfill any production order, regardless of assigned team', category: 'Recipes & Production' },

  // Requisitions
  { key: 'requisitions.manage', label: 'Request, cancel, and receive stock requisitions for your location', category: 'Requisitions' },
  { key: 'requisitions.review', label: 'Approve or reject stock requisitions', category: 'Requisitions' },
  { key: 'location_stock.view', label: 'View kitchen/bar stock levels', category: 'Requisitions' },
  { key: 'location_stock.adjust', label: 'Manually adjust kitchen/bar stock', category: 'Requisitions' },

  // Menu
  { key: 'menu.manage', label: 'Manage menu categories, items, and recipes', category: 'Menu' },

  // Orders
  { key: 'orders.manage_own', label: 'Create and edit your own orders', category: 'Orders' },
  { key: 'orders.manage_all', label: 'Create and edit any order', category: 'Orders' },
  { key: 'orders.view_all', label: 'View any order (not just your own)', category: 'Orders' },
  // Distinct from orders.manage_all: cashier gets unrestricted discount
  // authority without general order-editing rights (see order.service.ts
  // applyDiscount) — do not fold this into manage_all.
  { key: 'orders.discount_any', label: 'Apply a discount to any order', category: 'Orders' },
  { key: 'orders.cogs.view', label: 'View per-order COGS breakdown', category: 'Orders' },

  // Order Fulfillment
  { key: 'order_items.fulfill_prep', label: 'Claim and prepare kitchen-ticket order items', category: 'Order Fulfillment' },
  { key: 'order_items.fulfill_direct', label: 'Fulfill direct-serve order items', category: 'Order Fulfillment' },
  { key: 'order_items.serve', label: 'Hand served items to the customer', category: 'Order Fulfillment' },

  // Payments
  { key: 'payments.confirm', label: 'Confirm/reconcile a payment', category: 'Payments' },

  // Expenses
  { key: 'expenses.manage', label: 'Manage expenses and expense categories', category: 'Expenses' },

  // Reports
  { key: 'reports.view', label: 'View reports (COGS, profit, reconciliation)', category: 'Reports' },

  // Misc
  { key: 'tables.view', label: 'View table status', category: 'Misc' },
  { key: 'audit_log.view', label: 'View the system-wide audit log', category: 'Misc' },
]

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key)
export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const PERMISSION_CATEGORIES = [...new Set(PERMISSIONS.map((p) => p.category))]

// The two keys that together let someone reach the role/user management
// surface at all. Holding both is what role.service.ts's and
// user.service.ts's lockout guards protect, and what makes a permission
// change worth flagging as a privilege escalation in the audit log — see
// isPrivilegedPermissionSet below.
export const PRIVILEGED_PERMISSION_KEYS = ['roles.manage', 'users.manage'] as const

export function isPrivilegedPermissionSet(permissions: string[]) {
  return PRIVILEGED_PERMISSION_KEYS.every((key) => permissions.includes(key))
}
