'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Minus, Send, UtensilsCrossed, Loader2, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMenu } from '@/lib/api/menu'
import { useCreateOrder } from '@/lib/api/orders'
import { useTables } from '@/lib/api/tables'
import { rwf } from '@/lib/utils'

type OrderLine = { id: string; name: string; price: number; qty: number }

export default function NewOrderPage() {
  const router = useRouter()
  const { data: menuItems = [], isLoading } = useMenu()
  const { data: knownTables = [] } = useTables()
  const createOrder = useCreateOrder()

  const [lines, setLines] = useState<OrderLine[]>([])
  const [table, setTable] = useState('')
  const [addingNewTable, setAddingNewTable] = useState(false)
  const [error, setError] = useState('')

  const NEW_TABLE_OPTION = '__new__'

  function addItem(item: { id: string; name: string; price: number }) {
    setError('')
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

  async function handleSend() {
    setError('')
    if (!table.trim()) { setError('Enter a table before sending the order.'); return }
    try {
      const order = await createOrder.mutateAsync({
        table: table.trim(),
        items: lines.map((l) => ({ menuItemId: l.id, quantity: l.qty })),
      })
      router.push(`/waiter/orders/${order.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the order.')
    }
  }

  const byCategory = menuItems
    .filter((i) => i.isAvailable)
    .reduce<Record<string, typeof menuItems>>((acc, item) => {
      const cat = item.category?.name ?? 'Other'
      acc[cat] = [...(acc[cat] ?? []), item]
      return acc
    }, {})

  const unavailable = menuItems.filter((i) => !i.isAvailable)
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 overflow-auto">
        <PageHeader title="New Order" description="Select items to add to the order" />
        {isLoading ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            {Object.entries(byCategory).map(([category, items]) => (
              <div key={category}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {items.map((item) => (
                    <Card key={item.id} className="cursor-pointer hover:bg-accent transition-colors" onClick={() => addItem(item)}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{rwf(item.price)}</p>
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
            {unavailable.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Out of stock</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {unavailable.map((item) => (
                    <Card key={item.id} className="cursor-not-allowed opacity-50">
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-sm text-destructive">Out of stock</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex w-72 shrink-0 flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold text-foreground">Order summary</h2>
        <div className="flex flex-col gap-1.5">
          <Label>Table</Label>
          {knownTables.length > 0 && !addingNewTable ? (
            <Select
              value={table || null}
              onValueChange={(v) => {
                if (v === NEW_TABLE_OPTION) { setAddingNewTable(true); setTable('') }
                else setTable(v ?? '')
              }}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a table" /></SelectTrigger>
              <SelectContent>
                {knownTables.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                <SelectItem value={NEW_TABLE_OPTION}>+ Add new table…</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Input
                placeholder="e.g. T15"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                autoFocus={addingNewTable}
              />
              {knownTables.length > 0 && (
                <button
                  type="button"
                  className="w-fit text-xs text-primary hover:underline"
                  onClick={() => { setAddingNewTable(false); setTable('') }}
                >
                  Choose from existing tables instead
                </button>
              )}
            </div>
          )}
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
                <span className="flex-1 truncate text-sm text-foreground">{line.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(line.id, -1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-accent">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm">{line.qty}</span>
                  <button onClick={() => changeQty(line.id, 1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-accent">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="w-16 text-right text-sm">{rwf(line.price * line.qty)}</span>
              </div>
            ))}
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{rwf(total)}</span>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button className="w-full" disabled={lines.length === 0 || createOrder.isPending} onClick={handleSend}>
          {createOrder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Create order
        </Button>
      </div>
    </div>
  )
}
