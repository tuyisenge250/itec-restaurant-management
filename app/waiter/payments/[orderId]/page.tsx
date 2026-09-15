'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CreditCard, Loader2, Printer, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useOrder } from '@/lib/api/orders'
import { useCreatePayment, usePayments, useRefundPayment, type Payment, type CreatePaymentInput } from '@/lib/api/payments'
import { rwf } from '@/lib/utils'

const METHODS: { value: CreatePaymentInput['method']; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'momo', label: 'Mobile money' },
  { value: 'other', label: 'Other' },
]

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const { data: order, isLoading } = useOrder(orderId)
  const { data: payments = [] } = usePayments(orderId)
  const createPayment = useCreatePayment()
  const refundPayment = useRefundPayment()

  const [method, setMethod] = useState<CreatePaymentInput['method']>('cash')
  const [amount, setAmount] = useState('')
  const [discount, setDiscount] = useState('0')
  const [discountReason, setDiscountReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [receiptOpen, setReceiptOpen] = useState(false)

  if (isLoading) return <div className="flex flex-col gap-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-48 w-full" /></div>
  if (!order) return <p className="text-muted-foreground">Order not found.</p>

  const activeItems = order.items.filter((i) => !i.isVoided)
  const subtotal = activeItems.reduce((s, i) => s + i.priceAtSale * i.quantity, 0)
  const orderDiscount = order.discountAmount ?? (order.discountPercent ? (subtotal * order.discountPercent) / 100 : 0)
  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0)
  const paymentDiscountsSoFar = payments.reduce((s, p) => s + p.discount, 0)
  const discountN = parseFloat(discount) || 0
  const requiredTotal = Math.max(subtotal - orderDiscount - paymentDiscountsSoFar - discountN, 0)
  const remaining = Math.max(requiredTotal - paidSoFar, 0)
  const amountN = parseFloat(amount) || 0
  const overpaying = amountN > remaining + 0.001

  const canPay = order.status === 'ready' || order.status === 'served'
  const isPaid = order.status === 'paid'

  async function handleSubmit() {
    setError('')
    if (overpaying) { setError(`That would overpay — remaining balance is ${rwf(remaining)}.`); return }
    if (discountN > 0 && !discountReason.trim()) { setError('A reason is required for a non-zero discount.'); return }
    try {
      await createPayment.mutateAsync({
        orderId,
        method,
        amount: amountN,
        discount: discountN,
        discountReason: discountReason || undefined,
        notes: notes || undefined,
      })
      setAmount(''); setDiscount('0'); setDiscountReason(''); setNotes('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed.')
    }
  }

  async function handleRefund() {
    if (!refundTarget) return
    await refundPayment.mutateAsync({ paymentId: refundTarget.id, data: { amount: parseFloat(refundAmount) || 0, reason: refundReason } })
    setRefundTarget(null); setRefundAmount(''); setRefundReason('')
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageHeader
        title="Payment"
        description={`Table ${order.table} · Order #${order.id.slice(0, 8)}`}
      />

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Order summary</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 pb-4">
          {activeItems.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.menuItem.name} <span className="text-muted-foreground">×{item.quantity}</span></span>
              <span>{rwf(item.priceAtSale * item.quantity)}</span>
            </div>
          ))}
          <Separator className="my-1" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span><span>{rwf(subtotal)}</span>
          </div>
          {orderDiscount > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Order discount</span><span>−{rwf(orderDiscount)}</span>
            </div>
          )}
          {paidSoFar > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Already paid</span><span>{rwf(paidSoFar)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>Remaining balance</span><span>{rwf(remaining)}</span>
          </div>
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Payments recorded</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 pb-4">
            {payments.map((p) => {
              const refunded = p.refunds.reduce((s, r) => s + r.amount, 0)
              return (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="capitalize">{p.method}</span> — {rwf(p.amount)}
                    {refunded > 0 && <span className="ml-2 text-xs text-muted-foreground">({rwf(refunded)} refunded)</span>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setRefundTarget(p)} disabled={refunded >= p.amount}>
                    <Undo2 className="mr-1 h-3.5 w-3.5" />Refund
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {isPaid ? (
        <Button variant="outline" onClick={() => setReceiptOpen(true)}><Printer className="mr-2 h-4 w-4" />View receipt</Button>
      ) : !canPay ? (
        <p className="text-sm text-muted-foreground">Order not yet served — payment isn&apos;t available yet.</p>
      ) : (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Take payment</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Payment method</Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v as CreatePaymentInput['method'])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={remaining.toFixed(2)} />
              <button type="button" className="w-fit text-xs text-primary hover:underline" onClick={() => setAmount(remaining.toFixed(2))}>
                Fill remaining ({rwf(remaining)})
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Discount at payment <span className="text-muted-foreground">(optional)</span></Label>
              <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </div>
            {discountN > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>Discount reason</Label>
                <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Required for a discount" />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes…" rows={2} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={createPayment.isPending || amountN <= 0 || overpaying} onClick={handleSubmit}>
              {createPayment.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Record payment
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!refundTarget} onOpenChange={(o) => { if (!o) setRefundTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refund payment</DialogTitle></DialogHeader>
          {refundTarget && (
            <p className="text-sm text-muted-foreground">
              Paid {rwf(refundTarget.amount)} · already refunded {rwf(refundTarget.refunds.reduce((s, r) => s + r.amount, 0))} ·
              remaining refundable {rwf(refundTarget.amount - refundTarget.refunds.reduce((s, r) => s + r.amount, 0))}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Refund amount</Label>
            <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Reason</Label>
            <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>Cancel</Button>
            <Button disabled={!refundAmount || !refundReason.trim() || refundPayment.isPending} onClick={handleRefund}>Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="print:shadow-none">
          <DialogHeader><DialogTitle>Receipt — Table {order.table}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-1 text-sm">
            {activeItems.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.menuItem.name} ×{item.quantity}</span>
                <span>{rwf(item.priceAtSale * item.quantity)}</span>
              </div>
            ))}
            <Separator className="my-1" />
            <div className="flex justify-between font-semibold"><span>Total paid</span><span>{rwf(paidSoFar)}</span></div>
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between text-muted-foreground">
                <span className="capitalize">{p.method}</span><span>{rwf(p.amount)}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => router.push('/waiter/payments')}>Close</Button>
            <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
