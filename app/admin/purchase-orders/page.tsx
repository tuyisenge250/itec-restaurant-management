'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, ClipboardList, Trash2, Loader2, PackageCheck } from 'lucide-react'
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
import { usePurchaseOrders, useCreatePurchaseOrder, useReceivePurchaseOrder, type PurchaseOrder } from '@/lib/api/purchase-orders'
import { useSuppliers } from '@/lib/api/suppliers'
import { useInventory } from '@/lib/api/inventory'
import { createPurchaseOrderSchema } from '@/lib/validation/purchase-order.schema'
import type { z } from 'zod'

type CreateFormValues = z.infer<typeof createPurchaseOrderSchema>

export default function PurchaseOrdersPage() {
  const [newOpen, setNewOpen] = useState(false)
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null)
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({})

  const { data: pos = [], isLoading } = usePurchaseOrders()
  const { data: suppliers = [] } = useSuppliers()
  const { data: inventory = [] } = useInventory()
  const createMutation = useCreatePurchaseOrder()
  const receiveMutation = useReceivePurchaseOrder()

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<CreateFormValues>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: { items: [{ inventoryItemId: '', quantityOrdered: 1, unitCost: 0 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  async function onCreateSubmit(values: CreateFormValues) {
    await createMutation.mutateAsync(values)
    reset()
    setNewOpen(false)
  }

  async function onReceive() {
    if (!receivePO) return
    const items = receivePO.items.map((item) => ({
      purchaseOrderItemId: item.id,
      quantityReceived: receiveQtys[item.id] ?? item.quantityOrdered - item.quantityReceived,
    }))
    await receiveMutation.mutateAsync({ id: receivePO.id, data: { items } })
    setReceivePO(null)
    setReceiveQtys({})
  }

  function openReceive(po: PurchaseOrder) {
    setReceivePO(po)
    // pre-fill with remaining qty for each item
    const defaults: Record<string, number> = {}
    po.items.forEach((item) => {
      defaults[item.id] = item.quantityOrdered - item.quantityReceived
    })
    setReceiveQtys(defaults)
  }

  const canReceive = (po: PurchaseOrder) =>
    po.status === 'ordered' || po.status === 'partially_received'

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
                    <TableRow key={po.id} className="hover:bg-accent">
                      <TableCell className="font-medium">{po.supplier.name}</TableCell>
                      <TableCell><StatusBadge status={po.status} /></TableCell>
                      <TableCell>{po.items.length}</TableCell>
                      <TableCell>${totalCost.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(po.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        {canReceive(po) && (
                          <Button size="sm" variant="outline" onClick={() => openReceive(po)}>
                            <PackageCheck className="mr-1 h-4 w-4" />
                            Receive stock
                          </Button>
                        )}
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
              <Select onValueChange={(v) => setValue('supplierId', v)}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
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
                    <Select onValueChange={(v) => setValue(`items.${i}.inventoryItemId`, v)}>
                      <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
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
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={!!receivePO} onOpenChange={(o) => { if (!o) { setReceivePO(null); setReceiveQtys({}) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive Stock — {receivePO?.supplier.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[1fr_120px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Item</span>
              <span className="text-right">Qty to receive</span>
            </div>
            {receivePO?.items.map((item) => {
              const remaining = item.quantityOrdered - item.quantityReceived
              return (
                <div key={item.id} className="grid grid-cols-[1fr_120px] gap-2 items-center">
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
                    value={receiveQtys[item.id] ?? remaining}
                    onChange={(e) => setReceiveQtys((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                  />
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReceivePO(null); setReceiveQtys({}) }}>Cancel</Button>
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
