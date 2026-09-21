'use client'

import { useState } from 'react'
import { CreditCard, Loader2, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useOrders, useOrder, useConfirmOrderPayment, type Order } from '@/lib/api/orders'
import { rwf, menuItemLabel } from '@/lib/utils'

function ConfirmPaymentDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { data: detail, isLoading } = useOrder(order?.id)
  const confirm = useConfirmOrderPayment()

  function handleConfirm() {
    if (!order) return
    confirm.mutate(order.id, { onSuccess: onClose })
  }

  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirm payment — Table {order?.table}</DialogTitle></DialogHeader>
        {isLoading || !detail?.createdBy ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Waiter <span className="font-medium text-foreground">{detail.createdBy.name}</span> collected this
              already — verify against the till, then confirm.
            </p>
            <div className="flex flex-col gap-1 text-sm">
              {detail.items.filter((i) => !i.isVoided).map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.menuItem ? menuItemLabel(item.menuItem.name, item.menuItem.variantLabel) : 'Unknown item'} ×{item.quantity}</span>
                  <span>{rwf(item.priceAtSale * item.quantity)}</span>
                </div>
              ))}
              <Separator className="my-1" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Payments recorded</span>
                {detail.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="capitalize">{p.method}</span>
                    <span>
                      {rwf(p.amount)}
                      <span className="ml-1.5 text-xs text-muted-foreground">by {p.recordedBy?.name ?? 'Unknown'}</span>
                    </span>
                  </div>
                ))}
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Total collected</span>
                <span>{rwf(detail.payments.reduce((s, p) => s + p.amount, 0))}</span>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button disabled={isLoading || confirm.isPending} onClick={handleConfirm}>
            {confirm.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Confirm received
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Cashier's reconciliation queue — orders the waiter has already fully
// collected payment on (and already handed the customer a receipt for),
// waiting for cashier to verify and close them out as actually paid.
export default function CashierPaymentsPage() {
  const { data: orders = [], isLoading } = useOrders({ filters: { status: 'payment_pending' } })
  const [target, setTarget] = useState<Order | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payments" description="Confirm payments waiters have already collected" />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : orders.length === 0 ? (
            <EmptyState icon={CreditCard} message="Nothing waiting on confirmation." />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {orders.map((o) => {
                const total = o.items.filter((i) => !i.isVoided).reduce((s, i) => s + i.priceAtSale * i.quantity, 0)
                return (
                  <div key={o.id} className="flex items-center justify-between p-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">Table {o.table}</span>
                      <span className="text-xs text-muted-foreground">Waiter: {o.createdBy.name} · {rwf(total)}</span>
                    </div>
                    <Button size="sm" onClick={() => setTarget(o)}>Review &amp; confirm</Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmPaymentDialog order={target} onClose={() => setTarget(null)} />
    </div>
  )
}
