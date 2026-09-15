'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useOrders, useUpdateOrderStatus } from '@/lib/api/orders'
import { useCurrentUser } from '@/lib/api/auth'
import { rwf } from '@/lib/utils'

function minutesAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

export default function WaiterOrdersPage() {
  const router = useRouter()
  const [mineOnly, setMineOnly] = useState(true)
  const { data: orders = [], isLoading } = useOrders()
  const { data: me } = useCurrentUser()
  const updateStatus = useUpdateOrderStatus()

  const active = orders
    .filter((o) => !['paid', 'cancelled'].includes(o.status))
    .filter((o) => !mineOnly || !me || o.createdById === me.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={mineOnly ? 'My Orders' : 'All Orders'}
        description="Active orders"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setMineOnly((v) => !v)}>
              {mineOnly ? 'Show all' : 'Show mine'}
            </Button>
            <Link href="/waiter/orders/new"><Button>New order</Button></Link>
          </div>
        }
      />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : active.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No active orders." action={{ label: 'New order', onClick: () => router.push('/waiter/orders/new') }} />
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
                {active.map((o) => {
                  const total = o.items.filter((i) => !i.isVoided).reduce((s, i) => s + i.priceAtSale * i.quantity, 0)
                  return (
                    <TableRow key={o.id} className="hover:bg-accent">
                      <TableCell className="font-medium">
                        <Link href={`/waiter/orders/${o.id}`} className="hover:underline">{o.table}</Link>
                      </TableCell>
                      <TableCell>{o.items.length}</TableCell>
                      <TableCell>{rwf(total)}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{minutesAgo(o.createdAt)}m ago</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {o.status === 'ready' && (
                            <Button
                              size="sm" variant="outline"
                              disabled={updateStatus.isPending}
                              onClick={() => updateStatus.mutate({ id: o.id, status: 'served' })}
                            >
                              Mark served
                            </Button>
                          )}
                          {(o.status === 'ready' || o.status === 'served') && (
                            <Link href={`/waiter/payments/${o.id}`}>
                              <Button size="sm">Pay</Button>
                            </Link>
                          )}
                        </div>
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
