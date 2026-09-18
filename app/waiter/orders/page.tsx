'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClipboardList, Info, Ban } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { useOrders, useUpdateOrderStatus, type Order } from '@/lib/api/orders'
import { ProductionOrdersQueue } from '@/components/production-orders-queue'
import { computeKitchenInfo, formatDuration } from '@/lib/kitchen-timing'
import { rwf } from '@/lib/utils'

function minutesAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

function OrderProgressDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { preparedByNames, sentToKitchenAt, kitchenDurationMs, inProgressMs } = computeKitchenInfo(order ?? undefined)

  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Order progress — Table {order?.table}</DialogTitle></DialogHeader>
        {order && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Status</span><p><StatusBadge status={order.status} /></p></div>
              <div><span className="text-muted-foreground">Placed</span><p className="font-medium">{new Date(order.createdAt).toLocaleString()}</p></div>
            </div>
            <div className="flex flex-col gap-1">
              {order.items.map((item) => (
                <div key={item.id} className={`flex items-center justify-between ${item.isVoided ? 'text-muted-foreground line-through' : ''}`}>
                  <span>{item.menuItem.name} ×{item.quantity}</span>
                  <span className="text-muted-foreground">{rwf(item.priceAtSale * item.quantity)}</span>
                </div>
              ))}
            </div>
            {order.status !== 'pending' && (
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
                <div><span className="text-muted-foreground">Started by kitchen</span><p className="font-medium">{sentToKitchenAt ? new Date(sentToKitchenAt).toLocaleString() : '—'}</p></div>
                <div><span className="text-muted-foreground">Working on it</span><p className="font-medium">{preparedByNames.length ? preparedByNames.join(', ') : 'Not yet picked up'}</p></div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">{kitchenDurationMs != null ? 'Time taken' : 'Time so far'}</span>
                  <p className="font-medium">
                    {kitchenDurationMs != null
                      ? formatDuration(kitchenDurationMs)
                      : inProgressMs != null
                        ? formatDuration(inProgressMs)
                        : '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {order && (
            <Link href={`/waiter/orders/${order.id}`}><Button>Open order</Button></Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function WaiterOrdersPage() {
  const router = useRouter()
  const [showHistory, setShowHistory] = useState(false)
  const [progressOrder, setProgressOrder] = useState<Order | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  // /api/orders is force-scoped server-side to orders this waiter created —
  // there's no "all orders" view for this role, only active vs. full history.
  const { data: orders = [], isLoading } = useOrders()
  const updateStatus = useUpdateOrderStatus()

  const visible = showHistory ? orders : orders.filter((o) => !['paid', 'cancelled'].includes(o.status))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Orders"
        description={showHistory ? 'Every order you have created' : 'Active orders'}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowHistory((v) => !v)}>
              {showHistory ? 'Show active' : 'Show history'}
            </Button>
            <Link href="/waiter/orders/new"><Button>New order</Button></Link>
          </div>
        }
      />
      <ProductionOrdersQueue assignedRole="waiter" />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              message={showHistory ? 'You have not created any orders yet.' : 'No active orders.'}
              action={{ label: 'New order', onClick: () => router.push('/waiter/orders/new') }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((o) => {
                  const total = o.items.filter((i) => !i.isVoided).reduce((s, i) => s + i.priceAtSale * i.quantity, 0)
                  return (
                    <TableRow key={o.id} className="hover:bg-accent">
                      <TableCell className="font-medium">
                        <Link href={`/waiter/orders/${o.id}`} className="hover:underline">{o.table}</Link>
                      </TableCell>
                      <TableCell>{o.items.length}</TableCell>
                      <TableCell>{rwf(total)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {o.discountPercent ? `${o.discountPercent}%` : o.discountAmount ? rwf(o.discountAmount) : '—'}
                      </TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{minutesAgo(o.createdAt)}m ago</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!['pending', 'paid', 'cancelled'].includes(o.status) && (
                            <Button size="sm" variant="ghost" onClick={() => setProgressOrder(o)}>
                              <Info className="mr-1 h-3.5 w-3.5" />Progress
                            </Button>
                          )}
                          {(o.status === 'ready' || o.status === 'served') && (
                            <Link href={`/waiter/payments/${o.id}`}>
                              <Button size="sm">Pay</Button>
                            </Link>
                          )}
                          {o.status === 'paid' && (
                            <Link href={`/waiter/payments/${o.id}`}>
                              <Button size="sm" variant="outline">Receipt</Button>
                            </Link>
                          )}
                          {o.status === 'pending' && (
                            <Button size="sm" variant="destructive" onClick={() => setCancelTarget(o)}>
                              <Ban className="mr-1 h-3.5 w-3.5" />Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <OrderProgressDialog order={progressOrder} onClose={() => setProgressOrder(null)} />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order — Table {cancelTarget?.table}?</AlertDialogTitle>
            <AlertDialogDescription>
              This order hasn&apos;t been started by the kitchen yet. Cancelling it can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={updateStatus.isPending}
              onClick={() => {
                if (!cancelTarget) return
                updateStatus.mutate({ id: cancelTarget.id, status: 'cancelled' })
                setCancelTarget(null)
              }}
            >
              Cancel order
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
