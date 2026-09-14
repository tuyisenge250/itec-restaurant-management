import { Boxes } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'

const items = [
  { id: '1', name: 'Flour',        unit: 'kg', stock: 48.5, avgCost: 1.20, reorder: 10 },
  { id: '2', name: 'Cheese',       unit: 'kg', stock: 3.2,  avgCost: 6.50, reorder: 5  },
  { id: '3', name: 'Tomato sauce', unit: 'l',  stock: 14.0, avgCost: 2.00, reorder: 3  },
  { id: '4', name: 'Chicken',      unit: 'kg', stock: 2.1,  avgCost: 4.80, reorder: 8  },
  { id: '5', name: 'Olive oil',    unit: 'l',  stock: 6.5,  avgCost: 3.50, reorder: 2  },
  { id: '6', name: 'Salt',         unit: 'kg', stock: 9.0,  avgCost: 0.30, reorder: 1  },
]

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inventory" description="Current stock levels and costs" />

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <EmptyState icon={Boxes} message="No inventory items yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Current stock</TableHead>
                  <TableHead className="text-right">Avg unit cost</TableHead>
                  <TableHead className="text-right">Reorder level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isLow = item.stock <= item.reorder
                  return (
                    <TableRow key={item.id} className="hover:bg-accent">
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                      <TableCell className="text-right">{item.stock.toFixed(1)}</TableCell>
                      <TableCell className="text-right">${item.avgCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{item.reorder}</TableCell>
                      <TableCell>{isLow ? <StatusBadge status="low_stock" /> : <StatusBadge status="active" />}</TableCell>
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
