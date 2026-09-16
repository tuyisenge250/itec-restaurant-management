'use client'

import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { ListOrdered, History, RotateCcw, Loader2, ChefHat, Check, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker } from '@/components/date-range-picker'
import { useOrders, useOrder, useOrderAuditLog, type Order, type OrderStatus } from '@/lib/api/orders'
import { useUsers } from '@/lib/api/users'
import {
  useRefundPayment, useRefundRequests, useApproveRefundRequest, useDenyRefundRequest, type RefundRequest,
} from '@/lib/api/payments'
import { computeKitchenInfo, formatDuration } from '@/lib/kitchen-timing'
import { rwf } from '@/lib/utils'

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'preparing', 'ready', 'served', 'paid', 'cancelled']

const ACTION_LABELS: Record<string, string> = {
  'order.created': 'Order created',
  'order.sent_to_kitchen': 'Sent to kitchen',
  'order.status_changed': 'Status changed',
  'order.discount_applied': 'Discount applied',
  'order.merged': 'Merged into another order',
  'order.split': 'Split into a new order',
  'order.created_from_split': 'Created from a split',
  'order_item.voided': 'Item voided',
  'payment.discount_applied': 'Payment discount applied',
  'payment.refunded': 'Payment refunded',
  'refund_request.created': 'Refund requested',
  'refund_request.approved': 'Refund request approved',
  'refund_request.denied': 'Refund request denied',
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

function orderTotal(order: Pick<Order, 'items'>) {
  return (order.items ?? []).filter((i) => !i.isVoided).reduce((s, i) => s + i.priceAtSale * i.quantity, 0)
}

function orderMargin(order: Pick<Order, 'items'>) {
  return (order.items ?? [])
    .filter((i) => !i.isVoided)
    .reduce((s, i) => s + (i.priceAtSale - i.costAtSale) * i.quantity, 0)
}

function RefundForm({ paymentId, maxRefundable }: { paymentId: string; maxRefundable: number }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const refund = useRefundPayment()

  if (maxRefundable <= 0) return null

  async function submit() {
    await refund.mutateAsync({ paymentId, data: { amount: parseFloat(amount), reason } })
    setAmount(''); setReason('')
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-2">
      <Input
        type="number"
        placeholder={`Amount (max ${maxRefundable.toFixed(2)})`}
        className="w-44"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Input placeholder="Reason" className="w-48" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button
        size="sm"
        variant="outline"
        disabled={!amount || !reason || parseFloat(amount) > maxRefundable || refund.isPending}
        onClick={submit}
      >
        {refund.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1 h-3.5 w-3.5" />}
        Refund
      </Button>
    </div>
  )
}

function OrderDetailDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { data: order, isLoading } = useOrder(orderId ?? undefined)
  const { data: auditData, isLoading: auditLoading } = useOrderAuditLog(orderId ?? undefined)
  const stockReversedIds = new Set(auditData?.stockReversedItemIds ?? [])

  const { preparedByNames, sentToKitchenAt, readyAt, kitchenDurationMs, inProgressMs } =
    computeKitchenInfo(order, auditData?.auditLog)

  return (
    <Dialog open={!!orderId} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[85vh] w-full max-w-[95vw] overflow-y-auto sm:max-w-[67vw]">
        <DialogHeader><DialogTitle>Order detail</DialogTitle></DialogHeader>
        {isLoading || !order ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><span className="text-muted-foreground">Table</span><p className="font-medium">{order.table}</p></div>
              <div><span className="text-muted-foreground">Status</span><p><StatusBadge status={order.status} /></p></div>
              <div><span className="text-muted-foreground">Waiter</span><p className="font-medium">{order.createdBy?.name ?? 'Unknown'}</p></div>
              <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(order.createdAt).toLocaleString()}</p></div>
              <div><span className="text-muted-foreground">Subtotal</span><p className="font-medium">{rwf(orderTotal(order))}</p></div>
              <div><span className="text-muted-foreground">Margin</span><p className="font-medium">{rwf(orderMargin(order))}</p></div>
              {(order.discountPercent || order.discountAmount) && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Discount</span>
                  <p className="font-medium">
                    {order.discountPercent ? `${order.discountPercent}%` : rwf(order.discountAmount!)}
                    {order.discountReason ? ` — ${order.discountReason}` : ''}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><ChefHat className="h-3.5 w-3.5" />Kitchen</p>
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 text-sm sm:grid-cols-4">
                <div><span className="text-muted-foreground">Prepared by</span><p className="font-medium">{preparedByNames.length ? preparedByNames.join(', ') : '—'}</p></div>
                <div><span className="text-muted-foreground">Started by kitchen</span><p className="font-medium">{sentToKitchenAt ? new Date(sentToKitchenAt).toLocaleString() : '—'}</p></div>
                <div><span className="text-muted-foreground">Ready at</span><p className="font-medium">{readyAt ? new Date(readyAt).toLocaleString() : '—'}</p></div>
                <div>
                  <span className="text-muted-foreground">Time taken</span>
                  <p className="font-medium">
                    {kitchenDurationMs != null
                      ? formatDuration(kitchenDurationMs)
                      : inProgressMs != null
                        ? `${formatDuration(inProgressMs)} so far`
                        : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Line items</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Void info</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(order.items ?? []).map((item) => (
                    <TableRow key={item.id} className={item.isVoided ? 'opacity-60' : undefined}>
                      <TableCell className={item.isVoided ? 'line-through' : undefined}>{item.menuItem?.name ?? 'Unknown item'}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{rwf(item.priceAtSale)}</TableCell>
                      <TableCell className="text-right">{rwf(item.costAtSale)}</TableCell>
                      <TableCell className="text-right">{rwf((item.priceAtSale - item.costAtSale) * item.quantity)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.isVoided ? (
                          <>
                            Voided by <span className="font-medium text-foreground">{item.voidedBy?.name ?? 'Unknown'}</span>
                            {item.voidReason ? ` — ${item.voidReason}` : ''}
                            <br />
                            {new Date(item.voidedAt!).toLocaleString()} ·{' '}
                            {stockReversedIds.has(item.id) ? 'stock reversed' : 'no stock to reverse'}
                          </>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Payments</p>
              {(order.payments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {(order.payments ?? []).map((p) => {
                    const refundedTotal = (p.refunds ?? []).reduce((s, r) => s + r.amount, 0)
                    const maxRefundable = p.amount - refundedTotal
                    return (
                      <div key={p.id} className="rounded-md border border-border p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="font-medium uppercase">{p.method}</span> · {rwf(p.amount)}
                            {p.discount > 0 ? ` (discount ${rwf(p.discount)})` : ''}
                          </span>
                          <span className="text-muted-foreground">
                            {p.recordedBy?.name ?? 'Unknown'} · {new Date(p.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {(p.refunds ?? []).length > 0 && (
                          <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                            {(p.refunds ?? []).map((r) => (
                              <li key={r.id} className="flex justify-between text-xs text-muted-foreground">
                                <span>
                                  Refunded {rwf(r.amount)} by <span className="font-medium text-foreground">{r.recordedBy?.name ?? 'Unknown'}</span>
                                  {r.reason ? ` — ${r.reason}` : ''}
                                </span>
                                <span>{new Date(r.createdAt).toLocaleString()}</span>
                              </li>
                            ))}
                            <li className="text-xs font-medium text-foreground">
                              Cumulative refunded: {rwf(refundedTotal)} of {rwf(p.amount)}
                            </li>
                          </ul>
                        )}
                        {(p.refundRequests ?? []).filter((r) => r.status === 'pending').map((r) => (
                          <div key={r.id} className="mt-2 flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                            <p>
                              Refund request: {rwf(r.amount)} by <span className="font-medium">{r.requestedBy.name}</span>
                              {r.reason ? ` — ${r.reason}` : ''}
                            </p>
                            <RefundRequestActions request={r} />
                          </div>
                        ))}
                        {(() => {
                          const lastDenied = (p.refundRequests ?? []).find((r) => r.status === 'denied')
                          return lastDenied ? (
                            <p className="mt-2 text-xs text-destructive">
                              Last refund request denied{lastDenied.denialReason ? ` — ${lastDenied.denialReason}` : ''}
                              {lastDenied.reviewedBy ? ` (by ${lastDenied.reviewedBy.name})` : ''}
                            </p>
                          ) : null
                        })()}
                        <RefundForm paymentId={p.id} maxRefundable={maxRefundable} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><History className="h-3.5 w-3.5" />History</p>
              {auditLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : !auditData || auditData.auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {auditData.auditLog.map((entry) => (
                    <li key={entry.id} className="flex justify-between text-sm">
                      <span>
                        {ACTION_LABELS[entry.action] ?? entry.action} by{' '}
                        <span className="font-medium">{entry.user?.name ?? 'Unknown'}</span>
                      </span>
                      <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Shared by the global "pending requests" panel and the per-order payments
// list, so approving/denying works identically wherever an admin spots one.
function RefundRequestActions({ request }: { request: RefundRequest }) {
  const approve = useApproveRefundRequest()
  const deny = useDenyRefundRequest()
  const [denying, setDenying] = useState(false)
  const [denyReason, setDenyReason] = useState('')

  if (denying) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Denial reason (optional)"
          className="w-56"
          value={denyReason}
          onChange={(e) => setDenyReason(e.target.value)}
        />
        <Button
          size="sm"
          variant="destructive"
          disabled={deny.isPending}
          onClick={() =>
            deny.mutate(
              { id: request.id, data: { denialReason: denyReason || undefined } },
              { onSuccess: () => { setDenying(false); setDenyReason('') } }
            )
          }
        >
          Confirm deny
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setDenying(false); setDenyReason('') }}>Cancel</Button>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(request.id)}>
        {approve.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
        Approve
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDenying(true)}>
        <X className="mr-1 h-3.5 w-3.5" />Deny
      </Button>
    </div>
  )
}

function RefundRequestsPanel() {
  const { data: requests = [], isLoading } = useRefundRequests('pending')

  if (isLoading || requests.length === 0) return null

  return (
    <Card className="border-warning/40">
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <RotateCcw className="h-3.5 w-3.5" />
          Pending refund requests ({requests.length})
        </p>
        {requests.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Table {r.payment.order.table} · <span className="uppercase">{r.payment.method}</span> · requested {rwf(r.amount)} by{' '}
                <span className="font-medium">{r.requestedBy.name}</span>
              </span>
              <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-muted-foreground">Reason: {r.reason}</p>
            <RefundRequestActions request={r} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function AdminOrdersPage() {
  const [status, setStatus] = useState('all')
  const [table, setTable] = useState('')
  const [waiterId, setWaiterId] = useState('all')
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data: users = [] } = useUsers()
  const waiters = users.filter((u) => u.role === 'waiter')

  const { data: orders = [], isLoading } = useOrders({
    filters: {
      status: status === 'all' ? undefined : status,
      table: table || undefined,
      waiterId: waiterId === 'all' ? undefined : waiterId,
      from: range?.from ? toDateInput(range.from) : undefined,
      to: range?.to ? toDateInput(range.to) : undefined,
    },
  })

  function clearFilters() {
    setStatus('all'); setTable(''); setWaiterId('all'); setRange(undefined)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Orders" description="Every order across all waiters and tables" />

      <RefundRequestsPanel />

      <Card>
        <CardContent className="flex flex-row flex-wrap items-end gap-3 p-4">
          <Select value={status} onValueChange={(v) => setStatus(v ?? 'all')}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Table" className="w-32" value={table} onChange={(e) => setTable(e.target.value)} />
          <Select value={waiterId} onValueChange={(v) => setWaiterId(v ?? 'all')}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Waiter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All waiters</SelectItem>
              {waiters.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateRangePicker value={range} onChange={setRange} label="Date range" />
          <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : orders.length === 0 ? (
            <EmptyState icon={ListOrdered} message="No orders match these filters." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead>Waiter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-accent" onClick={() => setDetailId(o.id)}>
                    <TableCell className="font-medium">{o.table}</TableCell>
                    <TableCell>{o.createdBy?.name ?? 'Unknown'}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="text-right">{(o.items ?? []).length}</TableCell>
                    <TableCell className="text-right">{rwf(orderTotal(o))}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.discountPercent ? `${o.discountPercent}%` : o.discountAmount ? rwf(o.discountAmount) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <OrderDetailDialog orderId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
