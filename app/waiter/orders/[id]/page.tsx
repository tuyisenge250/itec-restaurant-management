'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrder } from '@/lib/api/orders'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: order, isLoading } = useOrder(id)

  if (isLoading) return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  if (!order) return <p className="text-muted-foreground">Order not found.</p>

  const total = order.items.reduce((s, i) => s + i.priceAtSale * i.quantity, 0)

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/waiter/orders">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <PageHeader
          title={`Order ${order.tableNumber ? `· Table ${order.tableNumber}` : ''}`}
          description={`#${order.id.slice(0, 8)} · ${new Date(order.createdAt).toLocaleString()}`}
        />
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Items</CardTitle>
          <StatusBadge status={order.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pb-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.menuItem.name} <span className="text-muted-foreground">×{item.quantity}</span></span>
              <span>${(item.priceAtSale * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <Separator className="my-1" />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {(order.status === 'ready' || order.status === 'served') && (
        <Link href={`/waiter/payments/${order.id}`}>
          <Button className="w-full">
            <CreditCard className="mr-2 h-4 w-4" /> Record payment
          </Button>
        </Link>
      )}
    </div>
  )
}
