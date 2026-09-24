'use client'

import { Fragment, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes, Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight, History, SlidersHorizontal, ChefHat, AlertTriangle } from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
  useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem,
  useInventoryLots, useInventoryTransactions, useAdjustStock, useAdjustLotPrice, useProducible,
  type InventoryItem, type InventoryItemType, type InventoryTransaction,
} from '@/lib/api/inventory'
import { useLocationStockProjection } from '@/lib/api/location-stock'
import { useCreateMenuItem } from '@/lib/api/menu'
import { useMenuCategories } from '@/lib/api/menu-categories'
import { rwf } from '@/lib/utils'

const itemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  itemType: z.enum(['raw', 'prepared', 'finished_good']),
  reorderLevel: z.coerce.number().nonnegative(),
})
type ItemFormValues = z.infer<typeof itemSchema>

const ITEM_TYPE_LABELS: Record<InventoryItemType, string> = {
  raw: 'Raw material',
  prepared: 'Prepared (ingredient only)',
  finished_good: 'Finished good',
}

const ITEM_TYPE_TABS: { value: InventoryItemType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'raw', label: 'Raw materials' },
  { value: 'prepared', label: 'Prepared items' },
  { value: 'finished_good', label: 'Finished goods' },
]

// A lot is "expiring soon" if it has stock left and expires within the hour
// — purely informational, no automated waste-off happens from this.
function isExpiringSoon(expiresAt: string | null) {
  if (!expiresAt) return false
  const msLeft = new Date(expiresAt).getTime() - Date.now()
  return msLeft > 0 && msLeft <= 60 * 60 * 1000
}
function isExpired(expiresAt: string | null) {
  return !!expiresAt && new Date(expiresAt).getTime() <= Date.now()
}

const REASON_CODES = [
  { value: 'count_correction', label: 'Count correction' },
  { value: 'spoilage_found', label: 'Spoilage found late' },
  { value: 'data_entry_error', label: 'Data entry error' },
  { value: 'other', label: 'Other' },
]

function TransactionDetail({ tx }: { tx: InventoryTransaction }) {
  const ref = tx.reference
  if (ref?.kind === 'order') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
        <div><span className="text-muted-foreground">Table</span><div className="font-medium">{ref.table}</div></div>
        <div><span className="text-muted-foreground">Order status</span><div><StatusBadge status={ref.orderStatus} /></div></div>
        <div><span className="text-muted-foreground">Order placed</span><div className="font-medium">{new Date(ref.orderCreatedAt).toLocaleString()}</div></div>
        <div><span className="text-muted-foreground">Waiter</span><div className="font-medium">{ref.waiterName}</div></div>
        <div><span className="text-muted-foreground">Menu item</span><div className="font-medium">{ref.menuItemName} × {ref.quantitySold}</div></div>
        <div><span className="text-muted-foreground">Price / cost at sale</span><div className="font-medium">{rwf(ref.priceAtSale)} / {rwf(ref.costAtSale)}</div></div>
        <div><span className="text-muted-foreground">Prepared by</span><div className="font-medium">{ref.preparedByName ?? '—'}{ref.preparedAt ? ` · ${new Date(ref.preparedAt).toLocaleString()}` : ''}</div></div>
        {ref.isVoided && (
          <div className="col-span-2"><span className="text-muted-foreground">Voided</span><div className="font-medium text-destructive">{ref.voidReason ?? 'No reason given'}</div></div>
        )}
      </div>
    )
  }
  if (ref?.kind === 'purchase_order') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
        <div><span className="text-muted-foreground">Supplier</span><div className="font-medium">{ref.supplierName}</div></div>
        <div><span className="text-muted-foreground">PO status</span><div><StatusBadge status={ref.status} /></div></div>
      </div>
    )
  }
  if (ref?.kind === 'prep_recipe') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
        <div><span className="text-muted-foreground">Produced for</span><div className="font-medium">{ref.outputItemName}</div></div>
        {ref.productionSource && (
          <div>
            <span className="text-muted-foreground">Made</span>
            <div className="font-medium">{ref.productionSource === 'outside' ? 'Outside (outsourced)' : 'In-house'}</div>
          </div>
        )}
        {ref.productionSource === 'outside' && ref.outsideCost != null && (
          <div><span className="text-muted-foreground">Cost paid</span><div className="font-medium">{rwf(ref.outsideCost)}</div></div>
        )}
        {ref.productionSource === 'internal' && !!ref.laborCost && (
          <div><span className="text-muted-foreground">Labor cost</span><div className="font-medium">{rwf(ref.laborCost)}</div></div>
        )}
      </div>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">
      {tx.notes ? tx.notes : 'No additional detail for this transaction.'}
    </p>
  )
}

function ProducibleSection({ itemId }: { itemId: string }) {
  const { data, isLoading } = useProducible(itemId)

  if (isLoading) return <Skeleton className="h-12 w-full" />
  if (!data || (data.menuItems.length === 0 && data.prepRecipes.length === 0)) {
    return <p className="text-sm text-muted-foreground">This item isn&apos;t used in any recipe yet.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {data.menuItems.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Menu items</p>
          <ul className="flex flex-col gap-1">
            {data.menuItems.map((mi) => (
              <li key={mi.menuItemId} className="flex items-center justify-between text-sm">
                <span>{mi.menuItemName}</span>
                <span className="font-medium">
                  {mi.maxUnits} {mi.maxUnits === 1 ? 'unit' : 'units'}
                  {mi.limitingIngredient && (
                    <span className="ml-1.5 font-normal text-muted-foreground">limited by {mi.limitingIngredient.name}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.prepRecipes.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Prep / mixture recipes</p>
          <ul className="flex flex-col gap-1">
            {data.prepRecipes.map((pr) => (
              <li key={pr.prepRecipeId} className="flex items-center justify-between text-sm">
                <span>{pr.outputItemName}</span>
                <span className="font-medium">
                  {pr.maxBatches} {pr.maxBatches === 1 ? 'batch' : 'batches'}
                  <span className="font-normal text-muted-foreground"> (~{pr.estimatedOutputQuantity.toFixed(2)} {pr.outputUnit})</span>
                  {pr.limitingIngredient && (
                    <span className="ml-1.5 font-normal text-muted-foreground">limited by {pr.limitingIngredient.name}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function LotsPanel({ item }: { item: InventoryItem }) {
  const { data: lots = [], isLoading } = useInventoryLots(item.id)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null)
  const [adjustLotId, setAdjustLotId] = useState('')
  const [adjustQty, setAdjustQty] = useState('')
  const [reasonCode, setReasonCode] = useState('')
  const [notes, setNotes] = useState('')
  const [priceLotId, setPriceLotId] = useState('')
  const [newUnitCost, setNewUnitCost] = useState('')
  const [priceReasonCode, setPriceReasonCode] = useState('')
  const [priceNotes, setPriceNotes] = useState('')
  const adjustStock = useAdjustStock()
  const adjustLotPrice = useAdjustLotPrice()
  const { data: transactions = [], isLoading: txLoading } = useInventoryTransactions(ledgerOpen ? item.id : undefined)

  async function submitAdjustment() {
    await adjustStock.mutateAsync({ lotId: adjustLotId, quantity: parseFloat(adjustQty), reasonCode, notes: notes || undefined })
    setAdjustLotId(''); setAdjustQty(''); setReasonCode(''); setNotes('')
  }

  async function submitPriceAdjustment() {
    await adjustLotPrice.mutateAsync({ lotId: priceLotId, newUnitCost: parseFloat(newUnitCost), reasonCode: priceReasonCode, notes: priceNotes || undefined })
    setPriceLotId(''); setNewUnitCost(''); setPriceReasonCode(''); setPriceNotes('')
  }

  // "Zero out" fills in the negative delta needed to bring this lot's
  // remaining quantity to exactly zero — the adjustment API takes a signed
  // delta, not an absolute target, so typing 0 there is rejected as a no-op.
  function zeroOutLot(lot: (typeof lots)[number]) {
    setAdjustLotId(lot.id)
    setAdjustQty((-lot.quantityRemaining).toFixed(2))
  }

  return (
    <TableRow>
      <TableCell colSpan={10} className="bg-muted/30 p-4">
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
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell>
                        {lot.expiresAt ? (
                          <span className={`flex items-center gap-1 ${isExpired(lot.expiresAt) ? 'text-destructive' : isExpiringSoon(lot.expiresAt) ? 'text-warning-foreground' : 'text-muted-foreground'}`}>
                            {(isExpired(lot.expiresAt) || isExpiringSoon(lot.expiresAt)) && <AlertTriangle className="h-3.5 w-3.5" />}
                            {new Date(lot.expiresAt).toLocaleString()}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={lot.quantityRemaining <= 0}
                          onClick={() => zeroOutLot(lot)}
                        >
                          Zero out
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
              <span className="flex items-center gap-1.5 text-sm font-medium"><ChefHat className="h-3.5 w-3.5" />Producible from current stock</span>
              <ProducibleSection itemId={item.id} />
            </div>

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

            <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
              <span className="flex items-center gap-1.5 text-sm font-medium"><SlidersHorizontal className="h-3.5 w-3.5" />Price correction</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Select value={priceLotId || null} onValueChange={(v) => setPriceLotId(v ?? '')}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Lot" /></SelectTrigger>
                  <SelectContent>
                    {lots.map((lot) => (
                      <SelectItem key={lot.id} value={lot.id}>{lot.costingMethod.toUpperCase()} · {rwf(lot.unitCost)}/unit</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="New unit cost" value={newUnitCost} onChange={(e) => setNewUnitCost(e.target.value)} />
                <Select value={priceReasonCode || null} onValueChange={(v) => setPriceReasonCode(v ?? '')}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Reason code" /></SelectTrigger>
                  <SelectContent>
                    {REASON_CODES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!priceLotId || !newUnitCost || !priceReasonCode || adjustLotPrice.isPending}
                  onClick={submitPriceAdjustment}
                >
                  {adjustLotPrice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Apply
                </Button>
              </div>
              <Input placeholder="Notes (optional)" value={priceNotes} onChange={(e) => setPriceNotes(e.target.value)} />
            </div>
          </div>
        )}

        <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
          <DialogContent className="max-h-[85vh] w-full max-w-[95vw] overflow-y-auto sm:max-w-[67vw]">
            <DialogHeader><DialogTitle>Transaction ledger — {item.name}</DialogTitle></DialogHeader>
            {txLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => {
                    const isTxOpen = expandedTxId === t.id
                    return (
                      <Fragment key={t.id}>
                        <TableRow className="cursor-pointer hover:bg-accent" onClick={() => setExpandedTxId(isTxOpen ? null : t.id)}>
                          <TableCell className="w-6">{isTxOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</TableCell>
                          <TableCell className="capitalize">{t.type}{t.reasonCode ? ` (${t.reasonCode})` : ''}</TableCell>
                          <TableCell className="text-right">{t.quantity > 0 ? '+' : ''}{t.quantity.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{rwf(t.unitCost)}</TableCell>
                          <TableCell className="text-muted-foreground">{t.recordedBy.name}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                        {isTxOpen && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30 p-3">
                              <TransactionDetail tx={t} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
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
  const [typeFilter, setTypeFilter] = useState<InventoryItemType | 'all'>('all')
  // Finished goods (Soda, Fanta, a bottled liquor) are sold exactly as
  // stocked, with no recipe of their own beyond "1 unit of itself" — opt-in
  // at creation time saves the trip to the Menu page to hand-build that
  // trivial 1:1 recipe. Only offered when creating (not editing) a Finished
  // good item.
  const [addToMenu, setAddToMenu] = useState(false)
  const [menuPrice, setMenuPrice] = useState('')
  const [menuQuantity, setMenuQuantity] = useState('1')
  const [menuCategoryId, setMenuCategoryId] = useState<string | undefined>(undefined)

  const { data: items = [], isLoading } = useInventory()
  const { data: locationStock = [] } = useLocationStockProjection()
  const locationStockById = new Map(locationStock.map((l) => [l.id, l]))
  const { data: menuCategories = [] } = useMenuCategories()
  const createMutation = useCreateInventoryItem()
  const updateMutation = useUpdateInventoryItem()
  const deleteMutation = useDeleteInventoryItem()
  const createMenuItemMutation = useCreateMenuItem()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: { itemType: 'raw' },
  })
  const itemType = watch('itemType')
  const unit = watch('unit')

  function resetMenuFields() {
    setAddToMenu(false)
    setMenuPrice('')
    setMenuQuantity('1')
    setMenuCategoryId(undefined)
  }

  function openEdit(item: InventoryItem) {
    setEditing(item)
    reset({ name: item.name, unit: item.unit, itemType: item.itemType, reorderLevel: item.reorderLevel })
    resetMenuFields()
    setOpen(true)
  }

  function openCreate() {
    setEditing(null)
    reset({ name: '', unit: '', itemType: 'raw', reorderLevel: 0 })
    resetMenuFields()
    setOpen(true)
  }

  async function onSubmit(values: ItemFormValues) {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data: values })
    } else {
      const created = await createMutation.mutateAsync(values)
      if (addToMenu) {
        const quantity = parseFloat(menuQuantity) || 1
        // Selling less than the item's full stocking unit (0.3 L of a Soda
        // stocked by the liter) needs its own label, or two prices for "the
        // same" item would look like a duplicate on the ordering screen.
        // Skip the label entirely at quantity 1 — "1 bottle" adds nothing a
        // waiter needs to see.
        const variantLabel = quantity !== 1 ? `${quantity} ${created.unit}`.trim() : undefined
        await createMenuItemMutation.mutateAsync({
          name: created.name,
          variantLabel,
          categoryId: menuCategoryId,
          price: parseFloat(menuPrice),
          preparationCost: 0,
          requiresPreparation: false,
          recipe: [{ inventoryItemId: created.id, quantity }],
        })
      }
    }
    reset()
    resetMenuFields()
    setOpen(false)
    setEditing(null)
  }

  const canSubmitMenu = !addToMenu || (!!menuPrice && parseFloat(menuPrice) > 0 && parseFloat(menuQuantity) > 0)
  const isPending = createMutation.isPending || updateMutation.isPending || createMenuItemMutation.isPending
  const visibleItems = typeFilter === 'all' ? items : items.filter((i) => i.itemType === typeFilter)
  const totalValue = visibleItems.reduce((s, i) => s + i.stockValue, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory" description={`Current stock levels and costs · total value ${rwf(totalValue)}`}
        action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add item</Button>}
      />

      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter((v as InventoryItemType | 'all') ?? 'all')}>
        <TabsList>
          {ITEM_TYPE_TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : visibleItems.length === 0 ? (
            <EmptyState icon={Boxes} message="No inventory items in this category yet." action={{ label: 'Add item', onClick: openCreate }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Main stock</TableHead>
                  <TableHead className="text-right">Kitchen stock</TableHead>
                  <TableHead className="text-right">Cashier stock</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((item) => {
                  const isOpen = expandedId === item.id
                  const proj = locationStockById.get(item.id)
                  return (
                    <Fragment key={item.id}>
                      <TableRow className="hover:bg-accent cursor-pointer" onClick={() => setExpandedId(isOpen ? null : item.id)}>
                        <TableCell className="w-8">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><Badge variant="secondary">{ITEM_TYPE_LABELS[item.itemType]}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                        <TableCell className="text-right">{item.currentStock.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{proj ? proj.kitchen.toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{proj ? proj.bar.toFixed(2) : '—'}</TableCell>
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
              <Label>Item type</Label>
              <Select value={itemType ?? null} onValueChange={(v) => v && setValue('itemType', v as InventoryItemType)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Item type" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ITEM_TYPE_LABELS) as [InventoryItemType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Raw = bought from suppliers. Prepared = only ever used as an ingredient in another recipe. Finished
                good = ready to sell as-is (a cooked batch, a bottled drink).
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Reorder level</Label>
              <Input type="number" placeholder="10" {...register('reorderLevel')} />
            </div>

            {!editing && itemType === 'finished_good' && (
              <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border"
                    checked={addToMenu}
                    onChange={(e) => setAddToMenu(e.target.checked)}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">Also add to menu</span>
                    <span className="text-xs text-muted-foreground">
                      Ready-to-sell as-is (a Coke, Fanta, a bottled liquor) — creates a direct-serve menu item.
                      Selling less than one full unit at a time (0.3 L of a Soda stocked by the liter)? Set the
                      quantity below and it&apos;ll get its own size label so waiters don&apos;t see two identical entries.
                    </span>
                  </span>
                </label>
                {addToMenu && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>Qty per sale {unit ? `(${unit})` : ''}</Label>
                      <Input
                        type="number" step="0.01" placeholder="1"
                        value={menuQuantity} onChange={(e) => setMenuQuantity(e.target.value)}
                      />
                      {parseFloat(menuQuantity) > 0 && parseFloat(menuQuantity) !== 1 && unit && (
                        <p className="text-xs text-muted-foreground">Labeled &ldquo;{menuQuantity} {unit}&rdquo; to waiters</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Sell price</Label>
                      <Input
                        type="number" step="0.01" placeholder="1500"
                        value={menuPrice} onChange={(e) => setMenuPrice(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Category <span className="text-muted-foreground">(optional)</span></Label>
                      <Select value={menuCategoryId ?? null} onValueChange={(v) => setMenuCategoryId(v ?? undefined)}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>
                          {menuCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); reset(); resetMenuFields() }}>Cancel</Button>
              <Button type="submit" disabled={isPending || !canSubmitMenu}>
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
