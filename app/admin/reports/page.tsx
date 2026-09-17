'use client'

import { useState } from 'react'
import { Banknote, TrendingUp, TrendingDown, Percent, Trash2, Eye } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DateRangePicker } from '@/components/date-range-picker'
import { ProfitTrendChart } from '@/components/profit-trend-chart'
import { ProfitByItemChart } from '@/components/profit-by-item-chart'
import { useProfitReport, useMenuItemDetail } from '@/lib/api/reports'
import { rwf } from '@/lib/utils'

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

function MenuItemDetailDialog({
  itemId, from, to, onClose,
}: { itemId: string | null; from: string; to: string; onClose: () => void }) {
  const { data, isLoading } = useMenuItemDetail(itemId ?? undefined, from, to)

  return (
    <Dialog open={!!itemId} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{data?.name ?? 'Item detail'}</DialogTitle></DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="flex flex-col gap-5 text-sm">
            <p className="text-muted-foreground">{data.quantitySold} sold in this range</p>

            <div>
              <p className="mb-2 font-medium">Consumption details</p>
              {data.consumption.length === 0 ? (
                <p className="text-muted-foreground">No ingredient consumption recorded for this range.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data.consumption.map((c) => (
                    <div key={c.inventoryItemId} className="flex justify-between">
                      <span>{c.name}</span>
                      <span className="text-muted-foreground">
                        {c.quantity} {c.unit} · {rwf(c.cost)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 font-medium">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />Waste details
              </p>
              {data.waste.length === 0 ? (
                <p className="text-muted-foreground">No waste recorded on this item&apos;s ingredients for this range.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data.waste.map((w) => (
                    <div key={w.inventoryItemId} className="flex justify-between">
                      <span>{w.name} <span className="text-muted-foreground">×{w.transactionCount}</span></span>
                      <span className="text-destructive">
                        {w.quantity} {w.unit} · {rwf(w.cost)}
                      </span>
                    </div>
                  ))}
                </div>
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

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange | undefined>({ from: firstOfMonth, to: today })
  const [applied, setApplied] = useState({ from: toDateInput(firstOfMonth), to: toDateInput(today) })
  const [detailItemId, setDetailItemId] = useState<string | null>(null)

  const { data, isLoading } = useProfitReport(applied.from, applied.to)

  const s = data?.summary

  function handleApply() {
    if (!range?.from) return
    setApplied({ from: toDateInput(range.from), to: toDateInput(range.to ?? range.from) })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" description="Profit & loss summary" />

      <Card>
        <CardContent className="flex flex-row flex-wrap items-end gap-4 p-4">
          <DateRangePicker value={range} onChange={setRange} />
          <Button onClick={handleApply}>Apply</Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 w-full lg:col-span-2" />
            <Skeleton className="h-72 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !s ? null : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Banknote}     label="Revenue" value={rwf(s.netRevenue)} />
            <StatCard icon={TrendingDown} label="COGS"    value={rwf(s.cogs)} />
            <StatCard icon={TrendingUp}   label="Profit"  value={rwf(s.profit)} />
            <StatCard icon={Percent}      label="Margin"  value={`${s.marginPct.toFixed(1)}%`} />
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Net Profit</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between"><span>Revenue</span><span>{rwf(s.netRevenue)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>− COGS</span><span>−{rwf(s.cogs)}</span></div>
              <div className="flex justify-between border-t border-border pt-2 font-medium">
                <span>Gross Profit</span><span>{rwf(s.profit)}</span>
              </div>

              {s.expensesByCategory.length === 0 ? (
                <p className="pt-1 text-muted-foreground">No expenses recorded for this range.</p>
              ) : (
                <>
                  <p className="pt-1 text-xs font-medium text-muted-foreground">Expenses</p>
                  {s.expensesByCategory.map((e) => (
                    <div key={e.category} className="flex justify-between pl-3 text-muted-foreground">
                      <span>− {e.category}</span><span>−{rwf(e.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-muted-foreground">
                    <span>− Total expenses</span><span>−{rwf(s.totalExpenses)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Net Profit</span>
                <span className={s.netProfit >= 0 ? 'text-success' : 'text-destructive'}>{rwf(s.netProfit)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3"><CardTitle className="text-base">Profit trend</CardTitle></CardHeader>
              <CardContent>
                <ProfitTrendChart data={data.trend} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Profit by item</CardTitle></CardHeader>
              <CardContent>
                <ProfitByItemChart items={data.byItem} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3"><CardTitle className="text-base">Profit by menu item</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">COGS</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byItem.map((row) => (
                      <TableRow key={row.menuItemId} className="hover:bg-accent">
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{row.quantitySold}</TableCell>
                        <TableCell className="text-right">{rwf(row.revenue)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{rwf(row.cogs)}</TableCell>
                        <TableCell className="text-right text-success">{rwf(row.profit)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => setDetailItemId(row.menuItemId)}>
                            <Eye className="mr-1 h-3.5 w-3.5" />View details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trash2 className="h-4 w-4 text-destructive" /> Waste cost
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Transactions</span>
                  <span>{data.waste.transactionCount}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-medium">
                  <span>Total waste</span>
                  <span className="text-destructive">{rwf(data.waste.totalCost)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <MenuItemDetailDialog
        itemId={detailItemId}
        from={applied.from}
        to={applied.to}
        onClose={() => setDetailItemId(null)}
      />
    </div>
  )
}
