'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard, Plus, Minus, X, Split, Merge, Percent, Ban, ChefHat, Zap, Check } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  useOrder, useOrders, useUpdateOrderItems,
  useSplitOrder, useMergeOrder, useApplyOrderDiscount, useUpdateOrderStatus, useServeOrderItem,
  type Order,
} from '@/lib/api/orders'
import { useMenu } from '@/lib/api/menu'
import { useCurrentUser } from '@/lib/api/auth'
import { DISCOUNT_CAPS } from '@/lib/rbac'
import { computeKitchenInfo, formatDuration } from '@/lib/kitchen-timing'
import { rwf, menuItemLabel } from '@/lib/utils'

// A prep item locks once it's been sent to the kitchen; a direct-serve item
// locks the moment cashier has confirmed it (stock already drawn) — either
// way it can no longer be edited or removed from the waiter side, only
// voided by whoever fulfilled it (kitchen or cashier).
function isItemLocked(item: Order['items'][number]) {
  return item.requiresPreparation ? item.sentToKitchenAt !== null : item.status !== 'pending'
}

// Every item — prep or direct-serve — is servable only once it's 'ready':
// kitchen confirms a prep item, cashier confirms a direct-serve one. The
// waiter is never the one who fulfills an item, only the one who hands it
// over once someone else has.
function isItemServable(item: Order['items'][number]) {
  return item.status === 'ready'
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: order, isLoading } = useOrder(id)
  const { data: menuItems = [] } = useMenu()
  const { data: allOrders = [] } = useOrders()
  const { data: me } = useCurrentUser()

  const updateItems = useUpdateOrderItems()
  const splitOrder = useSplitOrder()
  const mergeOrder = useMergeOrder()
  const applyDiscount = useApplyOrderDiscount()
  const updateStatus = useUpdateOrderStatus()
  const serveItem = useServeOrderItem()

  const [addMenuItemId, setAddMenuItemId] = useState('')
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitQuantities, setSplitQuantities] = useState<Record<string, number>>({})
  const [mergeOpen, setMergeOpen] = useState(false)
  const [targetOrderId, setTargetOrderId] = useState('')
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)

  if (isLoading) return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  if (!order) return <p className="text-muted-foreground">Order not found.</p>

  const activeItems = order.items.filter((i) => !i.isVoided)
  const total = activeItems.reduce((s, i) => s + i.priceAtSale * i.quantity, 0)
  const isPending = order.status === 'pending'
  const hasPrepItems = order.items.some((i) => i.requiresPreparation)
  const cap = me ? DISCOUNT_CAPS[me.role] : 0
  const { preparedByNames, sentToKitchenAt, kitchenDurationMs, inProgressMs } = computeKitchenInfo(order)

  const eligibleMergeTargets = allOrders.filter(
    (o) => o.id !== order.id && o.table === order.table && !['payment_pending', 'paid', 'cancelled'].includes(o.status)
  )

  function setSplitQty(itemId: string, qty: number, max: number) {
    const clamped = Math.max(0, Math.min(Math.floor(qty) || 0, max))
    setSplitQuantities((prev) => ({ ...prev, [itemId]: clamped }))
  }

  const totalActiveQty = activeItems.reduce((s, i) => s + i.quantity, 0)
  const selectedQty = activeItems.reduce((s, i) => s + (splitQuantities[i.id] ?? 0), 0)
  const selectedTotal = activeItems.reduce((s, i) => s + (splitQuantities[i.id] ?? 0) * i.priceAtSale, 0)
  const remainingTotal = total - selectedTotal

  async function handleAddItem() {
    if (!addMenuItemId || !order) return
    await updateItems.mutateAsync({ id: order.id, data: { add: [{ menuItemId: addMenuItemId, quantity: 1 }], removeItemIds: [] } })
    setAddMenuItemId('')
  }

  async function handleRemoveItem(orderItemId: string) {
    if (!order) return
    await updateItems.mutateAsync({ id: order.id, data: { add: [], removeItemIds: [orderItemId] } })
  }

  // The API only ever takes add/remove, not an in-place quantity update —
  // while pending, nothing's been prepared yet, so swapping the row for one
  // with the new quantity is equivalent and needs no new endpoint.
  async function handleChangeQty(item: { id: string; menuItemId: string; quantity: number }, delta: number) {
    if (!order) return
    const newQty = item.quantity + delta
    if (newQty <= 0) { await handleRemoveItem(item.id); return }
    await updateItems.mutateAsync({
      id: order.id,
      data: { add: [{ menuItemId: item.menuItemId, quantity: newQty }], removeItemIds: [item.id] },
    })
  }

  async function handleSplit() {
    if (!order) return
    const items = activeItems
      .map((i) => ({ orderItemId: i.id, quantity: splitQuantities[i.id] ?? 0 }))
      .filter((i) => i.quantity > 0)
    await splitOrder.mutateAsync({ id: order.id, data: { items } })
    setSplitOpen(false)
    setSplitQuantities({})
  }

  async function handleMerge() {
    if (!order || !targetOrderId) return
    await mergeOrder.mutateAsync({ id: order.id, data: { targetOrderId } })
    setMergeOpen(false)
  }

  async function handleApplyDiscount() {
    if (!order) return
    const pct = parseFloat(discountPercent) || 0
    await applyDiscount.mutateAsync({ id: order.id, data: { discountPercent: pct, discountReason } })
    setDiscountOpen(false)
  }

  async function handleCancel() {
    if (!order) return
    await updateStatus.mutateAsync({ id: order.id, status: 'cancelled' })
    setCancelOpen(false)
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/waiter/orders">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <PageHeader
          title={`Table ${order.table}`}
          description={`#${order.id.slice(0, 8)} · ${new Date(order.createdAt).toLocaleString()}`}
        />
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Items</CardTitle>
          <StatusBadge status={order.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pb-4">
          {order.items.map((item) => {
            const locked = item.isVoided || isItemLocked(item)
            const servable = !item.isVoided && isItemServable(item)
            return (
            <div key={item.id} className="flex flex-col gap-1">
              <div className={`flex items-center justify-between text-sm ${item.isVoided ? 'text-muted-foreground line-through' : ''}`}>
                <span className="flex items-center gap-2">
                  {item.requiresPreparation
                    ? <ChefHat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    : <Zap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  {item.menuItem.name}
                  {item.menuItem.variantLabel && <span className="text-muted-foreground"> · {item.menuItem.variantLabel}</span>}
                  {!locked ? (
                    <span className="flex items-center gap-1">
                      <button
                        onClick={() => handleChangeQty(item, -1)}
                        disabled={updateItems.isPending}
                        className="flex h-5 w-5 items-center justify-center rounded border border-border hover:bg-accent"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-4 text-center text-muted-foreground">{item.quantity}</span>
                      <button
                        onClick={() => handleChangeQty(item, 1)}
                        disabled={updateItems.isPending}
                        className="flex h-5 w-5 items-center justify-center rounded border border-border hover:bg-accent"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">×{item.quantity}</span>
                  )}
                  {!item.isVoided && <StatusBadge status={item.status} />}
                </span>
                <div className="flex items-center gap-2">
                  <span>{rwf(item.priceAtSale * item.quantity)}</span>
                  {servable && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={serveItem.isPending}
                      onClick={() => serveItem.mutate(item.id)}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />Serve
                    </Button>
                  )}
                  {!locked && !item.isVoided && (
                    <button onClick={() => handleRemoveItem(item.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {item.isVoided && (
                <p className="text-xs text-destructive">
                  Voided{item.voidReason ? ` — ${item.voidReason}` : ''}
                  {item.voidedAt ? ` · ${new Date(item.voidedAt).toLocaleString()}` : ''}
                </p>
              )}
            </div>
            )
          })}

          {!['payment_pending', 'paid', 'cancelled'].includes(order.status) && (
            <div className="mt-2 flex gap-2">
              <Select value={addMenuItemId || null} onValueChange={(v) => setAddMenuItemId(v ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Add another item" /></SelectTrigger>
                <SelectContent>
                  {menuItems.filter((m) => m.isAvailable).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name} — {rwf(m.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="icon" variant="outline" disabled={!addMenuItemId || updateItems.isPending} onClick={handleAddItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Separator className="my-1" />
          {order.discountReason && (
            <div className="flex justify-between text-sm text-success">
              <span>Discount ({order.discountPercent}%)</span>
              <span>−{rwf((order.discountPercent ?? 0) / 100 * total)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{rwf(order.discountPercent ? total * (1 - order.discountPercent / 100) : total)}</span>
          </div>
        </CardContent>
      </Card>

      {hasPrepItems && sentToKitchenAt && !['payment_pending', 'paid', 'cancelled'].includes(order.status) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Kitchen</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1.5 pb-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Started by kitchen</span>
              <span>{sentToKitchenAt ? new Date(sentToKitchenAt).toLocaleString() : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Working on it</span>
              <span>{preparedByNames.length ? preparedByNames.join(', ') : 'Not yet picked up'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{kitchenDurationMs != null ? 'Time taken' : 'Time so far'}</span>
              <span>
                {kitchenDurationMs != null
                  ? formatDuration(kitchenDurationMs)
                  : inProgressMs != null
                    ? formatDuration(inProgressMs)
                    : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {hasPrepItems && !sentToKitchenAt && order.status !== 'cancelled' && (
        <p className="rounded-md border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
          Waiting for kitchen to start the kitchen items on this order — you can keep editing it until then.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {!['payment_pending', 'paid', 'cancelled'].includes(order.status) && (
          <>
            <Button variant="outline" onClick={() => setSplitOpen(true)}><Split className="mr-2 h-4 w-4" />Split</Button>
            <Button variant="outline" onClick={() => setMergeOpen(true)}><Merge className="mr-2 h-4 w-4" />Merge</Button>
            <Button variant="outline" className="col-span-2" onClick={() => setDiscountOpen(true)}>
              <Percent className="mr-2 h-4 w-4" />{order.discountReason ? 'Update discount' : 'Apply discount'}
            </Button>
          </>
        )}
        {(order.status === 'ready' || order.status === 'served') && (
          <Link href={`/waiter/payments/${order.id}`} className="col-span-2">
            <Button className="w-full"><CreditCard className="mr-2 h-4 w-4" />Record payment</Button>
          </Link>
        )}
        {(order.status === 'payment_pending' || order.status === 'paid') && (
          <Link href={`/waiter/payments/${order.id}`} className="col-span-2">
            <Button variant="outline" className="w-full"><CreditCard className="mr-2 h-4 w-4" />View receipt</Button>
          </Link>
        )}
        {isPending && (
          <Button variant="destructive" className="col-span-2" onClick={() => setCancelOpen(true)}>
            <Ban className="mr-2 h-4 w-4" />Cancel order
          </Button>
        )}
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This order hasn&apos;t been started by the kitchen yet. Cancelling it can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <Button variant="destructive" disabled={updateStatus.isPending} onClick={handleCancel}>
              Cancel order
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Split dialog */}
      <Dialog open={splitOpen} onOpenChange={(o) => { setSplitOpen(o); if (!o) setSplitQuantities({}) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Split order</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Choose how many of each item move to a new order — a line ordered ×3 can send just 1.
          </p>
          <div className="flex flex-col gap-2">
            {activeItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span>{menuItemLabel(item.menuItem.name, item.menuItem.variantLabel)} <span className="text-muted-foreground">(of {item.quantity})</span></span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={item.quantity}
                    className="w-16"
                    value={splitQuantities[item.id] ?? 0}
                    onChange={(e) => setSplitQty(item.id, parseInt(e.target.value, 10), item.quantity)}
                  />
                  <span className="w-20 text-right text-muted-foreground">
                    {rwf((splitQuantities[item.id] ?? 0) * item.priceAtSale)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm">
            <span>New order: {rwf(selectedTotal)}</span>
            <span>Remaining here: {rwf(remainingTotal)}</span>
          </div>
          {selectedQty > 0 && selectedQty >= totalActiveQty && (
            <p className="text-xs text-destructive">Can&apos;t move everything — at least one item must remain on this order.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitOpen(false)}>Cancel</Button>
            <Button
              disabled={selectedQty === 0 || selectedQty >= totalActiveQty || splitOrder.isPending}
              onClick={handleSplit}
            >
              Split
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Merge into another order</DialogTitle></DialogHeader>
          {eligibleMergeTargets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other open orders on table {order.table} to merge into.</p>
          ) : (
            <>
              <Select value={targetOrderId || null} onValueChange={(v) => setTargetOrderId(v ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select target order" /></SelectTrigger>
                <SelectContent>
                  {eligibleMergeTargets.map((o) => (
                    <SelectItem key={o.id} value={o.id}>#{o.id.slice(0, 8)} · {o.items.length} items</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {targetOrderId && (
                <p className="text-sm text-muted-foreground">
                  This order&apos;s {activeItems.length} item(s) will move onto the selected order, and this order will be cancelled.
                </p>
              )}
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button disabled={!targetOrderId || mergeOrder.isPending} onClick={handleMerge}>Merge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount dialog */}
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply discount</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Your role can apply up to {cap}%.</p>
          <div className="flex flex-col gap-1.5">
            <Label>Discount %</Label>
            <Input type="number" max={cap} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Reason</Label>
            <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="e.g. loyalty discount" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountOpen(false)}>Cancel</Button>
            <Button disabled={!discountReason.trim() || applyDiscount.isPending} onClick={handleApplyDiscount}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
