'use client'

import { useState } from 'react'
import { Loader2, Home, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useProducePrepRecipe, type PrepRecipe } from '@/lib/api/prep-recipes'
import { useIngredientPreview } from '@/lib/api/production-orders'
import { rwf } from '@/lib/utils'

type Source = 'internal' | 'outside'

// Admin's own ad-hoc "Produce batch" action on the prep-recipes tab (the
// kitchen used to have its own free-standing version of this, but that was
// replaced by the request-driven ProductionOrdersQueue — kitchen now only
// ever produces against an admin-issued order). Labor cost is dropped
// entirely: it was reference-only, never folded into unit cost, and is
// tracked properly as a period Expense instead. `simplified` hides the
// costing-method and expiry fields, unused by any caller today but kept for
// a future simplified entry point.
export function ProduceBatchDialog({
  recipe, onClose, simplified = false,
}: { recipe: PrepRecipe | null; onClose: () => void; simplified?: boolean }) {
  const produce = useProducePrepRecipe()
  const [source, setSource] = useState<Source>('internal')
  const [quantityProduced, setQuantityProduced] = useState('')
  const [outsideCost, setOutsideCost] = useState('')
  const [costingMethod, setCostingMethod] = useState<'fifo' | 'lifo'>('fifo')
  const [expiresAt, setExpiresAt] = useState('')

  function reset() {
    setSource('internal')
    setQuantityProduced('')
    setOutsideCost('')
    setCostingMethod('fifo')
    setExpiresAt('')
  }

  const canSubmit = !!quantityProduced && (source === 'internal' || outsideCost !== '')
  // Ingredients scale continuously from the recipe's own ratio, not a fixed
  // batch amount — this previews what THIS run (whatever quantity is
  // entered, defaulting to the recipe's reference yield) will actually draw.
  const previewQuantity = parseFloat(quantityProduced) || recipe?.yieldQuantity || 0
  const scale = recipe ? previewQuantity / recipe.yieldQuantity : 1
  const { data: costPreview } = useIngredientPreview(recipe?.id, previewQuantity)
  const totalCost = costPreview?.reduce((sum, p) => sum + p.lineCost, 0)

  async function handleSubmit() {
    if (!recipe || !canSubmit) return
    await produce.mutateAsync({
      id: recipe.id,
      data: {
        quantityProduced: parseFloat(quantityProduced),
        source,
        laborCost: 0,
        outsideCost: source === 'outside' ? parseFloat(outsideCost) || 0 : undefined,
        costingMethod,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    })
    reset()
    onClose()
  }

  return (
    <Dialog open={!!recipe} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Produce a batch — {recipe?.outputItem.name}</DialogTitle></DialogHeader>
        {recipe && (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Made</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={source === 'internal' ? 'default' : 'outline'} onClick={() => setSource('internal')}>
                  <Home className="mr-1.5 h-3.5 w-3.5" />In-house
                </Button>
                <Button type="button" variant={source === 'outside' ? 'default' : 'outline'} onClick={() => setSource('outside')}>
                  <Truck className="mr-1.5 h-3.5 w-3.5" />Outside
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {source === 'outside' && 'Made by a third party, but the ingredients are still yours — '}
              For {previewQuantity} {recipe.outputItem.unit}, consumes{' '}
              {recipe.inputs.map((i) => `${(i.quantity * scale).toFixed(2)} ${i.inputItem.unit} ${i.inputItem.name}`).join(', ')}.
              {source === 'outside' && ' Add their service fee below on top of that ingredient cost.'}
            </p>
            {totalCost != null && (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground">
                <span>Estimated ingredient cost</span>
                <span>{rwf(totalCost)} <span className="font-normal text-muted-foreground">({rwf(totalCost / previewQuantity)}/{recipe.outputItem.unit})</span></span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Quantity actually produced ({recipe.outputItem.unit})</Label>
              <Input
                type="number" step="0.01" placeholder={String(recipe.yieldQuantity)}
                value={quantityProduced} onChange={(e) => setQuantityProduced(e.target.value)}
              />
            </div>

            {source === 'outside' && (
              <div className="flex flex-col gap-1.5">
                <Label>Service fee paid <span className="text-muted-foreground">(on top of ingredient cost)</span></Label>
                <Input type="number" step="0.01" placeholder="0.00" value={outsideCost} onChange={(e) => setOutsideCost(e.target.value)} />
              </div>
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
          <Button disabled={!canSubmit || produce.isPending} onClick={handleSubmit}>
            {produce.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record production
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
