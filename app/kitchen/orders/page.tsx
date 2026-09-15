'use client'

import { useState } from 'react'
import { Clock, ChefHat, AlertTriangle, Ban } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { useOrders, useUpdateOrderStatus, useVoidOrderItem, type OrderStatusTarget } from '@/lib/api/orders'
import { useCurrentUser } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'

type ColStatus = 'pending' | 'preparing' | 'ready'

const columns: { status: ColStatus; label: string; next: OrderStatusTarget; nextLabel: string; color: string }[] = [
  { status: 'pending',   label: 'Pending',   next: 'preparing', nextLabel: 'Start preparing', color: 'bg-muted text-muted-foreground' },
  { status: 'preparing', label: 'Preparing', next: 'ready',     nextLabel: 'Mark ready',       color: 'bg-warning text-warning-foreground' },
  { status: 'ready',     label: 'Ready',     next: 'served',    nextLabel: 'Mark served',      color: 'bg-success text-success-foreground' },
]

function minutesAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

export default function KitchenOrdersPage() {
  const { data: orders = [], isLoading } = useOrders({ refetchInterval: 5000 })
  const { data: me } = useCurrentUser()
  const updateStatus = useUpdateOrderStatus()
  const voidItem = useVoidOrderItem()

  const [stockError, setStockError] = useState<{ orderId: string; message: string } | null>(null)
  const [voidTarget, setVoidTarget] = useState<{ orderItemId: string; name: string } | null>(null)
  const [voidReason, setVoidReason] = useState('')

  function advance(orderId: string, next: OrderStatusTarget) {
    setStockError(null)
    updateStatus.mutate(
      { id: orderId, status: next },
      {
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'INSUFFICIENT_STOCK') {
            setStockError({ orderId, message: err.message })
          }
        },
      }
    )
  }

  function confirmVoid() {
    if (!voidTarget || !voidReason.trim()) return
    voidItem.mutate(
      { orderItemId: voidTarget.orderItemId, data: { voidReason } },
      { onSuccess: () => { setVoidTarget(null); setVoidReason('') } }
    )
  }

  const myActivity = orders
    .flatMap((o) => o.items.filter((i) => i.preparedById === me?.id && i.preparedAt).map((i) => ({ order: o, item: i })))
    .sort((a, b) => new Date(b.item.preparedAt!).getTime() - new Date(a.item.preparedAt!).getTime())

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Kitchen Orders" description="Live order queue" />

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="activity">My activity</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
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
                            <span className="font-semibold text-foreground">Table {order.table}</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />{minutesAgo(order.createdAt)}m ago
                            </span>
                          </CardHeader>
                          <CardContent className="px-4 pb-4">
                            {stockError?.orderId === order.id && (
                              <Alert variant="destructive" className="mb-3">
                                <AlertTriangle />
                                <AlertDescription>Can&apos;t fulfill: {stockError.message}</AlertDescription>
                              </Alert>
                            )}
                            <ul className="mb-3 flex flex-col gap-1">
                              {order.items.map((item) => (
                                <li key={item.id} className={`flex items-center justify-between text-sm ${item.isVoided ? 'text-muted-foreground line-through' : ''}`}>
                                  <span>{item.menuItem.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">×{item.quantity}</span>
                                    {!item.isVoided && col.status !== 'pending' && (
                                      <button
                                        onClick={() => setVoidTarget({ orderItemId: item.id, name: item.menuItem.name })}
                                        className="text-muted-foreground hover:text-destructive"
                                        aria-label="Void item"
                                      >
                                        <Ban className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                            <Button
                              size="sm"
                              className="w-full"
                              disabled={updateStatus.isPending}
                              onClick={() => advance(order.id, col.next)}
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
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {myActivity.length === 0 ? (
            <EmptyState icon={ChefHat} message="Nothing marked ready by you yet." />
          ) : (
            <div className="flex flex-col gap-2">
              {myActivity.map(({ order, item }) => (
                <Card key={item.id}>
                  <CardContent className="flex items-center justify-between p-4 text-sm">
                    <span>Table {order.table} · {item.menuItem.name} ×{item.quantity}</span>
                    <span className="text-muted-foreground">{new Date(item.preparedAt!).toLocaleString()}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!voidTarget} onOpenChange={(o) => { if (!o) { setVoidTarget(null); setVoidReason('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void {voidTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              If stock was already deducted for this item, voiding will restore it to inventory.
              A reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason (e.g. customer changed order, made incorrectly)"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={!voidReason.trim() || voidItem.isPending} onClick={confirmVoid}>
              Void item
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
