'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Boxes, Loader2, PencilLine, Check, X, ShoppingCart, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
  useStockRequisitions, useApproveStockRequisition, useRejectStockRequisition, useHoldStockRequisition,
  type StockRequisition, type StockLocation,
} from '@/lib/api/stock-requisitions'
import { useLocationStockProjection, useAdjustLocationStock, type LocationStockProjection } from '@/lib/api/location-stock'
import { useCreatePurchaseOrder } from '@/lib/api/purchase-orders'
import { useSuppliers } from '@/lib/api/suppliers'
import { useInventory } from '@/lib/api/inventory'
import { useCurrentUser } from '@/lib/api/auth'
import { createPurchaseOrderSchema } from '@/lib/validation/purchase-order.schema'
import { cn, formatPoNumber } from '@/lib/utils'
import type { z } from 'zod'

const LOCATION_LABEL: Record<StockLocation, string> = { kitchen: 'Kitchen', bar: 'Bar' }
const EPSILON = 1e-6

type CreatePOFormValues = z.infer<typeof createPurchaseOrderSchema>
// What's missing from Main to cover this requisition's approved quantities —
// the seed data for the "Create purchase order" shortcut below.
type ShortfallItem = { inventoryItemId: string; quantityOrdered: number }
// Carries which requisition(s) a shortfall came from alongside the items
// themselves, so the PO created from it can link back to them.
type PoDraft = { items: ShortfallItem[]; coveredRequisitionIds: string[] }

// Combines several pending requisitions into one shortfall list — sums
// requested quantity per item across all of them (not "approved", since
// none of these have been reviewed yet), then nets out current Main stock
// so the PO only covers what's actually missing, same shortfall logic as
// the single-requisition version above just aggregated across many.
function aggregateShortfall(requisitions: StockRequisition[], projection: LocationStockProjection[]): ShortfallItem[] {
  const mainStockById = new Map(projection.map((p) => [p.id, p.main]))
  const totalRequested = new Map<string, number>()
  for (const req of requisitions) {
    for (const item of req.items) {
      totalRequested.set(item.inventoryItemId, (totalRequested.get(item.inventoryItemId) ?? 0) + item.quantityRequested)
    }
  }
  const result: ShortfallItem[] = []
  for (const [inventoryItemId, requested] of totalRequested) {
    const shortfall = requested - (mainStockById.get(inventoryItemId) ?? 0)
    if (shortfall > EPSILON) result.push({ inventoryItemId, quantityOrdered: Math.round(shortfall * 100) / 100 })
  }
  return result
}

function ReviewDialog({
  requisition, onClose, projection, canCreatePO, onCreatePO,
}: {
  requisition: StockRequisition | null
  onClose: () => void
  projection: LocationStockProjection[]
  canCreatePO: boolean
  onCreatePO: (draft: PoDraft) => void
}) {
  const approveMutation = useApproveStockRequisition()
  const rejectMutation = useRejectStockRequisition()
  const holdMutation = useHoldStockRequisition()
  const [approvedQty, setApprovedQty] = useState<Record<string, number>>({})
  const [reviewNotes, setReviewNotes] = useState('')

  // pending = never looked at; on_hold = reviewed, blocked on Main stock, a
  // PO was created for it — both are still "awaiting a decision" and get
  // the same actionable UI (approve/reject/notes), just a different badge.
  const isActionable = requisition?.status === 'pending' || requisition?.status === 'on_hold'

  // "Adjusting state during render" (React's recommended pattern for
  // resetting state on prop change) rather than an effect — keyed on the id
  // so switching straight from one pending requisition's Review button to
  // another's, without closing the dialog in between, still reseeds instead
  // of showing stale line items.
  const [seededForId, setSeededForId] = useState<string | null>(null)
  if ((requisition?.id ?? null) !== seededForId) {
    setSeededForId(requisition?.id ?? null)
    if (requisition && isActionable) {
      const defaults: Record<string, number> = {}
      requisition.items.forEach((item) => { defaults[item.id] = item.quantityApproved ?? item.quantityRequested })
      setApprovedQty(defaults)
    } else {
      setApprovedQty({})
    }
    setReviewNotes('')
  }

  async function handleApprove() {
    if (!requisition) return
    const items = requisition.items.map((item) => ({ itemId: item.id, quantityApproved: approvedQty[item.id] ?? 0 }))
    await approveMutation.mutateAsync({ id: requisition.id, data: { items, reviewNotes: reviewNotes || undefined } })
    setApprovedQty({})
    onClose()
  }

  async function handleReject() {
    if (!requisition || !reviewNotes) return
    await rejectMutation.mutateAsync({ id: requisition.id, data: { reviewNotes } })
    setApprovedQty({})
    onClose()
  }

  // Marks it reviewed-but-blocked (pending -> on_hold) before handing off to
  // the PO dialog, so it doesn't just sit looking untouched while stock is
  // on order — already on_hold (e.g. reopened later) skips straight through.
  async function handleCreatePO() {
    if (!requisition) return
    if (requisition.status === 'pending') {
      await holdMutation.mutateAsync(requisition.id)
    }
    onCreatePO({ items: shortItems, coveredRequisitionIds: [requisition.id] })
  }

  const isSubmitting = approveMutation.isPending || rejectMutation.isPending || holdMutation.isPending

  const mainStockById = new Map(projection.map((p) => [p.id, p.main]))
  const shortItems: ShortfallItem[] = isActionable && requisition
    ? requisition.items.reduce<ShortfallItem[]>((acc, item) => {
        const approved = approvedQty[item.id] ?? 0
        const main = mainStockById.get(item.inventoryItemId) ?? 0
        const shortfall = approved - main
        if (shortfall > EPSILON) acc.push({ inventoryItemId: item.inventoryItemId, quantityOrdered: Math.round(shortfall * 100) / 100 })
        return acc
      }, [])
    : []

  return (
    <Dialog open={!!requisition} onOpenChange={(o) => { if (!o) { setApprovedQty({}); onClose() } }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{LOCATION_LABEL[requisition?.location ?? 'kitchen']} requisition — {requisition && <StatusBadge status={requisition.status} />}</DialogTitle>
        </DialogHeader>
        {requisition && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Requested by</span><p className="font-medium">{requisition.requestedBy.name}</p></div>
              <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(requisition.createdAt).toLocaleString()}</p></div>
              {requisition.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes</span><p>{requisition.notes}</p></div>}
              {requisition.reviewedBy && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Reviewed by</span>
                  <p className="font-medium">{requisition.reviewedBy.name} · {new Date(requisition.reviewedAt!).toLocaleString()}</p>
                  {requisition.reviewNotes && <p className="text-muted-foreground">{requisition.reviewNotes}</p>}
                </div>
              )}
              {requisition.receivedBy && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Received by</span>
                  <p className="font-medium">{requisition.receivedBy.name} · {new Date(requisition.receivedAt!).toLocaleString()}</p>
                </div>
              )}
              {requisition.linkedPurchaseOrder && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Covered by purchase order</span>
                  <p className="font-medium">
                    {formatPoNumber(requisition.linkedPurchaseOrder.poNumber, requisition.linkedPurchaseOrder.createdAt)}
                  </p>
                  {requisition.linkedPurchaseOrder.status === 'received' ? (
                    <p className="font-medium text-success">Stock has arrived — ready to approve</p>
                  ) : (
                    <p className="font-medium">
                      <StatusBadge status={requisition.linkedPurchaseOrder.status} /> — check Purchase Orders for details
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Item</span>
                <span className="text-right">Requested</span>
                {isActionable && <span className="text-right">Main stock</span>}
                <span className="text-right">{isActionable ? 'Approve' : 'Approved'}</span>
                <span className="text-right">Received</span>
              </div>
              {requisition.items.map((item) => {
                const main = mainStockById.get(item.inventoryItemId) ?? 0
                const approved = approvedQty[item.id] ?? 0
                const short = isActionable && approved - main > EPSILON
                return (
                  <div key={item.id} className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 items-center">
                    <span className="text-sm">{item.inventoryItem.name} <span className="text-muted-foreground">({item.inventoryItem.unit})</span></span>
                    <span className="text-right text-sm">{item.quantityRequested}</span>
                    {isActionable && (
                      <span className={cn('text-right text-sm', short && 'font-medium text-destructive')}>{main.toFixed(2)}</span>
                    )}
                    {isActionable ? (
                      <Input
                        type="number" min={0} step="0.01" className="h-8 text-right"
                        value={approvedQty[item.id] ?? 0}
                        onChange={(e) => setApprovedQty((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                      />
                    ) : (
                      <span className="text-right text-sm">{item.quantityApproved ?? '—'}</span>
                    )}
                    <span className="text-right text-sm">{item.quantityReceived ?? '—'}</span>
                  </div>
                )
              })}
            </div>

            {isActionable && shortItems.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 p-3">
                <p className="flex items-start gap-1.5 text-xs text-warning-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 translate-y-0.5" />
                  Main stock won&apos;t cover {shortItems.length === 1 ? 'this item' : `${shortItems.length} items`} at the quantities above — approving now will fail until it&apos;s restocked.
                </p>
                {canCreatePO && (
                  <Button type="button" size="sm" variant="outline" className="shrink-0" disabled={holdMutation.isPending} onClick={handleCreatePO}>
                    {holdMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="mr-1 h-3.5 w-3.5" />}
                    Create PO
                  </Button>
                )}
              </div>
            )}

            {isActionable && (
              <div className="flex flex-col gap-1.5">
                <Label>Review notes <span className="text-muted-foreground">(required to send back)</span></Label>
                <Input placeholder="Reason, or a note on what's being sent" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setApprovedQty({}); onClose() }}>Close</Button>
          {isActionable && (
            <>
              <Button variant="destructive" disabled={isSubmitting || !reviewNotes} onClick={handleReject}>
                {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <X className="mr-1 h-4 w-4" />Send back
              </Button>
              <Button disabled={isSubmitting} onClick={handleApprove}>
                {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Check className="mr-1 h-4 w-4" />Approve &amp; send
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdjustDialog({ items, open, onClose }: { items: LocationStockProjection[]; open: boolean; onClose: () => void }) {
  const adjustMutation = useAdjustLocationStock()
  const [inventoryItemId, setInventoryItemId] = useState('')
  const [location, setLocation] = useState<StockLocation>('kitchen')
  const [quantity, setQuantity] = useState('')
  const [reasonCode, setReasonCode] = useState('')
  const [notes, setNotes] = useState('')

  function reset() {
    setInventoryItemId('')
    setLocation('kitchen')
    setQuantity('')
    setReasonCode('')
    setNotes('')
  }

  async function handleSubmit() {
    if (!inventoryItemId || !quantity || !reasonCode) return
    await adjustMutation.mutateAsync({ inventoryItemId, location, quantity: parseFloat(quantity), reasonCode, notes: notes || undefined })
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Adjust location stock</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Item</Label>
            <Select value={inventoryItemId || null} onValueChange={(v) => v && setInventoryItemId(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select item" /></SelectTrigger>
              <SelectContent>
                {items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Location</Label>
            <Select value={location} onValueChange={(v) => v && setLocation(v as StockLocation)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Quantity <span className="text-muted-foreground">(signed — negative to correct down)</span></Label>
            <Input type="number" step="0.01" placeholder="e.g. -2 or 5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Reason code</Label>
            <Input placeholder="e.g. stock_count, breakage" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button disabled={!inventoryItemId || !quantity || !reasonCode || adjustMutation.isPending} onClick={handleSubmit}>
            {adjustMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Opened straight from a requisition's shortfall warning, pre-filled with
// exactly what Main is short of. Saves as an ordinary draft PO — same
// approval/order/receive lifecycle as one created from scratch, just without
// re-navigating to Purchase Orders and re-typing the items.
function CreatePoFromShortfallDialog({
  draft, open, onClose,
}: {
  draft: PoDraft
  open: boolean
  onClose: () => void
}) {
  const { items, coveredRequisitionIds } = draft
  const { data: suppliers = [] } = useSuppliers()
  const { data: inventory = [] } = useInventory()
  const createMutation = useCreatePurchaseOrder()

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<CreatePOFormValues>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: { supplierId: '', items: [{ inventoryItemId: '', quantityOrdered: 1, unitCost: 0 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  // Reseed whenever this opens with a new shortfall list — same "adjust
  // state during render" pattern as ReviewDialog above.
  const [seededFor, setSeededFor] = useState<ShortfallItem[] | null>(null)
  if (open && items !== seededFor) {
    setSeededFor(items)
    reset({
      supplierId: '',
      items: items.length > 0
        ? items.map((i) => ({ inventoryItemId: i.inventoryItemId, quantityOrdered: i.quantityOrdered, unitCost: 0 }))
        : [{ inventoryItemId: '', quantityOrdered: 1, unitCost: 0 }],
      coveredRequisitionIds,
    })
  }

  async function onSubmit(values: CreatePOFormValues) {
    await createMutation.mutateAsync(values)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create purchase order</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Pre-filled with what&apos;s short on Main stock. Pick a supplier and confirm cost, then save as draft.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save as draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminRequisitionsPage() {
  const [reviewTarget, setReviewTarget] = useState<StockRequisition | null>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [poDraft, setPoDraft] = useState<PoDraft | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data: requisitions = [], isLoading } = useStockRequisitions()
  const { data: projection = [], isLoading: projectionLoading } = useLocationStockProjection()
  const { data: me } = useCurrentUser()
  const canCreatePO = me?.role.permissions.includes('purchase_orders.manage') ?? false
  const holdMutation = useHoldStockRequisition()

  // Both still "awaiting a decision" and selectable for a combined PO —
  // same reasoning as ReviewDialog's isActionable above.
  const selectableRequisitions = requisitions.filter((r) => r.status === 'pending' || r.status === 'on_hold')
  const allSelectableSelected = selectableRequisitions.length > 0 && selectableRequisitions.every((r) => selectedIds.has(r.id))

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
  }

  function toggleSelectAllPending(checked: boolean) {
    setSelectedIds(checked ? new Set(selectableRequisitions.map((r) => r.id)) : new Set())
  }

  async function combineSelectedIntoPO() {
    const selected = requisitions.filter((r) => selectedIds.has(r.id))
    setSelectedIds(new Set())
    // Same "mark reviewed" step as the single-requisition shortcut, just for
    // every pending one in the batch at once — on_hold ones are skipped,
    // they're already marked.
    await Promise.all(
      selected.filter((r) => r.status === 'pending').map((r) => holdMutation.mutateAsync(r.id))
    )
    setPoDraft({ items: aggregateShortfall(selected, projection), coveredRequisitionIds: selected.map((r) => r.id) })
  }

  const combinedCount = selectedIds.size

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Stock Requisitions" description="Review kitchen/bar requests and manage location stock" />

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium"><Boxes className="h-3.5 w-3.5" />Stock level projection</p>
            <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}>
              <PencilLine className="mr-1 h-3.5 w-3.5" />Adjust
            </Button>
          </div>
          {projectionLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Main</TableHead>
                  <TableHead className="text-right">Kitchen</TableHead>
                  <TableHead className="text-right">Bar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projection.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{item.main.toFixed(2)} {item.unit}</TableCell>
                    <TableCell className="text-right">{item.kitchen.toFixed(2)} {item.unit}</TableCell>
                    <TableCell className="text-right">{item.bar.toFixed(2)} {item.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {canCreatePO && combinedCount > 0 && (
            <div className="flex items-center justify-between gap-3 border-b border-border bg-accent/60 px-4 py-2.5">
              <span className="text-sm font-medium">{combinedCount} requisition{combinedCount === 1 ? '' : 's'} selected</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                <Button size="sm" disabled={holdMutation.isPending} onClick={combineSelectedIntoPO}>
                  {holdMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="mr-1 h-3.5 w-3.5" />}
                  Combine into PO
                </Button>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : requisitions.length === 0 ? (
            <EmptyState icon={Boxes} message="No stock requisitions yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canCreatePO && (
                    <TableHead className="w-8">
                      <Checkbox
                        checked={allSelectableSelected}
                        disabled={selectableRequisitions.length === 0}
                        onCheckedChange={(checked) => toggleSelectAllPending(checked === true)}
                      />
                    </TableHead>
                  )}
                  <TableHead>Location</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.map((req) => (
                  <TableRow key={req.id} className="hover:bg-accent cursor-pointer" onClick={() => setReviewTarget(req)}>
                    {canCreatePO && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {(req.status === 'pending' || req.status === 'on_hold') && (
                          <Checkbox
                            checked={selectedIds.has(req.id)}
                            onCheckedChange={(checked) => toggleSelect(req.id, checked === true)}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{LOCATION_LABEL[req.location]}</TableCell>
                    <TableCell>{req.items.length}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={req.status} />
                        {req.status === 'on_hold' && req.linkedPurchaseOrder?.status === 'received' && (
                          <span className="text-xs font-medium text-success">stock arrived</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{req.requestedBy.name}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(req.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {(req.status === 'pending' || req.status === 'on_hold') && (
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); setReviewTarget(req) }}>Review</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ReviewDialog
        requisition={reviewTarget}
        onClose={() => setReviewTarget(null)}
        projection={projection}
        canCreatePO={canCreatePO}
        onCreatePO={(draft) => { setReviewTarget(null); setPoDraft(draft) }}
      />
      <AdjustDialog items={projection} open={adjustOpen} onClose={() => setAdjustOpen(false)} />
      <CreatePoFromShortfallDialog
        draft={poDraft ?? { items: [], coveredRequisitionIds: [] }}
        open={poDraft !== null}
        onClose={() => setPoDraft(null)}
      />
    </div>
  )
}
