'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard, Send, Plus, X, Split, Merge, Percent, Loader2 } from 'lucide-react'
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
  useOrder, useOrders, useUpdateOrderItems, useSendOrderToKitchen,
  useSplitOrder, useMergeOrder, useApplyOrderDiscount,
} from '@/lib/api/orders'
import { useMenu } from '@/lib/api/menu'
import { useCurrentUser } from '@/lib/api/auth'
import { DISCOUNT_CAPS } from '@/lib/rbac'
import { rwf } from '@/lib/utils'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: order, isLoading } = useOrder(id)
  const { data: menuItems = [] } = useMenu()
  const { data: allOrders = [] } = useOrders()
  const { data: me } = useCurrentUser()

  const updateItems = useUpdateOrderItems()
  const sendToKitchen = useSendOrderToKitchen()
  const splitOrder = useSplitOrder()
  const mergeOrder = useMergeOrder()
  const applyDiscount = useApplyOrderDiscount()

  const [addMenuItemId, setAddMenuItemId] = useState('')
  const [splitOpen, setSplitOpen] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [mergeOpen, setMergeOpen] = useState(false)
  const [targetOrderId, setTargetOrderId] = useState('')
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountReason, setDiscountReason] = useState('')

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
  const cap = me ? DISCOUNT_CAPS[me.role] : 0

  const eligibleMergeTargets = allOrders.filter(
    (o) => o.id !== order.id && o.table === order.table && !['paid', 'cancelled'].includes(o.status)
  )

  function toggleSelected(itemId: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const selectedTotal = activeItems.filter((i) => selectedItemIds.has(i.id)).reduce((s, i) => s + i.priceAtSale * i.quantity, 0)
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

  async function handleSplit() {
    if (!order) return
    await splitOrder.mutateAsync({ id: order.id, data: { itemIds: Array.from(selectedItemIds) } })
    setSplitOpen(false)
    setSelectedItemIds(new Set())
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
          {order.items.map((item) => (
            <div key={item.id} className={`flex items-center justify-between text-sm ${item.isVoided ? 'text-muted-foreground line-through' : ''}`}>
              <span>{item.menuItem.name} <span className="text-muted-foreground">×{item.quantity}</span></span>
              <div className="flex items-center gap-2">
                <span>{rwf(item.priceAtSale * item.quantity)}</span>
                {isPending && !item.isVoided && (
                  <button onClick={() => handleRemoveItem(item.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {isPending ? (
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
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Sent to kitchen — ask kitchen to void an item if it needs to change.
            </p>
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

      <div className="grid grid-cols-2 gap-2">
        {isPending && (
          <Button className="col-span-2" disabled={activeItems.length === 0 || sendToKitchen.isPending} onClick={() => sendToKitchen.mutate(order.id)}>
            {sendToKitchen.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send to kitchen
          </Button>
        )}
        {!['paid', 'cancelled'].includes(order.status) && (
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
      </div>

      {/* Split dialog */}
      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Split order</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Select the items to move to a new order.</p>
          <div className="flex flex-col gap-2">
            {activeItems.map((item) => (
              <label key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedItemIds.has(item.id)} onChange={() => toggleSelected(item.id)} />
                  {item.menuItem.name} ×{item.quantity}
                </span>
                <span>{rwf(item.priceAtSale * item.quantity)}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-between text-sm">
            <span>New order: {rwf(selectedTotal)}</span>
            <span>Remaining here: {rwf(remainingTotal)}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitOpen(false)}>Cancel</Button>
            <Button disabled={selectedItemIds.size === 0 || splitOrder.isPending} onClick={handleSplit}>Split</Button>
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
