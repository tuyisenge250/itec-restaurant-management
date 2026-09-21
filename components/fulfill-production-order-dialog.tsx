'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useFulfillProductionOrder, type ProductionOrder } from '@/lib/api/production-orders'
import { rwf } from '@/lib/utils'

// Closes out a pending PrepProductionOrder.
// - internal: kitchen/waiter (whichever it's assigned to) or admin actually
//   runs the batch — ingredients are consumed right here, scaled to
//   whatever they report actually producing. No live stock-availability
//   readout here — fulfillment itself re-checks and rejects on real
//   shortage, so this is one field (quantity), not a preview step first.
// - outside: admin records what the third party delivered. The ingredients
//   already left the building at order creation (see the order service) —
//   there's nothing to check here, just a readout of what was already
//   reserved, plus a service-fee field.
// `simplified` hides the costing-method picker (defaults to FIFO silently),
// labor cost (reference-only, never folded into unit cost — tracked as a
// period Expense instead) and expiry date — all back-office concerns, not a
// kitchen/waiter one; they just report what actually came out.
export function FulfillProductionOrderDialog({
  order, onClose, simplified,
}: {
  order: ProductionOrder | null
  onClose: () => void
  simplified?: boolean
}) {
  const fulfill = useFulfillProductionOrder()
  const [quantityProduced, setQuantityProduced] = useState('')
  const [laborCost, setLaborCost] = useState('0')
  const [outsideCost, setOutsideCost] = useState('')
  const [costingMethod, setCostingMethod] = useState<'fifo' | 'lifo'>('fifo')
  const [expiresAt, setExpiresAt] = useState('')

  const isOutside = order?.source === 'outside'

  function reset() {
    setQuantityProduced('')
    setLaborCost('0')
    setOutsideCost('')
    setCostingMethod('fifo')
    setExpiresAt('')
  }

  const canSubmit = !!quantityProduced && (!isOutside || outsideCost !== '')

  async function handleSubmit() {
    if (!order || !canSubmit) return
    await fulfill.mutateAsync({
      id: order.id,
      data: {
        quantityProduced: parseFloat(quantityProduced),
        laborCost: !isOutside ? parseFloat(laborCost) || 0 : 0,
        outsideCost: isOutside ? parseFloat(outsideCost) || 0 : undefined,
        costingMethod,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    })
    reset()
    onClose()
  }

  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isOutside ? 'Receive' : 'Fulfill'} order — {order?.prepRecipe.outputItem.name}</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="flex flex-col gap-4 py-2">
            <p className="text-xs text-muted-foreground">
              Ordered: {order.targetQuantity} {order.prepRecipe.outputItem.unit}
              {order.notes ? ` — ${order.notes}` : ''}
            </p>

            {isOutside && (
              <div className="flex flex-col gap-1 rounded-md border border-border p-3 text-xs">
                <span className="font-medium text-foreground">Ingredients already given to the third party</span>
                <span className="text-muted-foreground">
                  Reserved at order creation, costing {rwf(order.reservedIngredientCost ?? 0)} — not deducted again here.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Quantity actually {isOutside ? 'received' : 'produced'} ({order.prepRecipe.outputItem.unit})</Label>
              <Input
                type="number" step="0.01" placeholder={String(order.targetQuantity)}
                value={quantityProduced} onChange={(e) => setQuantityProduced(e.target.value)}
              />
            </div>
            {isOutside ? (
              <div className="flex flex-col gap-1.5">
                <Label>Service fee paid <span className="text-muted-foreground">(on top of the ingredients already given)</span></Label>
                <Input type="number" step="0.01" placeholder="0.00" value={outsideCost} onChange={(e) => setOutsideCost(e.target.value)} />
              </div>
            ) : (
              !simplified && (
                <div className="flex flex-col gap-1.5">
                  <Label>Labor cost <span className="text-muted-foreground">(reference only — not folded into unit cost)</span></Label>
                  <Input type="number" step="0.01" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} />
                </div>
              )
            )}
            {!simplified && (
              <div className="flex flex-col gap-1.5">
                <Label>Costing method for this batch</Label>
                <Select value={costingMethod} onValueChange={(v) => v && setCostingMethod(v as 'fifo' | 'lifo')}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fifo">FIFO</SelectItem>
                    <SelectItem value="lifo">LIFO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {!simplified && (
              <div className="flex flex-col gap-1.5">
                <Label>Expires <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button disabled={!canSubmit || fulfill.isPending} onClick={handleSubmit}>
            {fulfill.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isOutside ? 'Record receipt' : 'Record production'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
