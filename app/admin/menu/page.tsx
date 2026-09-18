'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, UtensilsCrossed, Loader2, Trash2, Pencil, FolderPlus, ChefHat, Zap } from 'lucide-react'
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
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useMenu, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem, type MenuItem } from '@/lib/api/menu'
import { useInventory } from '@/lib/api/inventory'
import { useMenuCategories, useCreateMenuCategory, useDeleteMenuCategory } from '@/lib/api/menu-categories'
import { useUpdateRecipe } from '@/lib/api/recipes'
import { rwf } from '@/lib/utils'

const itemSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().optional(),
  price: z.coerce.number().positive(),
  preparationCost: z.coerce.number().nonnegative(),
  requiresPreparation: z.boolean(),
  recipe: z.array(z.object({
    inventoryItemId: z.string().min(1),
    quantity: z.coerce.number().positive(),
  })).min(1, 'At least one ingredient required'),
})
type ItemFormValues = z.infer<typeof itemSchema>

const categorySchema = z.object({ name: z.string().min(1) })
type CategoryFormValues = z.infer<typeof categorySchema>

function unavailableReason(item: MenuItem): string {
  const short = item.recipeItems.find((r) => r.inventoryItem.currentStock < r.quantity)
  return short
    ? `Not enough ${short.inventoryItem.name} in stock (need ${short.quantity}, have ${short.inventoryItem.currentStock})`
    : 'One or more ingredients are out of stock'
}

export default function MenuPage() {
  const [itemOpen, setItemOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)

  const { data: menuItems = [], isLoading } = useMenu()
  const { data: categories = [] } = useMenuCategories()
  const { data: inventory = [] } = useInventory()
  const createMutation = useCreateMenuItem()
  const updateMutation = useUpdateMenuItem()
  const deleteMutation = useDeleteMenuItem()
  const updateRecipeMutation = useUpdateRecipe()
  const createCategoryMutation = useCreateMenuCategory()
  const deleteCategoryMutation = useDeleteMenuCategory()

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: { preparationCost: 0, requiresPreparation: true, recipe: [{ inventoryItemId: '', quantity: 0 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'recipe' })
  const categoryId = watch('categoryId')

  const categoryForm = useForm<CategoryFormValues>({ resolver: zodResolver(categorySchema) })

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', categoryId: undefined, price: 0, preparationCost: 0, requiresPreparation: true, recipe: [{ inventoryItemId: '', quantity: 0 }] })
    setItemOpen(true)
  }

  function openEdit(item: MenuItem) {
    setEditingItem(item)
    reset({
      name: item.name,
      categoryId: item.categoryId ?? undefined,
      price: item.price,
      preparationCost: item.preparationCost,
      requiresPreparation: item.requiresPreparation,
      recipe: item.recipeItems.map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity })),
    })
    setItemOpen(true)
  }

  async function onSubmit(values: ItemFormValues) {
    if (editingItem) {
      await updateMutation.mutateAsync({
        id: editingItem.id,
        data: {
          name: values.name, categoryId: values.categoryId ?? null, price: values.price,
          preparationCost: values.preparationCost, requiresPreparation: values.requiresPreparation,
        },
      })
      await updateRecipeMutation.mutateAsync({ menuItemId: editingItem.id, data: { ingredients: values.recipe } })
    } else {
      await createMutation.mutateAsync(values)
    }
    reset()
    setItemOpen(false)
    setEditingItem(null)
  }

  async function onCreateCategory(values: CategoryFormValues) {
    await createCategoryMutation.mutateAsync({ name: values.name, sortOrder: categories.length })
    categoryForm.reset()
  }

  const isSaving = createMutation.isPending || updateMutation.isPending || updateRecipeMutation.isPending

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Menu" description="Manage available menu items"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCategoryOpen(true)}><FolderPlus className="mr-2 h-4 w-4" />Categories</Button>
            <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add menu item</Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : menuItems.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} message="No menu items yet." action={{ label: 'Add menu item', onClick: openCreate }} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {menuItems.map((item) => (
            <Card key={item.id} className={!item.isAvailable ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground leading-tight">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.category?.name ?? 'Uncategorized'}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {item.requiresPreparation
                        ? <><ChefHat className="h-3 w-3" />Kitchen</>
                        : <><Zap className="h-3 w-3" />Direct serve</>}
                    </span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Badge className={item.isAvailable ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'} />
                      }
                    >
                      {item.isAvailable ? 'In stock' : 'Out of stock'}
                    </TooltipTrigger>
                    {!item.isAvailable && <TooltipContent>{unavailableReason(item)}</TooltipContent>}
                  </Tooltip>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-semibold text-foreground">{rwf(item.price)}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(item)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={itemOpen} onOpenChange={(o) => { setItemOpen(o); if (!o) { reset(); setEditingItem(null) } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit menu item' : 'Add menu item'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input placeholder="Margherita Pizza" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select value={categoryId ?? null} onValueChange={(v) => setValue('categoryId', v ?? undefined)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Price</Label>
                <Input type="number" step="0.01" placeholder="12.50" {...register('price')} />
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Preparation cost <span className="text-muted-foreground">(separate from ingredient cost)</span></Label>
              <Input type="number" step="0.01" placeholder="0.50" {...register('preparationCost')} />
              {errors.preparationCost && <p className="text-xs text-destructive">{errors.preparationCost.message}</p>}
            </div>
            <label className="flex items-start gap-2.5 rounded-md border border-border p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                {...register('requiresPreparation')}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">Send to kitchen</span>
                <span className="text-xs text-muted-foreground">
                  On: goes through a kitchen ticket before it can be served (a cooked dish). Off: served
                  immediately by the waiter with no kitchen step (a Coke, bottled water, pre-made dessert).
                </span>
              </span>
            </label>
            <div className="flex flex-col gap-2">
              <Label>Recipe ingredients</Label>
              {fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-[1fr_100px_32px] gap-2">
                  <Select
                    value={watch(`recipe.${i}.inventoryItemId`) || null}
                    onValueChange={(v) => v && setValue(`recipe.${i}.inventoryItemId`, v)}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Ingredient" /></SelectTrigger>
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
              <Button type="button" variant="outline" onClick={() => { reset(); setItemOpen(false); setEditingItem(null) }}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Menu categories</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2">
            {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm">{c.name}</span>
                <Button
                  size="icon" variant="ghost"
                  onClick={() => deleteCategoryMutation.mutate(c.id)}
                  disabled={deleteCategoryMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <form onSubmit={categoryForm.handleSubmit(onCreateCategory)} className="flex gap-2 pt-2">
            <Input placeholder="New category name" {...categoryForm.register('name')} />
            <Button type="submit" disabled={createCategoryMutation.isPending}>Add</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Menu items that already have order history can&apos;t be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
