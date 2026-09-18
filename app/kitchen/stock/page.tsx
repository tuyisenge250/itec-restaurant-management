'use client'

import { Fragment, useState } from 'react'
import { Boxes, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProductionOrdersQueue } from '@/components/production-orders-queue'
import { useInventory, useInventoryLots, type InventoryItem } from '@/lib/api/inventory'

// A lot is "expiring soon" if it has stock left and expires within the hour
// — informational only, matches the flag shown on the admin inventory page.
function isExpiringSoon(expiresAt: string | null) {
  if (!expiresAt) return false
  const msLeft = new Date(expiresAt).getTime() - Date.now()
  return msLeft > 0 && msLeft <= 60 * 60 * 1000
}
function isExpired(expiresAt: string | null) {
  return !!expiresAt && new Date(expiresAt).getTime() <= Date.now()
}

function LotsRow({ item }: { item: InventoryItem }) {
  const { data: lots = [], isLoading } = useInventoryLots(item.id)

  return (
    <TableRow>
      <TableCell colSpan={4} className="bg-muted/30 p-4">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : lots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open batches for this item.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((lot) => (
                <TableRow key={lot.id}>
                  <TableCell><Badge variant={lot.costingMethod === 'lifo' ? 'default' : 'secondary'}>{lot.costingMethod.toUpperCase()}</Badge></TableCell>
                  <TableCell className="text-right">{lot.quantityRemaining.toFixed(2)} {item.unit}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(lot.receivedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {lot.expiresAt ? (
                      <span className={`flex items-center gap-1 ${isExpired(lot.expiresAt) ? 'text-destructive' : isExpiringSoon(lot.expiresAt) ? 'text-warning-foreground' : 'text-muted-foreground'}`}>
                        {(isExpired(lot.expiresAt) || isExpiringSoon(lot.expiresAt)) && <AlertTriangle className="h-3.5 w-3.5" />}
                        {new Date(lot.expiresAt).toLocaleString()}
                      </span>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCell>
    </TableRow>
  )
}

// Read-only view of finished-goods stock — ready-to-sell items sitting in
// stock right now (a cooked batch, bottled drinks), separate from raw
// ingredient stock. No waste/adjustment actions here; use Waste for that.
export default function KitchenStockPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data: items = [], isLoading } = useInventory()
  const finishedGoods = items.filter((i) => i.itemType === 'finished_good')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Finished Stock" description="Ready-to-serve items sitting in stock right now" />

      <ProductionOrdersQueue assignedRole="kitchen" />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : finishedGoods.length === 0 ? (
            <EmptyState icon={Boxes} message="No finished-goods items have been set up yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Ready now</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finishedGoods.map((item) => {
                  const isOpen = expandedId === item.id
                  return (
                    <Fragment key={item.id}>
                      <TableRow className="hover:bg-accent cursor-pointer" onClick={() => setExpandedId(isOpen ? null : item.id)}>
                        <TableCell className="w-8">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">{item.currentStock.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                      </TableRow>
                      {isOpen && <LotsRow item={item} />}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
