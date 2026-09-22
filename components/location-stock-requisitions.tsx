'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, Loader2, PackageCheck, Ban, Boxes } from 'lucide-react'
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
  useStockRequisitions, useCreateStockRequisition, useCancelStockRequisition, useReceiveStockRequisition,
  type StockRequisition, type StockLocation, type CreateRequisitionInput,
} from '@/lib/api/stock-requisitions'
import { useLocationStockProjection } from '@/lib/api/location-stock'
import { useInventory } from '@/lib/api/inventory'
import { createRequisitionSchema } from '@/lib/validation/stock-requisition.schema'

type ReceiveLine = { quantity: number }

const LOCATION_LABEL: Record<StockLocation, string> = { kitchen: 'Kitchen', bar: 'Bar' }
const DEFAULT_ITEMS = [{ inventoryItemId: '', quantityRequested: 1 }]

// Shared by /kitchen/requisitions and /cashier/requisitions — same mechanics
// as ProductionOrdersQueue being shared by role, just for requesting stock
// from main instead of a production batch.
export function LocationStockRequisitions({ location }: { location: StockLocation }) {
  const [newOpen, setNewOpen] = useState(false)
  const [receiveTarget, setReceiveTarget] = useState<StockRequisition | null>(null)
  const [receiveLines, setReceiveLines] = useState<Record<string, ReceiveLine>>({})

  const { data: requisitions = [], isLoading } = useStockRequisitions({ location })
  const { data: projection = [] } = useLocationStockProjection()
  const { data: inventory = [] } = useInventory()
  const createMutation = useCreateStockRequisition()
  const cancelMutation = useCancelStockRequisition()
  const receiveMutation = useReceiveStockRequisition()

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<CreateRequisitionInput>({
    resolver: zodResolver(createRequisitionSchema),
    defaultValues: { location, items: DEFAULT_ITEMS },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  async function onCreateSubmit(values: CreateRequisitionInput) {
    await createMutation.mutateAsync(values)
    reset({ location, items: DEFAULT_ITEMS })
    setNewOpen(false)
  }

  function openReceive(req: StockRequisition) {
    setReceiveTarget(req)
    const defaults: Record<string, ReceiveLine> = {}
    req.items.forEach((item) => { defaults[item.id] = { quantity: item.quantityApproved ?? 0 } })
    setReceiveLines(defaults)
  }

  async function onReceive() {
    if (!receiveTarget) return
    const items = receiveTarget.items.map((item) => ({
      itemId: item.id,
      quantityReceived: receiveLines[item.id]?.quantity ?? 0,
    }))
    await receiveMutation.mutateAsync({ id: receiveTarget.id, data: { items } })
    setReceiveTarget(null)
    setReceiveLines({})
  }

  const myStock = projection
    .map((p) => ({ id: p.id, name: p.name, unit: p.unit, quantity: location === 'kitchen' ? p.kitchen : p.bar }))
    .filter((p) => p.quantity > 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${LOCATION_LABEL[location]} Stock`}
        description="Stock on hand at this location, and requests to main stock"
        action={<Button onClick={() => setNewOpen(true)}><Plus className="mr-2 h-4 w-4" />New requisition</Button>}
      />

      <Card>
        <CardContent className="p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Boxes className="h-3.5 w-3.5" />Stock on hand</p>
          {myStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing recorded at this location yet — request stock from main below.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Item</TableHead><TableHead className="text-right">Quantity</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {myStock.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{item.quantity.toFixed(2)} {item.unit}</TableCell>
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
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : requisitions.length === 0 ? (
            <EmptyState icon={Boxes} message="No requisitions yet." action={{ label: 'New requisition', onClick: () => setNewOpen(true) }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        {req.items.map((item) => (
                          <span key={item.id} className="text-sm">
                            {item.inventoryItem.name} — {item.quantityRequested} {item.inventoryItem.unit}
                          </span>
                        ))}
                        {req.notes && <span className="text-xs text-muted-foreground">{req.notes}</span>}
                        {req.status === 'rejected' && req.reviewNotes && (
                          <span className="text-xs text-destructive">Sent back: {req.reviewNotes}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={req.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{req.requestedBy.name}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(req.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {req.status === 'pending' && (
                          <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate(req.id)}>
                            <Ban className="mr-1 h-3.5 w-3.5" />Cancel
                          </Button>
                        )}
                        {req.status === 'approved' && (
                          <Button size="sm" onClick={() => openReceive(req)}>
                            <PackageCheck className="mr-1 h-3.5 w-3.5" />Confirm receipt
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New requisition dialog */}
      <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (!o) reset({ location, items: DEFAULT_ITEMS }) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Requisition — {LOCATION_LABEL[location]}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onCreateSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => append({ inventoryItemId: '', quantityRequested: 1 })}>
                  <Plus className="h-3 w-3 mr-1" />Add item
                </Button>
              </div>
              {fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-[1fr_90px_32px] gap-2 items-start">
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
                    {errors.items?.[i]?.inventoryItemId && <p className="text-xs text-destructive">{errors.items[i]?.inventoryItemId?.message}</p>}
                  </div>
                  <div>
                    <Input type="number" step="0.01" placeholder="Qty" {...register(`items.${i}.quantityRequested`, { valueAsNumber: true })} />
                    {errors.items?.[i]?.quantityRequested && <p className="text-xs text-destructive">{errors.items[i]?.quantityRequested?.message}</p>}
                  </div>
                  <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Input placeholder="What it's for, urgency, etc." {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setNewOpen(false); reset({ location, items: DEFAULT_ITEMS }) }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive dialog */}
      <Dialog open={!!receiveTarget} onOpenChange={(o) => { if (!o) { setReceiveTarget(null); setReceiveLines({}) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Confirm receipt</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[1fr_110px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Item</span>
              <span className="text-right">Qty received</span>
            </div>
            {receiveTarget?.items.map((item) => {
              const approved = item.quantityApproved ?? 0
              const line = receiveLines[item.id] ?? { quantity: approved }
              return (
                <div key={item.id} className="grid grid-cols-[1fr_110px] gap-2 items-center">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{item.inventoryItem.name}</span>
                    <span className="text-xs text-muted-foreground">Approved: {approved} {item.inventoryItem.unit}</span>
                  </div>
                  <Input
                    type="number" min={0} step="0.01" value={line.quantity}
                    onChange={(e) => setReceiveLines((prev) => ({ ...prev, [item.id]: { quantity: Number(e.target.value) } }))}
                  />
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReceiveTarget(null); setReceiveLines({}) }}>Cancel</Button>
            <Button onClick={onReceive} disabled={receiveMutation.isPending}>
              {receiveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
