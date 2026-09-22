'use client'

import { useState } from 'react'
import { Boxes, Loader2, PencilLine, Check, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
  useStockRequisitions, useApproveStockRequisition, useRejectStockRequisition,
  type StockRequisition, type StockLocation,
} from '@/lib/api/stock-requisitions'
import { useLocationStockProjection, useAdjustLocationStock, type LocationStockProjection } from '@/lib/api/location-stock'

const LOCATION_LABEL: Record<StockLocation, string> = { kitchen: 'Kitchen', bar: 'Bar' }

function ReviewDialog({ requisition, onClose }: { requisition: StockRequisition | null; onClose: () => void }) {
  const approveMutation = useApproveStockRequisition()
  const rejectMutation = useRejectStockRequisition()
  const [approvedQty, setApprovedQty] = useState<Record<string, number>>({})
  const [reviewNotes, setReviewNotes] = useState('')

  // "Adjusting state during render" (React's recommended pattern for
  // resetting state on prop change) rather than an effect — keyed on the id
  // so switching straight from one pending requisition's Review button to
  // another's, without closing the dialog in between, still reseeds instead
  // of showing stale line items.
  const [seededForId, setSeededForId] = useState<string | null>(null)
  if ((requisition?.id ?? null) !== seededForId) {
    setSeededForId(requisition?.id ?? null)
    if (requisition && requisition.status === 'pending') {
      const defaults: Record<string, number> = {}
      requisition.items.forEach((item) => { defaults[item.id] = item.quantityRequested })
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

  const isPending = requisition?.status === 'pending'
  const isSubmitting = approveMutation.isPending || rejectMutation.isPending

  return (
    <Dialog open={!!requisition} onOpenChange={(o) => { if (!o) { setApprovedQty({}); onClose() } }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
            </div>

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_90px_90px_90px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Item</span>
                <span className="text-right">Requested</span>
                <span className="text-right">{isPending ? 'Approve' : 'Approved'}</span>
                <span className="text-right">Received</span>
              </div>
              {requisition.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_90px_90px_90px] gap-2 items-center">
                  <span className="text-sm">{item.inventoryItem.name} <span className="text-muted-foreground">({item.inventoryItem.unit})</span></span>
                  <span className="text-right text-sm">{item.quantityRequested}</span>
                  {isPending ? (
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
              ))}
            </div>

            {isPending && (
              <div className="flex flex-col gap-1.5">
                <Label>Review notes <span className="text-muted-foreground">(required to send back)</span></Label>
                <Input placeholder="Reason, or a note on what's being sent" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setApprovedQty({}); onClose() }}>Close</Button>
          {isPending && (
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

export default function AdminRequisitionsPage() {
  const [reviewTarget, setReviewTarget] = useState<StockRequisition | null>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const { data: requisitions = [], isLoading } = useStockRequisitions()
  const { data: projection = [], isLoading: projectionLoading } = useLocationStockProjection()

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
                    <TableCell className="font-medium">{LOCATION_LABEL[req.location]}</TableCell>
                    <TableCell>{req.items.length}</TableCell>
                    <TableCell><StatusBadge status={req.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{req.requestedBy.name}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(req.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {req.status === 'pending' && <Button size="sm" onClick={(e) => { e.stopPropagation(); setReviewTarget(req) }}>Review</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ReviewDialog requisition={reviewTarget} onClose={() => setReviewTarget(null)} />
      <AdjustDialog items={projection} open={adjustOpen} onClose={() => setAdjustOpen(false)} />
    </div>
  )
}
