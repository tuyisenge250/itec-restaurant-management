import { DollarSign, TrendingUp, TrendingDown, Percent, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const byItem = [
  { name: 'Margherita Pizza', sold: 42, revenue: 525.00, cogs: 83.16,  profit: 441.84 },
  { name: 'Pasta Carbonara',  sold: 31, revenue: 310.00, cogs: 52.42,  profit: 257.58 },
  { name: 'Grilled Chicken',  sold: 28, revenue: 392.00, cogs: 43.12,  profit: 348.88 },
  { name: 'Caesar Salad',     sold: 19, revenue: 142.50, cogs: 19.00,  profit: 123.50 },
  { name: 'Tiramisu',         sold: 14, revenue: 70.00,  cogs: 11.20,  profit: 58.80  },
]

export default function ReportsPage() {
  const revenue = 1439.50
  const cogs    = 208.90
  const profit  = revenue - cogs
  const margin  = (profit / revenue) * 100

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" description="Profit & loss summary" />

      {/* Date range */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <Label>From</Label>
            <Input type="date" defaultValue="2025-06-01" className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>To</Label>
            <Input type="date" defaultValue="2025-06-14" className="w-40" />
          </div>
          <Button>Apply</Button>
        </CardContent>
      </Card>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={DollarSign}  label="Revenue"  value={`$${revenue.toFixed(2)}`} />
        <StatCard icon={TrendingDown} label="COGS"    value={`$${cogs.toFixed(2)}`} />
        <StatCard icon={TrendingUp}  label="Profit"   value={`$${profit.toFixed(2)}`} />
        <StatCard icon={Percent}     label="Margin"   value={`${margin.toFixed(1)}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profit by item */}
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
                {byItem.map((row) => (
                  <TableRow key={row.name} className="hover:bg-accent">
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.sold}</TableCell>
                    <TableCell className="text-right">${row.revenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">${row.cogs.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-success">${row.profit.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Waste card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trash2 className="h-4 w-4 text-destructive" /> Waste cost
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Flour</span>
              <span>$2.40</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tomato sauce</span>
              <span>$4.00</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cheese</span>
              <span>$6.50</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
              <span>Total waste</span>
              <span className="text-destructive">$12.90</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
