'use client'

import { Clock, ChefHat } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrders, useUpdateOrderStatus, type OrderStatus } from '@/lib/api/orders'

type ColStatus = 'pending' | 'preparing' | 'ready'

const columns: { status: ColStatus; label: string; next: OrderStatus; nextLabel: string; color: string }[] = [
  { status: 'pending',   label: 'Pending',   next: 'preparing', nextLabel: 'Start preparing', color: 'bg-muted text-muted-foreground' },
  { status: 'preparing', label: 'Preparing', next: 'ready',     nextLabel: 'Mark ready',       color: 'bg-warning text-warning-foreground' },
  { status: 'ready',     label: 'Ready',     next: 'served',    nextLabel: 'Mark served',      color: 'bg-success text-success-foreground' },
]

function minutesAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

export default function KitchenOrdersPage() {
  const { data: orders = [], isLoading } = useOrders()
  const updateStatus = useUpdateOrderStatus()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Kitchen Orders" description="Live order queue" />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {columns.map((col) => {
            const colOrders = orders.filter((o) => o.status === col.status)
            return (
              <div key={col.status} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Badge className={col.color}>{col.label}</Badge>
                  <span className="text-sm text-muted-foreground">{colOrders.length}</span>
                </div>

                {colOrders.length === 0 ? (
                  <EmptyState icon={ChefHat} message={`No ${col.label.toLowerCase()} orders`} />
                ) : (
                  colOrders.map((order) => (
                    <Card key={order.id}>
                      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                        <span className="font-semibold text-foreground">
                          {order.tableNumber ?? 'No table'}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />{minutesAgo(order.createdAt)}m ago
                        </span>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <ul className="mb-3 flex flex-col gap-1">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex justify-between text-sm">
                              <span>{item.menuItem.name}</span>
                              <span className="font-medium">×{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: order.id, status: col.next })}
                        >
                          {col.nextLabel}
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
