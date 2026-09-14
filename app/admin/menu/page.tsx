'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, UtensilsCrossed, Loader2, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useMenu, useCreateMenuItem, useUpdateMenuItem } from '@/lib/api/menu'
import { useInventory } from '@/lib/api/inventory'

const schema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  price: z.coerce.number().positive(),
  recipe: z.array(z.object({
    inventoryItemId: z.string().min(1),
    quantity: z.coerce.number().positive(),
  })).min(1, 'At least one ingredient required'),
})
type FormValues = z.infer<typeof schema>

export default function MenuPage() {
  const [open, setOpen] = useState(false)
  const { data: menuItems = [], isLoading } = useMenu()
  const { data: inventory = [] } = useInventory()
  const createMutation = useCreateMenuItem()
  const updateMutation = useUpdateMenuItem()

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { recipe: [{ inventoryItemId: '', quantity: 0 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'recipe' })

  async function onSubmit(values: FormValues) {
    await createMutation.mutateAsync(values)
    reset()
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Menu" description="Manage available menu items"
        action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add menu item</Button>}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : menuItems.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} message="No menu items yet." action={{ label: 'Add menu item', onClick: () => setOpen(true) }} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {menuItems.map((item) => (
            <Card key={item.id} className={!item.isAvailable ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground leading-tight">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.category ?? '—'}</span>
                  </div>
                  <button
                    onClick={() => updateMutation.mutate({ id: item.id, data: { isAvailable: !item.isAvailable } })}
                    className="shrink-0"
                  >
                    <Badge className={item.isAvailable ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}>
                      {item.isAvailable ? 'On' : 'Off'}
                    </Badge>
                  </button>
                </div>
                <div className="mt-3">
                  <span className="text-lg font-semibold text-foreground">${item.price.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add menu item</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input placeholder="Margherita Pizza" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select onValueChange={(v) => setValue('category', v)}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Starter">Starter</SelectItem>
                    <SelectItem value="Main">Main</SelectItem>
                    <SelectItem value="Dessert">Dessert</SelectItem>
                    <SelectItem value="Drinks">Drinks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Price ($)</Label>
                <Input type="number" step="0.01" placeholder="12.50" {...register('price')} />
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Recipe ingredients</Label>
              {fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-[1fr_100px_32px] gap-2">
                  <Select onValueChange={(v) => setValue(`recipe.${i}.inventoryItemId`, v)}>
                    <SelectTrigger><SelectValue placeholder="Ingredient" /></SelectTrigger>
                    <SelectContent>
                      {inventory.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" step="0.01" placeholder="Qty" {...register(`recipe.${i}.quantity`)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              {errors.recipe && <p className="text-xs text-destructive">{errors.recipe.message ?? errors.recipe.root?.message}</p>}
              <Button type="button" variant="outline" size="sm" className="w-fit"
                onClick={() => append({ inventoryItemId: '', quantity: 0 })}>
                <Plus className="mr-1 h-3 w-3" /> Add ingredient
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); setOpen(false) }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
