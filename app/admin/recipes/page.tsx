'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronDown, ChevronRight, BookOpen, Loader2, Plus, Trash2, Boxes, Factory,
  ClipboardList, Home, Truck, Ban,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ProduceBatchDialog } from '@/components/produce-batch-dialog'
import { FulfillProductionOrderDialog } from '@/components/fulfill-production-order-dialog'
import { useMenu } from '@/lib/api/menu'
import { useRecipe } from '@/lib/api/recipes'
import { useInventory, type InventoryItemType } from '@/lib/api/inventory'
import { usePrepRecipes, useCreatePrepRecipe, type PrepRecipe } from '@/lib/api/prep-recipes'
import {
  useProductionOrders, useCreateProductionOrder, useCancelProductionOrder, useIngredientPreview,
  type ProductionOrder,
} from '@/lib/api/production-orders'
import { rwf } from '@/lib/utils'

function RecipeRow({ menuItemId }: { menuItemId: string }) {
  const { data, isLoading } = useRecipe(menuItemId)
  if (isLoading) return <div className="px-5 py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
  if (!data) return null
  return (
    <CardContent className="border-t border-border px-5 py-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground">
            <th className="pb-2 text-left font-normal">Ingredient</th>
            <th className="pb-2 text-right font-normal">Qty</th>
            <th className="pb-2 text-right font-normal">Unit</th>
            <th className="pb-2 text-right font-normal">Cost</th>
          </tr>
        </thead>
        <tbody>
          {data.ingredients.map((ing) => (
            <tr key={ing.name} className="border-t border-border">
              <td className="py-2">{ing.name}</td>
              <td className="py-2 text-right">{ing.quantity}</td>
              <td className="py-2 text-right text-muted-foreground">{ing.unit}</td>
              <td className="py-2 text-right">{rwf(ing.lineCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Preparation cost</span><span>{rwf(data.preparationCost)}</span>
        </div>
        <div className="flex justify-between font-medium text-foreground">
          <span>Total cost</span><span>{rwf(data.cost)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Sells for</span><span>{rwf(data.price)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Margin</span>
          <span className={data.margin < 0 ? 'text-destructive' : 'text-success'}>{data.margin.toFixed(1)}%</span>
        </div>
      </div>
    </CardContent>
  )
}

function MenuRecipesTab() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data: menuItems = [], isLoading } = useMenu()

  if (isLoading) return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  )

  if (menuItems.length === 0) {
    return <EmptyState icon={BookOpen} message="No recipes yet. Add a menu item with ingredients." />
  }

  return (
    <div className="flex flex-col gap-2">
      {menuItems.map((item) => {
        const isOpen = expanded === item.id
        return (
          <Card key={item.id} className="overflow-hidden">
            <button
              className="flex w-full items-center justify-between px-5 py-4 hover:bg-accent transition-colors"
              onClick={() => setExpanded(isOpen ? null : item.id)}
            >
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <span className="font-medium text-foreground">{item.name}</span>
                {item.category && <span className="text-sm text-muted-foreground">{item.category.name}</span>}
              </div>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {rwf(item.price)}
              </span>
            </button>
            {isOpen && <RecipeRow menuItemId={item.id} />}
          </Card>
        )
      })}
    </div>
  )
}

const prepRecipeSchema = z.object({
  outputItemId: z.string().min(1, 'Pick what this recipe produces'),
  yieldQuantity: z.coerce.number().positive(),
  batchInputNote: z.string().optional(),
  inputs: z.array(z.object({
    inputItemId: z.string().min(1),
    quantity: z.coerce.number().positive(),
  })).min(1, 'At least one input ingredient required'),
})
type PrepRecipeFormValues = z.infer<typeof prepRecipeSchema>

const ITEM_TYPE_LABELS: Record<InventoryItemType, string> = {
  raw: 'Raw material',
  prepared: 'Prepared',
  finished_good: 'Finished good',
}

function PrepRecipeCard({ recipe, onProduce }: { recipe: PrepRecipe; onProduce: (r: PrepRecipe) => void }) {
  // Cost is never a fixed per-batch number — it's whatever the current lots
  // would actually charge, scaled to the recipe's target yield (the same
  // scaling a production order uses), so this tracks live stock cost.
  const { data: preview } = useIngredientPreview(recipe.id, recipe.yieldQuantity)
  const totalCost = preview?.reduce((sum, p) => sum + p.lineCost, 0)

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-medium text-foreground">
              {recipe.outputItem.name}
              <Badge variant="secondary">{ITEM_TYPE_LABELS[recipe.outputItem.itemType]}</Badge>
            </span>
            <span className="text-xs text-muted-foreground">
              Yields ~{recipe.yieldQuantity} {recipe.outputItem.unit} per batch
              {recipe.batchInputNote ? ` — ${recipe.batchInputNote}` : ''}
            </span>
            {totalCost != null && (
              <span className="text-xs font-medium text-foreground">
                {rwf(totalCost)} <span className="font-normal text-muted-foreground">({rwf(totalCost / recipe.yieldQuantity)}/{recipe.outputItem.unit})</span>
              </span>
            )}
          </div>
          <Button size="sm" onClick={() => onProduce(recipe)}>
            <Factory className="mr-1.5 h-3.5 w-3.5" />Produce batch
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {recipe.inputs.map((i) => (
            <span key={i.id} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {i.quantity} {i.inputItem.unit} {i.inputItem.name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PrepRecipesTab() {
  const [createOpen, setCreateOpen] = useState(false)
  const [produceTarget, setProduceTarget] = useState<PrepRecipe | null>(null)
  const { data: prepRecipes = [], isLoading } = usePrepRecipes()
  const { data: inventory = [] } = useInventory()
  const createMutation = useCreatePrepRecipe()

  // A recipe's output should be something that's either only ever used as an
  // ingredient (prepared) or sold as-is (finished_good) — never raw, since
  // raw items only ever enter stock via a goods receipt.
  const outputCandidates = inventory.filter((i) => i.itemType !== 'raw')

  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors } } = useForm<PrepRecipeFormValues>({
    resolver: zodResolver(prepRecipeSchema),
    defaultValues: { inputs: [{ inputItemId: '', quantity: 0 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'inputs' })
  const outputItemId = watch('outputItemId')

  function openCreate() {
    reset({ outputItemId: '', yieldQuantity: 0, batchInputNote: '', inputs: [{ inputItemId: '', quantity: 0 }] })
    setCreateOpen(true)
  }

  async function onSubmit(values: PrepRecipeFormValues) {
    await createMutation.mutateAsync(values)
    reset()
    setCreateOpen(false)
  }

  if (isLoading) return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add prep recipe</Button>
      </div>

      {prepRecipes.length === 0 ? (
        <EmptyState
          icon={Boxes}
          message="No prep or batch recipes yet — define one to turn raw ingredients into a prepared or finished-good item."
          action={{ label: 'Add prep recipe', onClick: openCreate }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {prepRecipes.map((recipe) => (
            <PrepRecipeCard key={recipe.id} recipe={recipe} onProduce={setProduceTarget} />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) reset() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add prep recipe</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Produces</Label>
              <Select value={outputItemId || null} onValueChange={(v) => v && setValue('outputItemId', v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Prepared or finished-good item" /></SelectTrigger>
                <SelectContent>
                  {outputCandidates.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.name} ({inv.unit}) — {ITEM_TYPE_LABELS[inv.itemType]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.outputItemId && <p className="text-xs text-destructive">{errors.outputItemId.message}</p>}
              {outputCandidates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No prepared or finished-good items exist yet — create one on the Inventory page first.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Expected yield per batch</Label>
                <Input type="number" step="0.01" placeholder="8" {...register('yieldQuantity')} />
                {errors.yieldQuantity && <p className="text-xs text-destructive">{errors.yieldQuantity.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Batch note <span className="text-muted-foreground">(optional)</span></Label>
                <Input placeholder="e.g. based on 10kg raw potatoes" {...register('batchInputNote')} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Inputs consumed per batch</Label>
              {fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-[1fr_100px_32px] gap-2">
                  <Select
                    value={watch(`inputs.${i}.inputItemId`) || null}
                    onValueChange={(v) => v && setValue(`inputs.${i}.inputItemId`, v)}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Ingredient" /></SelectTrigger>
                    <SelectContent>
                      {inventory.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" step="0.01" placeholder="Qty" {...register(`inputs.${i}.quantity`)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              {errors.inputs && <p className="text-xs text-destructive">{errors.inputs.message ?? errors.inputs.root?.message}</p>}
              <Button type="button" variant="outline" size="sm" className="w-fit"
                onClick={() => append({ inputItemId: '', quantity: 0 })}>
                <Plus className="mr-1 h-3 w-3" /> Add input
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); setCreateOpen(false) }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ProduceBatchDialog recipe={produceTarget} onClose={() => setProduceTarget(null)} />
    </div>
  )
}

const productionOrderSchema = z
  .object({
    prepRecipeId: z.string().min(1, 'Pick a recipe'),
    targetQuantity: z.coerce.number().positive(),
    source: z.enum(['internal', 'outside']),
    assignedTeam: z.enum(['kitchen', 'waiter']).optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.source !== 'internal' || !!data.assignedTeam, {
    message: 'Pick who this goes to',
    path: ['assignedTeam'],
  })
type ProductionOrderFormValues = z.infer<typeof productionOrderSchema>

const ASSIGNED_ROLE_LABELS: Record<'kitchen' | 'waiter', string> = { kitchen: 'Kitchen', waiter: 'Waiter' }

function ProductionOrderCard({ order, onFulfill, onCancel }: {
  order: ProductionOrder
  onFulfill: (o: ProductionOrder) => void
  onCancel: (o: ProductionOrder) => void
}) {
  const variancePct = order.fulfillment
    ? (order.fulfillment.quantityProduced / order.targetQuantity) * 100
    : null

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-medium text-foreground">
              {order.prepRecipe.outputItem.name}
              <Badge variant="secondary" className="flex items-center gap-1">
                {order.source === 'outside' ? <Truck className="h-3 w-3" /> : <Home className="h-3 w-3" />}
                {order.source === 'outside' ? 'Outside' : `In-house · ${order.assignedTeam ? ASSIGNED_ROLE_LABELS[order.assignedTeam] : 'unassigned'}`}
              </Badge>
              <StatusBadge status={order.status} />
            </span>
            <span className="text-xs text-muted-foreground">
              Ordered {order.targetQuantity} {order.prepRecipe.outputItem.unit} by {order.createdBy.name} · {new Date(order.createdAt).toLocaleString()}
              {order.notes ? ` — ${order.notes}` : ''}
            </span>
            {order.source === 'outside' && order.reservedIngredientCost != null && (
              <span className="text-xs text-muted-foreground">Ingredients given: {rwf(order.reservedIngredientCost)}</span>
            )}
            {order.fulfillment && (
              <span className={`text-xs font-medium ${variancePct! < 100 ? 'text-warning-foreground' : 'text-success'}`}>
                Produced {order.fulfillment.quantityProduced} {order.prepRecipe.outputItem.unit} ({variancePct!.toFixed(0)}% of plan)
              </span>
            )}
          </div>
          {order.status === 'pending' && (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => onFulfill(order)}>
                {order.source === 'outside' ? 'Receive' : 'Fulfill'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onCancel(order)}>
                <Ban className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ProductionOrdersTab() {
  const [createOpen, setCreateOpen] = useState(false)
  const [fulfillTarget, setFulfillTarget] = useState<ProductionOrder | null>(null)
  const { data: orders = [], isLoading } = useProductionOrders()
  const { data: prepRecipes = [] } = usePrepRecipes()
  const createMutation = useCreateProductionOrder()
  const cancelMutation = useCancelProductionOrder()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ProductionOrderFormValues>({
    resolver: zodResolver(productionOrderSchema),
    defaultValues: { source: 'internal' },
  })
  const prepRecipeId = watch('prepRecipeId')
  const source = watch('source')
  const assignedTeam = watch('assignedTeam')
  const targetQuantity = watch('targetQuantity')

  const { data: preview, isLoading: previewLoading } = useIngredientPreview(prepRecipeId, targetQuantity)
  const shortages = (preview ?? []).filter((p) => p.available < p.needed)
  const totalCost = preview?.reduce((sum, p) => sum + p.lineCost, 0)
  const outputUnit = prepRecipes.find((r) => r.id === prepRecipeId)?.outputItem.unit

  function openCreate() {
    reset({ prepRecipeId: '', targetQuantity: 0, source: 'internal', assignedTeam: undefined, notes: '' })
    setCreateOpen(true)
  }

  async function onSubmit(values: ProductionOrderFormValues) {
    await createMutation.mutateAsync(values)
    reset()
    setCreateOpen(false)
  }

  if (isLoading) return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} disabled={prepRecipes.length === 0}>
          <Plus className="mr-2 h-4 w-4" />New production order
        </Button>
      </div>

      {prepRecipes.length === 0 ? (
        <EmptyState icon={ClipboardList} message="Add a prep recipe first, then you can order production against it." />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          message="No production orders yet — order a target quantity and it'll wait in the assigned queue (or yours, if outside)."
          action={{ label: 'New production order', onClick: openCreate }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map((order) => (
            <ProductionOrderCard
              key={order.id}
              order={order}
              onFulfill={setFulfillTarget}
              onCancel={(o) => cancelMutation.mutate(o.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) reset() }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New production order</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Recipe</Label>
              <Select value={prepRecipeId || null} onValueChange={(v) => v && setValue('prepRecipeId', v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="What to produce" /></SelectTrigger>
                <SelectContent>
                  {prepRecipes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.outputItem.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.prepRecipeId && <p className="text-xs text-destructive">{errors.prepRecipeId.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Target quantity</Label>
              <Input type="number" step="0.01" placeholder="50" {...register('targetQuantity')} />
              {errors.targetQuantity && <p className="text-xs text-destructive">{errors.targetQuantity.message}</p>}
            </div>

            {!!prepRecipeId && targetQuantity > 0 && (
              previewLoading ? <Skeleton className="h-12 w-full" /> : preview && preview.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
                  <span className="text-xs font-medium text-foreground">
                    Ingredients needed
                    {source === 'outside' && <span className="text-muted-foreground"> — given to the third party now</span>}
                    {shortages.length > 0 && <span className="text-destructive"> — short on {shortages.length}</span>}
                  </span>
                  {preview.map((p) => {
                    const short = p.available < p.needed
                    return (
                      <div key={p.inputItemId} className={`flex items-center justify-between text-xs ${short ? 'text-destructive' : 'text-muted-foreground'}`}>
                        <span>{p.name}</span>
                        <span>
                          {p.needed.toFixed(2)} {p.unit} <span className={short ? '' : 'text-muted-foreground'}>({p.available.toFixed(2)} available)</span>
                          <span className="ml-1.5 text-muted-foreground">· {rwf(p.lineCost)}</span>
                        </span>
                      </div>
                    )
                  })}
                  {totalCost != null && (
                    <div className="flex items-center justify-between border-t border-border pt-1.5 text-xs font-medium text-foreground">
                      <span>Estimated ingredient cost</span>
                      <span>
                        {rwf(totalCost)}
                        {targetQuantity > 0 && outputUnit && (
                          <span className="ml-1 font-normal text-muted-foreground">({rwf(totalCost / targetQuantity)}/{outputUnit})</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Source</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={source === 'internal' ? 'default' : 'outline'} onClick={() => setValue('source', 'internal')}>
                  <Home className="mr-1.5 h-3.5 w-3.5" />In-house
                </Button>
                <Button type="button" variant={source === 'outside' ? 'default' : 'outline'} onClick={() => setValue('source', 'outside')}>
                  <Truck className="mr-1.5 h-3.5 w-3.5" />Outside
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {source === 'outside'
                  ? 'Deducts the ingredients above right away (given to the third party) — then waits for you to record their delivery.'
                  : 'Nothing is deducted yet — goes straight to the assigned role\'s pending queue, consumed once they actually produce it.'}
              </p>
            </div>

            {source === 'internal' && (
              <div className="flex flex-col gap-1.5">
                <Label>Assign to</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={assignedTeam === 'kitchen' ? 'default' : 'outline'} onClick={() => setValue('assignedTeam', 'kitchen')}>
                    Kitchen
                  </Button>
                  <Button type="button" variant={assignedTeam === 'waiter' ? 'default' : 'outline'} onClick={() => setValue('assignedTeam', 'waiter')}>
                    Waiter
                  </Button>
                </div>
                {errors.assignedTeam && <p className="text-xs text-destructive">{errors.assignedTeam.message}</p>}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea placeholder="e.g. needed for Saturday's event" {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); setCreateOpen(false) }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <FulfillProductionOrderDialog order={fulfillTarget} onClose={() => setFulfillTarget(null)} />
    </div>
  )
}

export default function RecipesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Recipes" description="Ingredient bills of materials, cost margins, and in-house production" />

      <Tabs defaultValue="menu">
        <TabsList>
          <TabsTrigger value="menu">Menu items</TabsTrigger>
          <TabsTrigger value="prep">Prep &amp; batch recipes</TabsTrigger>
          <TabsTrigger value="orders">Production orders</TabsTrigger>
        </TabsList>
        <TabsContent value="menu" className="mt-4">
          <MenuRecipesTab />
        </TabsContent>
        <TabsContent value="prep" className="mt-4">
          <PrepRecipesTab />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <ProductionOrdersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
