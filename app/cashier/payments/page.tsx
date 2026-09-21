'use client'

import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useOrders } from '@/lib/api/orders'
import { rwf } from '@/lib/utils'

export default function CashierPaymentsPage() {
  const { data: orders = [], isLoading } = useOrders()
  const payable = orders.filter((o) => o.status === 'ready' || o.status === 'served')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payments" description="Orders ready to be paid, across every waiter" />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : payable.length === 0 ? (
            <EmptyState icon={CreditCard} message="No orders awaiting payment." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead>Waiter</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payable.map((o) => {
                  const total = o.items.filter((i) => !i.isVoided).reduce((s, i) => s + i.priceAtSale * i.quantity, 0)
                  return (
                    <TableRow key={o.id} className="hover:bg-accent">
                      <TableCell className="font-medium">{o.table}</TableCell>
                      <TableCell className="text-muted-foreground">{o.createdBy.name}</TableCell>
                      <TableCell>{o.items.length}</TableCell>
                      <TableCell>{rwf(total)}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-right">
                        <Link href={`/cashier/payments/${o.id}`}>
                          <Button size="sm">Record payment</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
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
