'use client'

import { useState } from 'react'
import { AlertTriangle, Receipt, Ban, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { useOrders, useMarkOrderItemReady, useVoidOrderItem, type Order } from '@/lib/api/orders'
import { ApiError } from '@/lib/api/client'
import { rwf } from '@/lib/utils'

type ColStatus = 'pending' | 'ready'

const columns: { status: ColStatus; label: string; color: string }[] = [
  { status: 'pending', label: 'To confirm', color: 'bg-muted text-muted-foreground' },
  { status: 'ready',   label: 'Confirmed — awaiting hand-off', color: 'bg-success text-success-foreground' },
]

function minutesAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

// One card per order, but only the direct-serve items relevant to the
// column being rendered — an order with 3 drinks can have 1 confirmed and
// 2 still waiting, showing up in both columns at once.
function OrderCard({
  order, colStatus, stockError, onConfirm, onVoid, isConfirming,
}: {
  order: Order
  colStatus: ColStatus
  stockError: { orderItemId: string; message: string } | null
  onConfirm: (orderItemId: string) => void
  onVoid: (item: { orderItemId: string; name: string }) => void
  isConfirming: boolean
}) {
  const items = order.items.filter((i) => !i.isVoided && i.status === colStatus)
  if (items.length === 0) return null
  const orderHasStockError = items.some((i) => i.id === stockError?.orderItemId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">Table {order.table}</span>
          <span className="text-xs text-muted-foreground">Waiter: {order.createdBy.name}</span>
        </div>
        <span className="text-xs text-muted-foreground">{minutesAgo(order.createdAt)}m ago</span>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {orderHasStockError && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle />
            <AlertDescription>Can&apos;t confirm: {stockError?.message}</AlertDescription>
          </Alert>
        )}
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm">
              <span>{item.menuItem.name} <span className="font-medium">×{item.quantity}</span> · {rwf(item.priceAtSale * item.quantity)}</span>
              <div className="flex items-center gap-2">
                {colStatus === 'pending' ? (
                  <Button size="sm" disabled={isConfirming} onClick={() => onConfirm(item.id)}>Confirm</Button>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />Confirmed
                    </span>
                    <button
                      onClick={() => onVoid({ orderItemId: item.id, name: item.menuItem.name })}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Void item"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// Direct-serve items skip the "preparing" stage kitchen items go through —
// there's nothing to cook, just a checkpoint — so this is a 2-column board
// (pending -> confirmed) instead of kitchen's 3. Confirmed items stay
// visible (not served yet) so a mistaken confirmation can still be voided
// before the waiter hands it over.
export default function CashierQueuePage() {
  const { data: orders = [], isLoading } = useOrders({ refetchInterval: 5000, filters: { view: 'cashier' } })
  const markReady = useMarkOrderItemReady()
  const voidItem = useVoidOrderItem()

  const [stockError, setStockError] = useState<{ orderItemId: string; message: string } | null>(null)
  const [voidTarget, setVoidTarget] = useState<{ orderItemId: string; name: string } | null>(null)
  const [voidReason, setVoidReason] = useState('')

  function confirmItem(orderItemId: string) {
    setStockError(null)
    markReady.mutate(orderItemId, {
      onError: (err) => {
        if (err instanceof ApiError && err.code === 'INSUFFICIENT_STOCK') {
          setStockError({ orderItemId, message: err.message })
        }
      },
    })
  }

  function confirmVoid() {
    if (!voidTarget || !voidReason.trim()) return
    voidItem.mutate(
      { orderItemId: voidTarget.orderItemId, data: { voidReason } },
      { onSuccess: () => { setVoidTarget(null); setVoidReason('') } }
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="To Confirm" description="Direct-serve items waiting on you" />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {columns.map((col) => {
            const colOrders = orders.filter((o) => o.items.some((i) => !i.isVoided && i.status === col.status))
            return (
              <div key={col.status} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Badge className={col.color}>{col.label}</Badge>
                  <span className="text-sm text-muted-foreground">{colOrders.length}</span>
                </div>
                {colOrders.length === 0 ? (
                  <EmptyState icon={Receipt} message={`Nothing ${col.status === 'pending' ? 'waiting' : 'confirmed'}`} />
                ) : (
                  colOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      colStatus={col.status}
                      stockError={stockError}
                      onConfirm={confirmItem}
                      onVoid={setVoidTarget}
                      isConfirming={markReady.isPending}
                    />
                  ))
                )}
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!voidTarget} onOpenChange={(o) => { if (!o) { setVoidTarget(null); setVoidReason('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void {voidTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Stock was already deducted for this item — voiding will restore it to inventory. A reason is required.
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
