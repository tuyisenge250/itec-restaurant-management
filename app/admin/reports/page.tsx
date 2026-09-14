'use client'

import { useState } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Percent, Trash2, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfitReport } from '@/lib/api/reports'

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

export default function ReportsPage() {
  const [from, setFrom] = useState(toDateInput(firstOfMonth))
  const [to, setTo] = useState(toDateInput(today))
  const [applied, setApplied] = useState({ from: toDateInput(firstOfMonth), to: toDateInput(today) })

  const { data, isLoading } = useProfitReport(applied.from, applied.to)

  const s = data?.summary

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" description="Profit & loss summary" />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button onClick={() => setApplied({ from, to })}>Apply</Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !s ? null : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={DollarSign}   label="Revenue" value={`$${s.netRevenue.toFixed(2)}`} />
            <StatCard icon={TrendingDown} label="COGS"    value={`$${s.cogs.toFixed(2)}`} />
            <StatCard icon={TrendingUp}   label="Profit"  value={`$${s.profit.toFixed(2)}`} />
            <StatCard icon={Percent}      label="Margin"  value={`${s.marginPct.toFixed(1)}%`} />
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byItem.map((row) => (
                      <TableRow key={row.menuItemId} className="hover:bg-accent">
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{row.quantitySold}</TableCell>
                        <TableCell className="text-right">${row.revenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">${row.cogs.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-success">${row.profit.toFixed(2)}</TableCell>
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
                  <span className="text-destructive">${data.waste.totalCost.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
