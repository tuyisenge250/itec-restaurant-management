'use client'

import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

const users = [
  { id: '1', name: 'Admin User',   email: 'admin@demo.com',   role: 'admin',   isActive: true  },
  { id: '2', name: 'Kitchen User', email: 'kitchen@demo.com', role: 'kitchen', isActive: true  },
  { id: '3', name: 'Waiter User',  email: 'waiter@demo.com',  role: 'waiter',  isActive: true  },
  { id: '4', name: 'Jane Doe',     email: 'jane@demo.com',    role: 'waiter',  isActive: false },
]

const roleBadge: Record<string, string> = {
  admin:   'bg-primary text-primary-foreground',
  kitchen: 'bg-warning text-warning-foreground',
  waiter:  'bg-secondary text-secondary-foreground',
}

export default function UsersPage() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Manage staff accounts and roles"
        action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add user</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <EmptyState icon={Users} message="No users yet." action={{ label: 'Add user', onClick: () => setOpen(true) }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="hover:bg-accent">
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell><Badge className={roleBadge[u.role]}>{u.role}</Badge></TableCell>
                    <TableCell><StatusBadge status={u.isActive ? 'active' : 'inactive'} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input placeholder="Jane Doe" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="jane@example.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Password</Label>
              <Input type="password" placeholder="••••••••" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                  <SelectItem value="waiter">Waiter</SelectItem>
                </SelectContent>
              </Select>
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
