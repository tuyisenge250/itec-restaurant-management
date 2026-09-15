'use client'

import { Fragment, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes, Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight, History, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
  useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem,
  useInventoryLots, useInventoryTransactions, useAdjustStock, type InventoryItem,
} from '@/lib/api/inventory'
import { rwf } from '@/lib/utils'

const itemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  reorderLevel: z.coerce.number().nonnegative(),
})
type ItemFormValues = z.infer<typeof itemSchema>

const REASON_CODES = [
  { value: 'count_correction', label: 'Count correction' },
  { value: 'spoilage_found', label: 'Spoilage found late' },
  { value: 'data_entry_error', label: 'Data entry error' },
  { value: 'other', label: 'Other' },
]

function LotsPanel({ item }: { item: InventoryItem }) {
  const { data: lots = [], isLoading } = useInventoryLots(item.id)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [adjustLotId, setAdjustLotId] = useState('')
  const [adjustQty, setAdjustQty] = useState('')
  const [reasonCode, setReasonCode] = useState('')
  const [notes, setNotes] = useState('')
  const adjustStock = useAdjustStock()
  const { data: transactions = [], isLoading: txLoading } = useInventoryTransactions(ledgerOpen ? item.id : undefined)

  async function submitAdjustment() {
    await adjustStock.mutateAsync({ lotId: adjustLotId, quantity: parseFloat(adjustQty), reasonCode, notes: notes || undefined })
    setAdjustLotId(''); setAdjustQty(''); setReasonCode(''); setNotes('')
  }

  return (
    <TableRow>
      <TableCell colSpan={7} className="bg-muted/30 p-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Open lots (draw order)</span>
              <Button size="sm" variant="outline" onClick={() => setLedgerOpen(true)}><History className="mr-1 h-3.5 w-3.5" />Transaction ledger</Button>
            </div>
            {lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open lots for this item.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell><Badge variant={lot.costingMethod === 'lifo' ? 'default' : 'secondary'}>{lot.costingMethod.toUpperCase()}</Badge></TableCell>
                      <TableCell className="text-right">{lot.quantityRemaining.toFixed(2)} {item.unit}</TableCell>
                      <TableCell className="text-right">{rwf(lot.unitCost)}</TableCell>
                      <TableCell className="text-muted-foreground">{lot.supplier?.name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(lot.receivedAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
              <span className="flex items-center gap-1.5 text-sm font-medium"><SlidersHorizontal className="h-3.5 w-3.5" />Manual adjustment</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Select value={adjustLotId || null} onValueChange={(v) => setAdjustLotId(v ?? '')}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Lot" /></SelectTrigger>
                  <SelectContent>
                    {lots.map((lot) => (
                      <SelectItem key={lot.id} value={lot.id}>{lot.costingMethod.toUpperCase()} · {lot.quantityRemaining.toFixed(2)} left</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Qty (+/-)" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
                <Select value={reasonCode || null} onValueChange={(v) => setReasonCode(v ?? '')}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Reason code" /></SelectTrigger>
                  <SelectContent>
                    {REASON_CODES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!adjustLotId || !adjustQty || !reasonCode || adjustStock.isPending}
                  onClick={submitAdjustment}
                >
                  {adjustStock.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Apply
                </Button>
              </div>
              <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Transaction ledger — {item.name}</DialogTitle></DialogHeader>
            {txLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="capitalize">{t.type}{t.reasonCode ? ` (${t.reasonCode})` : ''}</TableCell>
                      <TableCell className="text-right">{t.quantity > 0 ? '+' : ''}{t.quantity.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{rwf(t.unitCost)}</TableCell>
                      <TableCell className="text-muted-foreground">{t.recordedBy.name}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  )
}

export default function InventoryPage() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)

  const { data: items = [], isLoading } = useInventory()
  const createMutation = useCreateInventoryItem()
  const updateMutation = useUpdateInventoryItem()
  const deleteMutation = useDeleteInventoryItem()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
  })

  function openEdit(item: InventoryItem) {
    setEditing(item)
    reset({ name: item.name, unit: item.unit, reorderLevel: item.reorderLevel })
    setOpen(true)
  }

  function openCreate() {
    setEditing(null)
    reset({ name: '', unit: '', reorderLevel: 0 })
    setOpen(true)
  }

  async function onSubmit(values: ItemFormValues) {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data: values })
    } else {
      await createMutation.mutateAsync(values)
    }
    reset()
    setOpen(false)
    setEditing(null)
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const totalValue = items.reduce((s, i) => s + i.stockValue, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory" description={`Current stock levels and costs · total value ${rwf(totalValue)}`}
        action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add item</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={Boxes} message="No inventory items yet." action={{ label: 'Add item', onClick: openCreate }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Item</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Current stock</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isOpen = expandedId === item.id
                  return (
                    <Fragment key={item.id}>
                      <TableRow className="hover:bg-accent cursor-pointer" onClick={() => setExpandedId(isOpen ? null : item.id)}>
                        <TableCell className="w-8">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                        <TableCell className="text-right">{item.currentStock.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{rwf(item.stockValue)}</TableCell>
                        <TableCell>
                          <StatusBadge status={item.currentStock <= item.reorderLevel ? 'low_stock' : 'active'} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(item)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isOpen && <LotsPanel item={item} />}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); reset() } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit item' : 'Add inventory item'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input placeholder="Flour" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Unit</Label>
              <Input placeholder="kg" {...register('unit')} />
              {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Reorder level</Label>
              <Input type="number" placeholder="10" {...register('reorderLevel')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); reset() }}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Update' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              If this item has any receiving or usage history, it will be deactivated instead of deleted
              so past records stay intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
