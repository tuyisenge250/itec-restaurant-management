'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CreditCard, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrder } from '@/lib/api/orders'
import { useCreatePayment } from '@/lib/api/payments'

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const { data: order, isLoading } = useOrder(orderId)
  const createPayment = useCreatePayment()

  const [method, setMethod] = useState('cash')
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')

  if (isLoading) return <div className="flex flex-col gap-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-48 w-full" /></div>
  if (!order) return <p className="text-muted-foreground">Order not found.</p>

  const subtotal = order.items.reduce((s, i) => s + i.priceAtSale * i.quantity, 0)
  const discountN = parseFloat(discount) || 0
  const total = Math.max(0, subtotal - discountN)

  async function handleSubmit() {
    await createPayment.mutateAsync({
      orderId,
      method,
      amount: total,
      discount: discountN,
      notes: notes || undefined,
    })
    router.push('/waiter/payments')
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageHeader
        title="Record Payment"
        description={`${order.tableNumber ? `Table ${order.tableNumber} · ` : ''}Order #${order.id.slice(0, 8)}`}
      />

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Order summary</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 pb-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.menuItem.name} <span className="text-muted-foreground">×{item.quantity}</span></span>
              <span>${(item.priceAtSale * item.quantity).toFixed(2)}</span>
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

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Payment details</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Discount ($)</Label>
            <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes…" rows={2} />
          </div>
          <Button className="w-full" disabled={createPayment.isPending} onClick={handleSubmit}>
            {createPayment.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Record payment
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
