'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, BookOpen, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { useMenu } from '@/lib/api/menu'
import { useRecipe } from '@/lib/api/recipes'
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

export default function RecipesPage() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data: menuItems = [], isLoading } = useMenu()

  if (isLoading) return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Recipes" description="Ingredient bills of materials and cost margins" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Recipes" description="Ingredient bills of materials and cost margins" />

      {menuItems.length === 0 ? (
        <EmptyState icon={BookOpen} message="No recipes yet. Add a menu item with ingredients." />
      ) : (
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
      )}
    </div>
  )
}
