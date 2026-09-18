'use client'

import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FulfillProductionOrderDialog } from '@/components/fulfill-production-order-dialog'
import { useProductionOrders, type ProductionOrder, type ProductionAssignedRole } from '@/lib/api/production-orders'

// Orders admin has placed and assigned to this role — outside-sourced orders
// never show here (receiving those is admin's job), and neither does an
// order assigned to the OTHER role. Fulfilling one runs the actual batch,
// tied back to the order so the plan-vs-actual gets tracked. Shared by the
// kitchen and waiter pages — same queue mechanics, just scoped by role.
export function ProductionOrdersQueue({ assignedRole }: { assignedRole: ProductionAssignedRole }) {
  const [fulfillTarget, setFulfillTarget] = useState<ProductionOrder | null>(null)
  const { data: orders = [], isLoading } = useProductionOrders({ status: 'pending', source: 'internal', assignedRole })

  if (isLoading) return <Skeleton className="h-16 w-full" />
  if (orders.length === 0) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <span className="flex items-center gap-1.5 text-sm font-medium"><ClipboardList className="h-3.5 w-3.5" />Production orders</span>
        <div className="flex flex-col gap-2">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span className="flex flex-col">
                <span>
                  {order.prepRecipe.outputItem.name}
                  <span className="ml-1.5 text-muted-foreground">
                    {order.targetQuantity} {order.prepRecipe.outputItem.unit} ordered by {order.createdBy.name}
                  </span>
                </span>
                {order.notes && <span className="text-xs text-muted-foreground">{order.notes}</span>}
              </span>
              <Button size="sm" onClick={() => setFulfillTarget(order)}>Fulfill</Button>
            </div>
          ))}
        </div>
      </CardContent>
      <FulfillProductionOrderDialog
        order={fulfillTarget}
        onClose={() => setFulfillTarget(null)}
        showStockCheck
        simplified
      />
    </Card>
  )
}
