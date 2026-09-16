'use client'

import { useState } from 'react'
import { Clock, ChefHat, AlertTriangle, Ban, Info, Boxes } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  useOrders, useOrderAuditLog, useUpdateOrderStatus, useVoidOrderItem, type Order, type OrderStatusTarget,
} from '@/lib/api/orders'
import { useCurrentUser } from '@/lib/api/auth'
import { useMenu } from '@/lib/api/menu'
import { useRecipe } from '@/lib/api/recipes'
import { useIngredientUsage, useInventory } from '@/lib/api/inventory'
import { ApiError } from '@/lib/api/client'
import { computeKitchenInfo, formatDuration } from '@/lib/kitchen-timing'
import { rwf } from '@/lib/utils'

type ColStatus = 'pending' | 'preparing' | 'ready'

const columns: { status: ColStatus; label: string; next: OrderStatusTarget; nextLabel: string; color: string }[] = [
  { status: 'pending',   label: 'Pending',   next: 'preparing', nextLabel: 'Start preparing', color: 'bg-muted text-muted-foreground' },
  { status: 'preparing', label: 'Preparing', next: 'ready',     nextLabel: 'Mark ready',       color: 'bg-warning text-warning-foreground' },
  { status: 'ready',     label: 'Ready',     next: 'served',    nextLabel: 'Mark served',      color: 'bg-success text-success-foreground' },
]

function minutesAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

// Per-item recipe breakdown: what's needed for THIS line (per-unit quantity
// × how many were ordered), fetched lazily only while the detail dialog for
// its order is open.
function OrderItemProcedure({ item, menuInfo }: {
  item: Order['items'][number]
  menuInfo: { price: number; categoryName: string } | undefined
}) {
  const { data: recipe, isLoading } = useRecipe(item.menuItemId)

  return (
    <div className={`rounded-md border border-border p-3 ${item.isVoided ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`font-medium ${item.isVoided ? 'line-through' : ''}`}>
          {item.menuItem.name} × {item.quantity}
        </span>
        {item.isVoided ? (
          <Badge variant="destructive">Voided</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            {menuInfo ? `${menuInfo.categoryName} · ${rwf(menuInfo.price)}` : ''}
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="mt-2 h-12 w-full" />
      ) : !recipe || recipe.ingredients.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No recipe defined for this item.</p>
      ) : (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Ingredient</TableHead>
              <TableHead className="text-right">Per unit</TableHead>
              <TableHead className="text-right">Needed for this order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipe.ingredients.map((ing) => (
              <TableRow key={ing.name}>
                <TableCell>{ing.name}</TableCell>
                <TableCell className="text-right text-muted-foreground">{ing.quantity} {ing.unit}</TableCell>
                <TableCell className="text-right font-medium">{(ing.quantity * item.quantity).toFixed(2)} {ing.unit}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function OrderDetailDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { data: menuItems = [] } = useMenu()
  const { data: auditData } = useOrderAuditLog(order?.id)
  const menuById = new Map(menuItems.map((m) => [m.id, { price: m.price, categoryName: m.category?.name ?? 'Uncategorized' }]))
  const { preparedByNames, sentToKitchenAt, kitchenDurationMs, inProgressMs } = computeKitchenInfo(order ?? undefined, auditData?.auditLog)

  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[85vh] w-full max-w-[95vw] overflow-y-auto sm:max-w-[60vw]">
        <DialogHeader><DialogTitle>Order detail — Table {order?.table}</DialogTitle></DialogHeader>
        {order && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><span className="text-muted-foreground">Waiter</span><p className="font-medium">{order.createdBy.name}</p></div>
              <div><span className="text-muted-foreground">Status</span><p><StatusBadge status={order.status} /></p></div>
              <div><span className="text-muted-foreground">Placed</span><p className="font-medium">{new Date(order.createdAt).toLocaleString()}</p></div>
              <div><span className="text-muted-foreground">Items</span><p className="font-medium">{order.items.length}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 text-sm sm:grid-cols-3">
              <div><span className="text-muted-foreground">Started by kitchen</span><p className="font-medium">{sentToKitchenAt ? new Date(sentToKitchenAt).toLocaleString() : '—'}</p></div>
              <div><span className="text-muted-foreground">Prepared by</span><p className="font-medium">{preparedByNames.length ? preparedByNames.join(', ') : 'Not yet picked up'}</p></div>
              <div>
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
            <div>
              <p className="mb-2 text-sm font-medium">Preparation procedure</p>
              <div className="flex flex-col gap-3">
                {order.items.map((item) => (
                  <OrderItemProcedure key={item.id} item={item} menuInfo={menuById.get(item.menuItemId)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function KitchenOrdersPage() {
  const { data: orders = [], isLoading } = useOrders({ refetchInterval: 5000 })
  const { data: me } = useCurrentUser()
  const updateStatus = useUpdateOrderStatus()
  const voidItem = useVoidOrderItem()

  const [stockError, setStockError] = useState<{ orderId: string; message: string } | null>(null)
  const [voidTarget, setVoidTarget] = useState<{ orderItemId: string; name: string } | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [usageDate, setUsageDate] = useState(toDateInput(new Date()))

  const { data: usage = [], isLoading: usageLoading } = useIngredientUsage(usageDate)
  const { data: inventory = [] } = useInventory()
  const lowStockDuringUsage = new Set(
    inventory.filter((i) => i.currentStock <= i.reorderLevel).map((i) => i.id)
  )

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
          <TabsTrigger value="usage">Ingredients used</TabsTrigger>
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
                      colOrders.map((order) => {
                        // Once someone has claimed this order (started it),
                        // only they or an admin can act on it further —
                        // other kitchen users can see it but the board
                        // disables their controls.
                        const claimedByOther = !!order.startedById && order.startedById !== me?.id
                        return (
                        <Card key={order.id}>
                          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">Table {order.table}</span>
                              <span className="text-xs text-muted-foreground">Waiter: {order.createdBy.name}</span>
                              {order.startedBy && (
                                <span className="text-xs text-muted-foreground">Started by: {order.startedBy.name}</span>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />{minutesAgo(order.createdAt)}m ago
                              </span>
                              <button
                                onClick={() => setDetailOrder(order)}
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Info className="h-3 w-3" />Details
                              </button>
                            </div>
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
                                    {!item.isVoided && col.status !== 'pending' && !claimedByOther && (
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
                              disabled={updateStatus.isPending || claimedByOther}
                              onClick={() => advance(order.id, col.next)}
                            >
                              {claimedByOther ? `Being handled by ${order.startedBy?.name}` : col.nextLabel}
                            </Button>
                          </CardContent>
                        </Card>
                        )
                      })
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
                <Card key={item.id} className="cursor-pointer hover:bg-accent" onClick={() => setDetailOrder(order)}>
                  <CardContent className="flex items-center justify-between p-4 text-sm">
                    <span className="flex items-center gap-2">
                      Table {order.table} · {item.menuItem.name} ×{item.quantity}
                      <StatusBadge status={order.status} />
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {new Date(item.preparedAt!).toLocaleString()}
                      <Info className="h-3.5 w-3.5" />
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="usage" className="mt-4 flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <Input type="date" className="w-44" value={usageDate} onChange={(e) => setUsageDate(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => setUsageDate(toDateInput(new Date()))}>Today</Button>
          </div>
          {usageLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : usage.length === 0 ? (
            <EmptyState icon={Boxes} message="No ingredients were consumed on this date." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead className="text-right">Total used</TableHead>
                      <TableHead>Current stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.map((u) => (
                      <TableRow key={u.inventoryItemId}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-right">{u.totalUsed.toFixed(2)} {u.unit}</TableCell>
                        <TableCell>
                          {lowStockDuringUsage.has(u.inventoryItemId) && <StatusBadge status="low_stock" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <OrderDetailDialog order={detailOrder} onClose={() => setDetailOrder(null)} />

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
