import { DollarSign, TrendingUp, ShoppingBag, AlertTriangle } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/status-badge'

const recentOrders = [
  { id: 'ord_1', table: 'T3', items: 4, total: '$48.00', status: 'paid',      time: '2 min ago' },
  { id: 'ord_2', table: 'T7', items: 2, total: '$25.00', status: 'served',    time: '8 min ago' },
  { id: 'ord_3', table: 'T1', items: 6, total: '$72.50', status: 'preparing', time: '12 min ago' },
  { id: 'ord_4', table: 'T5', items: 3, total: '$36.00', status: 'pending',   time: '15 min ago' },
  { id: 'ord_5', table: 'T2', items: 5, total: '$61.00', status: 'ready',     time: '20 min ago' },
] as const

export default function AdminDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Today's overview" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={DollarSign}    label="Today's Revenue" value="$1,284.00" trend={{ value: '+12% vs yesterday', up: true }} />
        <StatCard icon={TrendingUp}    label="Gross Profit"    value="$487.20"   trend={{ value: '+8% vs yesterday',  up: true }} />
        <StatCard icon={ShoppingBag}   label="Orders Today"    value="34"        trend={{ value: '+5 vs yesterday',   up: true }} />
        <StatCard icon={AlertTriangle} label="Low Stock Items"  value="3"         trend={{ value: '2 critical',        up: false }} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map((o) => (
                <TableRow key={o.id} className="hover:bg-accent">
                  <TableCell className="font-medium">{o.table}</TableCell>
                  <TableCell>{o.items}</TableCell>
                  <TableCell>{o.total}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-right text-muted-foreground">{o.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
