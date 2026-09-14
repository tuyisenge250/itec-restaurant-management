'use client'

import { useState } from 'react'
import { Plus, Minus, Send, UtensilsCrossed } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const menuByCategory: Record<string, { id: string; name: string; price: number }[]> = {
  Starter: [
    { id: 'm4', name: 'Caesar Salad', price: 7.50 },
  ],
  Main: [
    { id: 'm1', name: 'Margherita Pizza', price: 12.50 },
    { id: 'm2', name: 'Pasta Carbonara',  price: 10.00 },
    { id: 'm3', name: 'Grilled Chicken',  price: 14.00 },
  ],
  Dessert: [
    { id: 'm5', name: 'Tiramisu', price: 5.00 },
  ],
  Drinks: [
    { id: 'm6', name: 'Lemonade', price: 3.00 },
  ],
}

type OrderLine = { id: string; name: string; price: number; qty: number }

export default function NewOrderPage() {
  const [lines, setLines] = useState<OrderLine[]>([])
  const [table, setTable] = useState('')

  function addItem(item: { id: string; name: string; price: number }) {
    setLines((prev) => {
      const existing = prev.find((l) => l.id === item.id)
      if (existing) return prev.map((l) => l.id === item.id ? { ...l, qty: l.qty + 1 } : l)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  function changeQty(id: string, delta: number) {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.id !== id) return [l]
        const qty = l.qty + delta
        return qty <= 0 ? [] : [{ ...l, qty }]
      })
    )
  }

  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)

  return (
    <div className="flex h-full gap-6">
      {/* Menu grid */}
      <div className="flex-1 overflow-auto">
        <PageHeader title="New Order" description="Select items to add to the order" />
        <div className="mt-6 flex flex-col gap-6">
          {Object.entries(menuByCategory).map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((item) => (
                  <Card key={item.id} className="cursor-pointer hover:bg-accent transition-colors" onClick={() => addItem(item)}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-sm text-muted-foreground">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Plus className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Order summary panel */}
      <div className="flex w-72 shrink-0 flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold text-foreground">Order summary</h2>

        <div className="flex flex-col gap-1.5">
          <Label>Table number</Label>
          <Input placeholder="T1" value={table} onChange={(e) => setTable(e.target.value)} />
        </div>

        <Separator />

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No items yet</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-2 overflow-auto">
            {lines.map((line) => (
              <div key={line.id} className="flex items-center justify-between gap-2">
                <span className="flex-1 text-sm text-foreground truncate">{line.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(line.id, -1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-accent">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm">{line.qty}</span>
                  <button onClick={() => changeQty(line.id, 1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-accent">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="w-14 text-right text-sm">${(line.price * line.qty).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <Separator />
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <Button className="w-full" disabled={lines.length === 0} onClick={() => console.log('send to kitchen', { table, lines })}>
          <Send className="mr-2 h-4 w-4" /> Send to kitchen
        </Button>
      </div>
    </div>
  )
}
