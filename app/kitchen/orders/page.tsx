import { Clock, ChefHat } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const orders = [
  {
    id: 'ord_1', table: 'T3', status: 'pending', minutes: 2,
    items: [{ name: 'Margherita Pizza', qty: 2 }, { name: 'Caesar Salad', qty: 1 }],
  },
  {
    id: 'ord_2', table: 'T7', status: 'pending', minutes: 5,
    items: [{ name: 'Grilled Chicken', qty: 1 }],
  },
  {
    id: 'ord_3', table: 'T1', status: 'preparing', minutes: 12,
    items: [{ name: 'Pasta Carbonara', qty: 2 }, { name: 'Tiramisu', qty: 2 }],
  },
  {
    id: 'ord_4', table: 'T5', status: 'preparing', minutes: 18,
    items: [{ name: 'Margherita Pizza', qty: 1 }, { name: 'Lemonade', qty: 3 }],
  },
  {
    id: 'ord_5', table: 'T2', status: 'ready', minutes: 22,
    items: [{ name: 'Grilled Chicken', qty: 2 }, { name: 'Caesar Salad', qty: 2 }],
  },
] 

type ColStatus = 'pending' | 'preparing' | 'ready'

const columns: { status: ColStatus; label: string; next: string; nextLabel: string; color: string }[] = [
  { status: 'pending',   label: 'Pending',   next: 'preparing', nextLabel: 'Start preparing', color: 'bg-muted text-muted-foreground' },
  { status: 'preparing', label: 'Preparing', next: 'ready',     nextLabel: 'Mark ready',       color: 'bg-warning text-warning-foreground' },
  { status: 'ready',     label: 'Ready',     next: 'served',    nextLabel: 'Mark served',      color: 'bg-success text-success-foreground' },
]

export default function KitchenOrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Kitchen Orders" description="Live order queue" />

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
                      <span className="font-semibold text-foreground">{order.table}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />{order.minutes}m ago
                      </span>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <ul className="mb-3 flex flex-col gap-1">
                        {order.items.map((item) => (
                          <li key={item.name} className="flex justify-between text-sm">
                            <span>{item.name}</span>
                            <span className="font-medium">×{item.qty}</span>
                          </li>
                        ))}
                      </ul>
                      <Button size="sm" className="w-full" onClick={() => console.log('advance', order.id)}>
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
    </div>
  )
}
