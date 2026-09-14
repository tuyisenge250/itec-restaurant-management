'use client'

import { useState } from 'react'
import { Plus, UtensilsCrossed } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const menuItems = [
  { id: '1', name: 'Margherita Pizza', category: 'Main',    price: 12.50, available: true  },
  { id: '2', name: 'Pasta Carbonara',  category: 'Main',    price: 10.00, available: true  },
  { id: '3', name: 'Grilled Chicken',  category: 'Main',    price: 14.00, available: true  },
  { id: '4', name: 'Caesar Salad',     category: 'Starter', price: 7.50,  available: true  },
  { id: '5', name: 'Tiramisu',         category: 'Dessert', price: 5.00,  available: false },
  { id: '6', name: 'Lemonade',         category: 'Drinks',  price: 3.00,  available: true  },
]

export default function MenuPage() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Menu"
        description="Manage available menu items"
        action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add menu item</Button>}
      />

      {menuItems.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} message="No menu items yet." action={{ label: 'Add menu item', onClick: () => setOpen(true) }} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {menuItems.map((item) => (
            <Card key={item.id} className={`overflow-hidden ${!item.available ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground leading-tight">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.category}</span>
                  </div>
                  <Badge className={item.available ? 'bg-success text-success-foreground shrink-0' : 'bg-muted text-muted-foreground shrink-0'}>
                    {item.available ? 'On' : 'Off'}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-semibold text-foreground">${item.price.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add menu item</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input placeholder="Margherita Pizza" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="main">Main</SelectItem>
                  <SelectItem value="dessert">Dessert</SelectItem>
                  <SelectItem value="drinks">Drinks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Price ($)</Label>
              <Input type="number" placeholder="12.50" />
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
