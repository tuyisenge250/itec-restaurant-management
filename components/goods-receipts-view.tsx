'use client'

import { useState } from 'react'
import { PackageCheck, Undo2, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useGoodsReceipts, useRecordGoodsReturn, type GoodsReceipt, type GoodsReceiptLine } from '@/lib/api/goods-receipts'
import {
  useStockRequisitions, useRecordLocationStockReturn,
  type StockRequisition, type StockRequisitionItem, type StockLocation,
} from '@/lib/api/stock-requisitions'
import { useCurrentUser } from '@/lib/api/auth'
import { rwf, formatPoNumber, formatGrnNumber } from '@/lib/utils'

const EPSILON = 1e-6
// Mirrors stock-requisition.service.ts's LOCATION_HOME_AREA — kitchen maps
// to the kitchen homeArea, bar to cashier (there's no separate "bar"
// homeArea). Client-side copy purely to decide whether to show the Return
// button; the server re-checks this for real on every request regardless.
const LOCATION_HOME_AREA: Record<StockLocation, string> = { kitchen: 'kitchen', bar: 'cashier' }
const LOCATION_LABEL: Record<StockLocation, string> = { kitchen: 'Kitchen', bar: 'Bar' }

function goodsReturnedQty(line: GoodsReceiptLine) {
  return line.returns.reduce((s, r) => s + r.quantityReturned, 0)
}
function locationReturnedQty(item: StockRequisitionItem) {
  return item.returns.reduce((s, r) => s + r.quantityReturned, 0)
}

function ReturnLineForm({ line, onDone }: { line: GoodsReceiptLine; onDone: () => void }) {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const recordReturn = useRecordGoodsReturn()
  const remaining = line.quantityReceived - goodsReturnedQty(line)

  async function submit() {
    const qty = parseFloat(quantity)
    if (!qty || !reason) return
    await recordReturn.mutateAsync({ lineId: line.id, data: { quantityReturned: qty, reason } })
    onDone()
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label>Quantity to return <span className="text-muted-foreground">(max {remaining} {line.purchaseOrderItem.inventoryItem.unit})</span></Label>
          <Input type="number" step="0.01" min={0} max={remaining} placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Reason</Label>
          <Input placeholder="Wrong item, damaged, excess..." value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
        <Button size="sm" disabled={!quantity || !reason || recordReturn.isPending} onClick={submit}>
          {recordReturn.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm return
        </Button>
      </div>
    </div>
  )
}

function GoodsReceiptDetailDialog({ goodsReceipt, onClose, canReturn }: { goodsReceipt: GoodsReceipt | null; onClose: () => void; canReturn: boolean }) {
  const [returningLineId, setReturningLineId] = useState<string | null>(null)

  return (
    <Dialog open={!!goodsReceipt} onOpenChange={(o) => { if (!o) { setReturningLineId(null); onClose() } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goodsReceipt && formatGrnNumber(goodsReceipt.grnNumber, goodsReceipt.receivedAt)}</DialogTitle>
        </DialogHeader>
        {goodsReceipt && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Purchase order</span><p className="font-medium">{formatPoNumber(goodsReceipt.purchaseOrder.poNumber, goodsReceipt.receivedAt)}</p></div>
              <div><span className="text-muted-foreground">Supplier</span><p className="font-medium">{goodsReceipt.purchaseOrder.supplier.name}</p></div>
              <div><span className="text-muted-foreground">Received by</span><p className="font-medium">{goodsReceipt.receivedBy.name} · {new Date(goodsReceipt.receivedAt).toLocaleString()}</p></div>
              {goodsReceipt.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes</span><p>{goodsReceipt.notes}</p></div>}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Lines received</p>
              <div className="flex flex-col gap-2">
                {goodsReceipt.lines.map((line) => {
                  const returned = goodsReturnedQty(line)
                  const remaining = line.quantityReceived - returned
                  return (
                    <div key={line.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{line.purchaseOrderItem.inventoryItem.name} · {line.costingMethod.toUpperCase()}</span>
                        <span>{line.quantityReceived} {line.purchaseOrderItem.inventoryItem.unit} @ {rwf(line.unitCost)}</span>
                      </div>
                      {returned > EPSILON && (
                        <p className="mt-1 text-xs text-warning-foreground">
                          {returned} {line.purchaseOrderItem.inventoryItem.unit} returned to supplier
                        </p>
                      )}
                      {line.returns.length > 0 && (
                        <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {line.returns.map((r) => (
                            <li key={r.id} className="flex justify-between">
                              <span>{r.quantityReturned} {line.purchaseOrderItem.inventoryItem.unit} — {r.reason} (by {r.returnedBy.name})</span>
                              <span>{new Date(r.returnedAt).toLocaleDateString()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {canReturn && remaining > EPSILON && (
                        returningLineId === line.id ? (
                          <ReturnLineForm line={line} onDone={() => setReturningLineId(null)} />
                        ) : (
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => setReturningLineId(line.id)}>
                            <Undo2 className="mr-1 h-4 w-4" />Return to supplier
                          </Button>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
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

function SupplierReceiptsTab() {
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data: goodsReceipts = [], isLoading } = useGoodsReceipts()
  const { data: me } = useCurrentUser()
  const canReturn = !!me && (me.role.permissions.includes('goods_receipts.return') || me.role.permissions.includes('purchase_orders.manage'))
  const detail = goodsReceipts.find((gr) => gr.id === detailId) ?? null

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : goodsReceipts.length === 0 ? (
            <EmptyState icon={PackageCheck} message="No goods receipts yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN #</TableHead>
                  <TableHead>Purchase order</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Received by</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goodsReceipts.map((gr) => (
                  <TableRow key={gr.id} className="hover:bg-accent cursor-pointer" onClick={() => setDetailId(gr.id)}>
                    <TableCell className="font-medium">{formatGrnNumber(gr.grnNumber, gr.receivedAt)}</TableCell>
                    <TableCell>{formatPoNumber(gr.purchaseOrder.poNumber, gr.receivedAt)}</TableCell>
                    <TableCell>{gr.purchaseOrder.supplier.name}</TableCell>
                    <TableCell>{gr.receivedBy.name}</TableCell>
                    <TableCell>{gr.lines.length}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(gr.receivedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <GoodsReceiptDetailDialog goodsReceipt={detail} onClose={() => setDetailId(null)} canReturn={canReturn} />
    </>
  )
}

function ReturnRequisitionItemForm({ item, onDone }: { item: StockRequisitionItem; onDone: () => void }) {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const recordReturn = useRecordLocationStockReturn()
  const remaining = (item.quantityReceived ?? 0) - locationReturnedQty(item)

  async function submit() {
    const qty = parseFloat(quantity)
    if (!qty || !reason) return
    await recordReturn.mutateAsync({ itemId: item.id, data: { quantityReturned: qty, reason } })
    onDone()
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label>Quantity to return <span className="text-muted-foreground">(max {remaining} {item.inventoryItem.unit})</span></Label>
          <Input type="number" step="0.01" min={0} max={remaining} placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Reason</Label>
          <Input placeholder="Over-requisitioned, unused..." value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
        <Button size="sm" disabled={!quantity || !reason || recordReturn.isPending} onClick={submit}>
          {recordReturn.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm return
        </Button>
      </div>
    </div>
  )
}

function LocationReceiptDetailDialog({ requisition, onClose, canReturn }: { requisition: StockRequisition | null; onClose: () => void; canReturn: boolean }) {
  const [returningItemId, setReturningItemId] = useState<string | null>(null)

  return (
    <Dialog open={!!requisition} onOpenChange={(o) => { if (!o) { setReturningItemId(null); onClose() } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{requisition && `${LOCATION_LABEL[requisition.location]} receipt`}</DialogTitle>
        </DialogHeader>
        {requisition && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Requested by</span><p className="font-medium">{requisition.requestedBy.name}</p></div>
              <div><span className="text-muted-foreground">Approved by</span><p className="font-medium">{requisition.reviewedBy?.name ?? '—'}</p></div>
              <div><span className="text-muted-foreground">Received by</span><p className="font-medium">{requisition.receivedBy?.name} · {requisition.receivedAt && new Date(requisition.receivedAt).toLocaleString()}</p></div>
              {requisition.notes && <div className="col-span-2"><span className="text-muted-foreground">Requester&apos;s note</span><p>{requisition.notes}</p></div>}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Lines received</p>
              <div className="flex flex-col gap-2">
                {requisition.items.map((item) => {
                  const returned = locationReturnedQty(item)
                  const remaining = (item.quantityReceived ?? 0) - returned
                  return (
                    <div key={item.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.inventoryItem.name}</span>
                        <span>
                          requested {item.quantityRequested} · approved {item.quantityApproved ?? 0} · received {item.quantityReceived ?? 0} {item.inventoryItem.unit}
                        </span>
                      </div>
                      {returned > EPSILON && (
                        <p className="mt-1 text-xs text-warning-foreground">
                          {returned} {item.inventoryItem.unit} returned to Main
                        </p>
                      )}
                      {item.returns.length > 0 && (
                        <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {item.returns.map((r) => (
                            <li key={r.id} className="flex justify-between">
                              <span>{r.quantityReturned} {item.inventoryItem.unit} — {r.reason} (by {r.returnedBy.name})</span>
                              <span>{new Date(r.returnedAt).toLocaleDateString()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {canReturn && remaining > EPSILON && (
                        returningItemId === item.id ? (
                          <ReturnRequisitionItemForm item={item} onDone={() => setReturningItemId(null)} />
                        ) : (
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => setReturningItemId(item.id)}>
                            <Undo2 className="mr-1 h-4 w-4" />Return to Main
                          </Button>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
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

function LocationReceiptsTab() {
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data: requisitions = [], isLoading } = useStockRequisitions({ status: 'received' })
  const { data: me } = useCurrentUser()
  const detail = requisitions.find((r) => r.id === detailId) ?? null
  const canReturnForLocation = (location: StockLocation) =>
    !!me && (me.role.permissions.includes('requisitions.review') || (me.role.permissions.includes('requisitions.manage') && me.role.homeArea === LOCATION_HOME_AREA[location]))

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : requisitions.length === 0 ? (
            <EmptyState icon={PackageCheck} message="No location receipts yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Received by</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.map((r) => (
                  <TableRow key={r.id} className="hover:bg-accent cursor-pointer" onClick={() => setDetailId(r.id)}>
                    <TableCell><Badge variant="secondary">{LOCATION_LABEL[r.location]}</Badge></TableCell>
                    <TableCell className="font-medium">{r.requestedBy.name}</TableCell>
                    <TableCell>{r.receivedBy?.name}</TableCell>
                    <TableCell>{r.items.length}</TableCell>
                    <TableCell className="text-muted-foreground">{r.receivedAt && new Date(r.receivedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LocationReceiptDetailDialog
        requisition={detail}
        onClose={() => setDetailId(null)}
        canReturn={!!detail && canReturnForLocation(detail.location)}
      />
    </>
  )
}

// Shared by app/admin/goods-receipts, app/kitchen/goods-receipts, and
// app/cashier/goods-receipts (same "thin per-homeArea wrapper around one
// shared component" pattern as components/location-stock-requisitions.tsx).
// Admin sees both supplier receipts (Purchase Order -> Main, gated by
// goods_receipts.view/.return) and location receipts (an approved
// requisition received at Kitchen or Bar, gated by requisitions.manage) as
// tabs. Kitchen/cashier only ever deal with their own location's stock, not
// suppliers, so their pages pass showSupplierReceipts={false} to skip that
// tab (and its permission check) entirely — see lib/nav-config.ts, which
// only requires requisitions.manage for their two nav entries now.
export function GoodsReceiptsView({ showSupplierReceipts = true }: { showSupplierReceipts?: boolean }) {
  const { data: me } = useCurrentUser()
  const canSeeSupplier = showSupplierReceipts
    && !!me && (me.role.permissions.includes('goods_receipts.view') || me.role.permissions.includes('purchase_orders.manage'))
  const canSeeLocation = !!me && me.role.permissions.includes('requisitions.manage')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Goods Receipts"
        description={canSeeSupplier ? 'Every batch received — from suppliers into Main, and from Main into Kitchen/Bar' : 'Every batch received into your location from Main'}
      />

      {canSeeSupplier ? (
        <Tabs defaultValue="supplier">
          <TabsList>
            <TabsTrigger value="supplier">Supplier receipts</TabsTrigger>
            {canSeeLocation && <TabsTrigger value="location">Location receipts</TabsTrigger>}
          </TabsList>
          <TabsContent value="supplier" className="mt-4">
            <SupplierReceiptsTab />
          </TabsContent>
          {canSeeLocation && (
            <TabsContent value="location" className="mt-4">
              <LocationReceiptsTab />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        canSeeLocation && <LocationReceiptsTab />
      )}
    </div>
  )
}
