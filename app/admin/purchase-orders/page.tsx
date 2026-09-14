'use client'

import { useState } from 'react'
import { Plus, ClipboardList, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

const purchaseOrders = [
  { id: 'po_1', supplier: 'Fresh Farms',   status: 'received',           items: 4, created: 'Jun 10, 2025' },
  { id: 'po_2', supplier: 'City Meats',    status: 'ordered',            items: 2, created: 'Jun 12, 2025' },
  { id: 'po_3', supplier: 'Dairy Direct',  status: 'partially_received', items: 3, created: 'Jun 13, 2025' },
  { id: 'po_4', supplier: 'Spice Traders', status: 'draft',              items: 5, created: 'Jun 14, 2025' },
]

const receiveItems = [
  { name: 'Flour',        unit: 'kg', ordered: 20, received: 20 },
  { name: 'Tomato sauce', unit: 'l',  ordered: 10, received: 6  },
  { name: 'Cheese',       unit: 'kg', ordered: 5,  received: 5  },
]

export default function PurchaseOrdersPage() {
  const [newOpen, setNewOpen]         = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [rows, setRows]               = useState([{ id: 1 }])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Purchase Orders"
        description="Track procurement from suppliers"
        action={<Button onClick={() => setNewOpen(true)}><Plus className="mr-2 h-4 w-4" />New purchase order</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {purchaseOrders.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No purchase orders yet." action={{ label: 'New purchase order', onClick: () => setNewOpen(true) }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.map((po) => (
                  <TableRow key={po.id} className="hover:bg-accent">
                    <TableCell className="font-medium">{po.supplier}</TableCell>
                    <TableCell><StatusBadge status={po.status} /></TableCell>
                    <TableCell>{po.items}</TableCell>
                    <TableCell className="text-muted-foreground">{po.created}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setReceiveOpen(true)}>Receive goods</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New PO dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>New purchase order</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Supplier</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Fresh Farms</SelectItem>
                  <SelectItem value="2">City Meats</SelectItem>
                  <SelectItem value="3">Dairy Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Items</Label>
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_80px_100px_36px] gap-2">
                  <Select><SelectTrigger><SelectValue placeholder="Ingredient" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flour">Flour</SelectItem>
                      <SelectItem value="cheese">Cheese</SelectItem>
                      <SelectItem value="tomato">Tomato sauce</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Qty" type="number" />
                  <Input placeholder="Unit cost" type="number" />
                  <Button variant="ghost" size="icon" onClick={() => setRows(rows.filter((r) => r.id !== row.id))}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-fit" onClick={() => setRows([...rows, { id: Date.now() }])}>
                <Plus className="mr-1 h-3 w-3" /> Add row
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={() => setNewOpen(false)}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive goods dialog */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Receive goods — City Meats</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receiveItems.map((item) => (
                <TableRow key={item.name}>
                  <TableCell>{item.name} <span className="text-muted-foreground">({item.unit})</span></TableCell>
                  <TableCell>{item.ordered}</TableCell>
                  <TableCell><Input defaultValue={item.received} type="number" className="w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button onClick={() => setReceiveOpen(false)}>Confirm receipt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
