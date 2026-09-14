'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

const order = {
  id: 'ord_1',
  table: 'T3',
  items: [
    { name: 'Margherita Pizza', qty: 2, price: 12.50 },
    { name: 'Caesar Salad',     qty: 1, price: 7.50  },
    { name: 'Lemonade',         qty: 2, price: 3.00  },
  ],
}

export default function PaymentPage() {
  const [discount, setDiscount] = useState('0')
  const subtotal  = order.items.reduce((s, i) => s + i.price * i.qty, 0)
  const discountN = parseFloat(discount) || 0
  const total     = Math.max(0, subtotal - discountN)

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageHeader title="Record Payment" description={`Table ${order.table} · Order #${order.id}`} />

      {/* Order summary */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Order summary</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 pb-4">
          {order.items.map((item) => (
            <div key={item.name} className="flex justify-between text-sm">
              <span>{item.name} <span className="text-muted-foreground">×{item.qty}</span></span>
              <span>${(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <Separator className="my-1" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Discount</span><span>-${discountN.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment form */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Payment details</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Payment method</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Amount received ($)</Label>
            <Input type="number" defaultValue={total.toFixed(2)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Discount ($)</Label>
            <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea placeholder="Any notes about this payment…" rows={2} />
          </div>
          <Button className="w-full" onClick={() => console.log('record payment')}>
            <CreditCard className="mr-2 h-4 w-4" /> Record payment
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
