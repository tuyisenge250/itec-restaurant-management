import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const orders = [
  { id: 'ord_1', table: 'T3', items: 3, total: '$32.50', status: 'ready',     time: '5 min ago'  },
  { id: 'ord_2', table: 'T7', items: 2, total: '$25.00', status: 'preparing', time: '12 min ago' },
  { id: 'ord_3', table: 'T1', items: 5, total: '$61.00', status: 'pending',   time: '2 min ago'  },
  { id: 'ord_4', table: 'T5', items: 1, total: '$14.00', status: 'served',    time: '20 min ago' },
] // as const removed so .length check works at runtime

export default function WaiterOrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Orders"
        description="Active orders for your tables"
        action={<Link href="/waiter/orders/new"><Button>New order</Button></Link>}
      />

      <Card>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No active orders." action={{ label: 'New order', onClick: () => {} }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id} className="hover:bg-accent">
                    <TableCell className="font-medium">{o.table}</TableCell>
                    <TableCell>{o.items}</TableCell>
                    <TableCell>{o.total}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{o.time}</TableCell>
                    <TableCell className="text-right">
                    <Link href={`/waiter/payments/${o.id}`}><Button variant="outline" size="sm">Pay</Button></Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
