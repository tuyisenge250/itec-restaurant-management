'use client'

import { useState } from 'react'
import { Plus, Truck } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

const suppliers = [
  { id: '1', name: 'Fresh Farms',    phone: '0700-000-001', email: 'fresh@farms.com',    isActive: true },
  { id: '2', name: 'City Meats',     phone: '0700-000-002', email: 'city@meats.com',     isActive: true },
  { id: '3', name: 'Dairy Direct',   phone: '0700-000-003', email: 'dairy@direct.com',   isActive: false },
  { id: '4', name: 'Spice Traders',  phone: '0700-000-004', email: 'spice@traders.com',  isActive: true },
]

export default function SuppliersPage() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suppliers"
        description="Manage your ingredient suppliers"
        action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add supplier</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {suppliers.length === 0 ? (
            <EmptyState icon={Truck} message="No suppliers yet. Add your first supplier." action={{ label: 'Add supplier', onClick: () => setOpen(true) }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id} className="hover:bg-accent">
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{s.email}</TableCell>
                    <TableCell><StatusBadge status={s.isActive ? 'active' : 'inactive'} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add supplier</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Fresh Farms" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="0700-000-000" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="supplier@example.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address">Address</Label>
              <Input id="address" placeholder="Kigali, Rwanda" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
