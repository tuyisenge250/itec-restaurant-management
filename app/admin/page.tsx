'use client'

import { DollarSign, ShoppingBag, AlertTriangle, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProfitByItemChart } from '@/components/profit-by-item-chart'
import { useOrders } from '@/lib/api/orders'
import { useInventory } from '@/lib/api/inventory'
import { rwf, menuItemLabel } from '@/lib/utils'

function minutesAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

export default function AdminDashboard() {
  const { data: orders = [], isLoading: ordersLoading } = useOrders()
  const { data: inventory = [], isLoading: inventoryLoading } = useInventory()

  const today = new Date().toDateString()
  // 'payment_pending' counts as paid here too — the waiter has already
  // collected the money and handed over a receipt, cashier's confirmation
  // is just an internal reconciliation step, not when the sale happened.
  const todayPaid = orders.filter(
    (o) => ['payment_pending', 'paid'].includes(o.status) && new Date(o.updatedAt).toDateString() === today
  )
  const soldItems = (o: (typeof orders)[number]) => o.items.filter((i) => !i.isVoided)
  const revenue = todayPaid.reduce((s, o) => s + soldItems(o).reduce((a, i) => a + i.priceAtSale * i.quantity, 0), 0)
  const profit  = todayPaid.reduce((s, o) => s + soldItems(o).reduce((a, i) => a + (i.priceAtSale - i.costAtSale) * i.quantity, 0), 0)
  const active  = orders.filter((o) => ['pending', 'preparing', 'ready', 'served'].includes(o.status))
  const lowStock = inventory.filter((i) => i.currentStock <= i.reorderLevel)

  const itemProfit = new Map<string, { name: string; profit: number }>()
  for (const o of todayPaid) {
    for (const i of soldItems(o)) {
      const existing = itemProfit.get(i.menuItemId) ?? { name: menuItemLabel(i.menuItem.name, i.menuItem.variantLabel), profit: 0 }
      existing.profit += (i.priceAtSale - i.costAtSale) * i.quantity
      itemProfit.set(i.menuItemId, existing)
    }
  }
  const profitByItem = Array.from(itemProfit.values()).sort((a, b) => b.profit - a.profit)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Restaurant overview" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {ordersLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : (
          <>
            <StatCard icon={DollarSign}    label="Today's revenue" value={rwf(revenue)} />
            <StatCard icon={TrendingUp}    label="Today's profit"  value={rwf(profit)} />
            <StatCard icon={ShoppingBag}   label="Active orders"   value={String(active.length)} />
            <StatCard icon={AlertTriangle} label="Low stock items" value={String(lowStock.length)} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Profit by item (today)</CardTitle></CardHeader>
          <CardContent>
            {ordersLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ProfitByItemChart items={profitByItem} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Active orders</CardTitle></CardHeader>
          <CardContent className="p-0">
            {ordersLoading ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : active.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No active orders.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.map((o) => (
                    <TableRow key={o.id} className="hover:bg-accent">
                      <TableCell className="font-medium">{o.table}</TableCell>
                      <TableCell>{o.items.length}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-right text-muted-foreground">{minutesAgo(o.createdAt)}m</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Low stock alerts</CardTitle></CardHeader>
          <CardContent className="p-0">
            {inventoryLoading ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : lowStock.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">All stock levels are healthy.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reorder at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((item) => (
                    <TableRow key={item.id} className="hover:bg-accent">
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right text-destructive">{item.currentStock.toFixed(2)} {item.unit}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{item.reorderLevel} {item.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
