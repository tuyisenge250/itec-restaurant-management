'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, ClipboardList, Trash2, Loader2, PackageCheck, RotateCcw, History, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
  usePurchaseOrders, usePurchaseOrder, useCreatePurchaseOrder, useReceivePurchaseOrder,
  useUpdatePurchaseOrderStatus, useReorderPurchaseOrder, useRecordSupplierPayment, type PurchaseOrder,
} from '@/lib/api/purchase-orders'
import { useSuppliers } from '@/lib/api/suppliers'
import { useInventory } from '@/lib/api/inventory'
import { createPurchaseOrderSchema } from '@/lib/validation/purchase-order.schema'
import { rwf } from '@/lib/utils'
import type { z } from 'zod'

type CreateFormValues = z.infer<typeof createPurchaseOrderSchema>
// expiresAt is a plain yyyy-mm-dd string here (from a date input) — converted
// to a Date only when building the request payload.
type ReceiveLine = { quantity: number; costingMethod: 'fifo' | 'lifo' | ''; expiresAt: string }

const ACTION_LABELS: Record<string, string> = {
  'purchase_order.pending_approval': 'Submitted for approval',
  'purchase_order.approved': 'Approved',
  'purchase_order.cancelled': 'Cancelled',
  'purchase_order.goods_received': 'Goods received',
  'supplier_payment.recorded': 'Payment recorded',
}

const PAYABLE_STATUSES: PurchaseOrder['status'][] = ['ordered', 'received']

function PurchaseOrderDetailDialog({ poId, onClose }: { poId: string | null; onClose: () => void }) {
  const { data: po, isLoading } = usePurchaseOrder(poId ?? undefined)
  const recordPayment = useRecordSupplierPayment()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'card' | 'momo' | 'other'>('cash')
  const [notes, setNotes] = useState('')

  // Owed is derived from what was actually RECEIVED (the real invoiced
  // value), never what was ordered — you don't owe for goods still in
  // transit or never delivered.
  const receivedValue = po?.goodsReceipts.reduce(
    (s, gr) => s + gr.lines.reduce((s2, l) => s2 + l.quantityReceived * l.unitCost, 0), 0
  ) ?? 0
  const paidValue = po?.payments.reduce((s, p) => s + p.amount, 0) ?? 0
  const owed = receivedValue - paidValue
  const canPay = !!po && PAYABLE_STATUSES.includes(po.status)

  function resetPaymentForm() {
    setPaymentOpen(false)
    setAmount('')
    setMethod('cash')
    setNotes('')
  }

  async function submitPayment() {
    if (!po || !amount) return
    await recordPayment.mutateAsync({ id: po.id, data: { amount: parseFloat(amount), method, notes: notes || undefined } })
    resetPaymentForm()
  }

  return (
    <Dialog open={!!poId} onOpenChange={(o) => { if (!o) { resetPaymentForm(); onClose() } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Purchase order detail</DialogTitle></DialogHeader>
        {isLoading || !po ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Supplier</span><p className="font-medium">{po.supplier.name}</p></div>
              <div><span className="text-muted-foreground">Status</span><p><StatusBadge status={po.status} /></p></div>
              <div><span className="text-muted-foreground">Created by</span><p className="font-medium">{po.createdBy.name} · {new Date(po.createdAt).toLocaleString()}</p></div>
              <div>
                <span className="text-muted-foreground">Approved by</span>
                <p className="font-medium">{po.approvedBy ? `${po.approvedBy.name} · ${new Date(po.approvedAt!).toLocaleString()}` : '—'}</p>
              </div>
              {po.reorderedFrom && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Reordered from</span>
                  <p className="font-medium">PO #{po.reorderedFrom.id.slice(0, 8)} ({new Date(po.reorderedFrom.createdAt).toLocaleDateString()})</p>
                </div>
              )}
              {po.notes && (
                <div className="col-span-2"><span className="text-muted-foreground">Notes</span><p>{po.notes}</p></div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Line items</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.inventoryItem.name}</TableCell>
                      <TableCell className="text-right">{item.quantityOrdered} {item.inventoryItem.unit}</TableCell>
                      <TableCell className="text-right">{item.quantityReceived} {item.inventoryItem.unit}</TableCell>
                      <TableCell className="text-right">{rwf(item.unitCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {po.goodsReceipts.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Goods receipts</p>
                <div className="flex flex-col gap-2">
                  {po.goodsReceipts.map((gr) => (
                    <div key={gr.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Received by <span className="font-medium text-foreground">{gr.receivedBy.name}</span></span>
                        <span>{new Date(gr.receivedAt).toLocaleString()}</span>
                      </div>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {gr.lines.map((line) => (
                          <li key={line.id} className="flex justify-between">
                            <span>{line.purchaseOrderItem.inventoryItem.name} · {line.costingMethod.toUpperCase()}</span>
                            <span>{line.quantityReceived} {line.purchaseOrderItem.inventoryItem.unit} @ {rwf(line.unitCost)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(canPay || po.payments.length > 0) && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-medium"><Wallet className="h-3.5 w-3.5" />Payments to supplier</p>
                  {canPay && !paymentOpen && (
                    <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>Record payment</Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 rounded-md border border-border p-3 text-sm">
                  <div><span className="text-muted-foreground">Received value</span><p className="font-medium">{rwf(receivedValue)}</p></div>
                  <div><span className="text-muted-foreground">Paid</span><p className="font-medium">{rwf(paidValue)}</p></div>
                  <div>
                    <span className="text-muted-foreground">{owed > 0 ? 'Owed' : 'Credit'}</span>
                    <p className={`font-medium ${owed > 0 ? 'text-destructive' : 'text-success'}`}>{rwf(Math.abs(owed))}</p>
                  </div>
                </div>

                {paymentOpen && (
                  <div className="mt-2 flex flex-col gap-2 rounded-md border border-border p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1.5">
                        <Label>Amount</Label>
                        <Input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Method</Label>
                        <Select value={method} onValueChange={(v) => v && setMethod(v as typeof method)}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="momo">Mobile money</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={resetPaymentForm}>Cancel</Button>
                      <Button size="sm" disabled={!amount || recordPayment.isPending} onClick={submitPayment}>
                        {recordPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save payment
                      </Button>
                    </div>
                  </div>
                )}

                {po.payments.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {po.payments.map((p) => (
                      <li key={p.id} className="flex justify-between text-sm">
                        <span>
                          {rwf(p.amount)} · {p.method === 'momo' ? 'Mobile money' : p.method[0].toUpperCase() + p.method.slice(1)} by{' '}
                          <span className="font-medium">{p.recordedBy.name}</span>{p.notes ? ` — ${p.notes}` : ''}
                        </span>
                        <span className="text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><History className="h-3.5 w-3.5" />History</p>
              {po.auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {po.auditLog.map((entry) => (
                    <li key={entry.id} className="flex justify-between text-sm">
                      <span>
                        {ACTION_LABELS[entry.action] ?? entry.action} by <span className="font-medium">{entry.user?.name ?? 'Unknown'}</span>
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

export default function PurchaseOrdersPage() {
  const [newOpen, setNewOpen] = useState(false)
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null)
  const [receiveLines, setReceiveLines] = useState<Record<string, ReceiveLine>>({})
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data: pos = [], isLoading } = usePurchaseOrders()
  const { data: suppliers = [] } = useSuppliers()
  const { data: inventory = [] } = useInventory()
  const createMutation = useCreatePurchaseOrder()
  const receiveMutation = useReceivePurchaseOrder()
  const statusMutation = useUpdatePurchaseOrderStatus()
  const reorderMutation = useReorderPurchaseOrder()

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<CreateFormValues>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: { items: [{ inventoryItemId: '', quantityOrdered: 1, unitCost: 0 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  async function onCreateSubmit(values: CreateFormValues) {
    await createMutation.mutateAsync(values)
    reset()
    setNewOpen(false)
  }

  function openReceive(po: PurchaseOrder) {
    setReceivePO(po)
    const defaults: Record<string, ReceiveLine> = {}
    po.items.forEach((item) => {
      defaults[item.id] = { quantity: item.quantityOrdered - item.quantityReceived, costingMethod: '', expiresAt: '' }
    })
    setReceiveLines(defaults)
  }

  const allLinesReady = receivePO?.items.every((item) => {
    const line = receiveLines[item.id]
    return !line || line.quantity <= 0 || !!line.costingMethod
  }) ?? false

  async function onReceive() {
    if (!receivePO) return
    const items = receivePO.items
      .filter((item) => (receiveLines[item.id]?.quantity ?? 0) > 0)
      .map((item) => ({
        purchaseOrderItemId: item.id,
        quantityReceived: receiveLines[item.id].quantity,
        costingMethod: receiveLines[item.id].costingMethod as 'fifo' | 'lifo',
        expiresAt: receiveLines[item.id].expiresAt ? new Date(receiveLines[item.id].expiresAt) : undefined,
      }))
    if (items.length === 0) return
    await receiveMutation.mutateAsync({ id: receivePO.id, data: { items } })
    setReceivePO(null)
    setReceiveLines({})
  }

  function statusActions(po: PurchaseOrder) {
    switch (po.status) {
      case 'draft':
        return (
          <>
            <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: po.id, data: { status: 'pending_approval' } })}>
              Submit for approval
            </Button>
            <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: po.id, data: { status: 'cancelled' } })}>Cancel</Button>
          </>
        )
      case 'pending_approval':
        return (
          <>
            <Button size="sm" onClick={() => statusMutation.mutate({ id: po.id, data: { status: 'ordered' } })}>Approve</Button>
            <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: po.id, data: { status: 'cancelled' } })}>Cancel</Button>
          </>
        )
      case 'ordered':
        return (
          <>
            <Button size="sm" variant="outline" onClick={() => openReceive(po)}>
              <PackageCheck className="mr-1 h-4 w-4" />Receive stock
            </Button>
            <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: po.id, data: { status: 'cancelled' } })}>Cancel</Button>
          </>
        )
      case 'received':
      case 'cancelled':
        return (
          <Button size="sm" variant="outline" onClick={() => reorderMutation.mutate(po.id)} disabled={reorderMutation.isPending}>
            <RotateCcw className="mr-1 h-4 w-4" />Reorder
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Purchase Orders" description="Track procurement from suppliers"
        action={<Button onClick={() => setNewOpen(true)}><Plus className="mr-2 h-4 w-4" />New purchase order</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : pos.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No purchase orders yet." action={{ label: 'New purchase order', onClick: () => setNewOpen(true) }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total cost</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pos.map((po) => {
                  const totalCost = po.items.reduce((s, i) => s + i.quantityOrdered * i.unitCost, 0)
                  return (
                    <TableRow key={po.id} className="hover:bg-accent cursor-pointer" onClick={() => setDetailId(po.id)}>
                      <TableCell className="font-medium">{po.supplier.name}</TableCell>
                      <TableCell><StatusBadge status={po.status} /></TableCell>
                      <TableCell>{po.items.length}</TableCell>
                      <TableCell>{rwf(totalCost)}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(po.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>{statusActions(po)}</div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (!o) reset() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onCreateSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label>Supplier</Label>
              <Select value={watch('supplierId') || null} onValueChange={(v) => v && setValue('supplierId', v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.supplierId && <p className="text-xs text-destructive">{errors.supplierId.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => append({ inventoryItemId: '', quantityOrdered: 1, unitCost: 0 })}>
                  <Plus className="h-3 w-3 mr-1" />Add item
                </Button>
              </div>
              {fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-start">
                  <div>
                    <Select
                      value={watch(`items.${i}.inventoryItemId`) || null}
                      onValueChange={(v) => v && setValue(`items.${i}.inventoryItemId`, v)}
                    >
                      <SelectTrigger className="w-full"><SelectValue placeholder="Item" /></SelectTrigger>
                      <SelectContent>
                        {inventory.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errors.items?.[i]?.inventoryItemId && <p className="text-xs text-destructive">{errors.items[i].inventoryItemId?.message}</p>}
                  </div>
                  <div>
                    <Input type="number" placeholder="Qty" {...register(`items.${i}.quantityOrdered`, { valueAsNumber: true })} />
                    {errors.items?.[i]?.quantityOrdered && <p className="text-xs text-destructive">{errors.items[i].quantityOrdered?.message}</p>}
                  </div>
                  <div>
                    <Input type="number" placeholder="Cost" step="0.01" {...register(`items.${i}.unitCost`, { valueAsNumber: true })} />
                    {errors.items?.[i]?.unitCost && <p className="text-xs text-destructive">{errors.items[i].unitCost?.message}</p>}
                  </div>
                  <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setNewOpen(false); reset() }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save as draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={!!receivePO} onOpenChange={(o) => { if (!o) { setReceivePO(null); setReceiveLines({}) } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receive Stock — {receivePO?.supplier.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            This closes the purchase order immediately. Whatever quantities you confirm here are final — there's no second receiving round for what's left over.
          </p>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[1fr_100px_110px_130px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Item</span>
              <span className="text-right">Qty to receive</span>
              <span>Costing method</span>
              <span>Expires (optional)</span>
            </div>
            {receivePO?.items.map((item) => {
              const remaining = item.quantityOrdered - item.quantityReceived
              const line = receiveLines[item.id] ?? { quantity: remaining, costingMethod: '', expiresAt: '' }
              return (
                <div key={item.id} className="grid grid-cols-[1fr_100px_110px_130px] gap-2 items-center">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{item.inventoryItem.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Ordered: {item.quantityOrdered} {item.inventoryItem.unit} · Already received: {item.quantityReceived}
                    </span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={remaining}
                    value={line.quantity}
                    onChange={(e) => {
                      const quantity = Math.min(Number(e.target.value), remaining)
                      setReceiveLines((prev) => ({ ...prev, [item.id]: { ...line, quantity } }))
                    }}
                  />
                  <Select
                    value={line.costingMethod || null}
                    onValueChange={(v) => setReceiveLines((prev) => ({ ...prev, [item.id]: { ...line, costingMethod: (v as 'fifo' | 'lifo') ?? '' } }))}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Required" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fifo">FIFO</SelectItem>
                      <SelectItem value="lifo">LIFO</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={line.expiresAt}
                    onChange={(e) => setReceiveLines((prev) => ({ ...prev, [item.id]: { ...line, expiresAt: e.target.value } }))}
                  />
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReceivePO(null); setReceiveLines({}) }}>Cancel</Button>
            <Button onClick={onReceive} disabled={receiveMutation.isPending || !allLinesReady}>
              {receiveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PurchaseOrderDetailDialog poId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
