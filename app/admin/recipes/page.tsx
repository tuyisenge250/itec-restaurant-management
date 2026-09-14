'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Card, CardContent } from '@/components/ui/card'

const recipes = [
  {
    id: '1', name: 'Margherita Pizza', category: 'Main', price: 12.50,
    ingredients: [
      { name: 'Flour',        qty: 0.3,  unit: 'kg', cost: 0.36 },
      { name: 'Cheese',       qty: 0.2,  unit: 'kg', cost: 1.30 },
      { name: 'Tomato sauce', qty: 0.15, unit: 'l',  cost: 0.30 },
    ],
  },
  {
    id: '2', name: 'Pasta Carbonara', category: 'Main', price: 10.00,
    ingredients: [
      { name: 'Flour',   qty: 0.2,  unit: 'kg', cost: 0.24 },
      { name: 'Cheese',  qty: 0.15, unit: 'kg', cost: 0.98 },
      { name: 'Chicken', qty: 0.1,  unit: 'kg', cost: 0.48 },
    ],
  },
  {
    id: '3', name: 'Grilled Chicken', category: 'Main', price: 14.00,
    ingredients: [
      { name: 'Chicken',   qty: 0.3,  unit: 'kg', cost: 1.44 },
      { name: 'Olive oil', qty: 0.02, unit: 'l',  cost: 0.07 },
      { name: 'Salt',      qty: 0.01, unit: 'kg', cost: 0.003 },
    ],
  },
]

export default function RecipesPage() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Recipes" description="Ingredient bills of materials and cost margins" />

      {recipes.length === 0 ? (
        <EmptyState icon={BookOpen} message="No recipes yet. Add a menu item with ingredients." />
      ) : (
        <div className="flex flex-col gap-2">
          {recipes.map((recipe) => {
            const totalCost = recipe.ingredients.reduce((s, i) => s + i.cost, 0)
            const margin    = ((recipe.price - totalCost) / recipe.price) * 100
            const isOpen    = expanded === recipe.id

            return (
              <Card key={recipe.id} className="overflow-hidden">
                <button
                  className="flex w-full items-center justify-between px-5 py-4 hover:bg-accent transition-colors"
                  onClick={() => setExpanded(isOpen ? null : recipe.id)}
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-medium text-foreground">{recipe.name}</span>
                    <span className="text-sm text-muted-foreground">{recipe.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">Cost ${totalCost.toFixed(2)}</span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">Price ${recipe.price.toFixed(2)}</span>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${margin >= 60 ? 'bg-success text-success-foreground' : margin >= 40 ? 'bg-warning text-warning-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                      {margin.toFixed(0)}% margin
                    </span>
                  </div>
                </button>

                {isOpen && (
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
                        {recipe.ingredients.map((ing) => (
                          <tr key={ing.name} className="border-t border-border">
                            <td className="py-2">{ing.name}</td>
                            <td className="py-2 text-right">{ing.qty}</td>
                            <td className="py-2 text-right text-muted-foreground">{ing.unit}</td>
                            <td className="py-2 text-right">${ing.cost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
