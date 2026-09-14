import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { updateRecipeSchema } from '@/lib/validation/purchase-order.schema'

export type RecipeBreakdown = {
  menuItemId: string; name: string; price: number; cost: number; margin: number
  ingredients: { name: string; quantity: number; unit: string; unitCost: number; lineCost: number }[]
}
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>

export const getRecipe = (menuItemId: string) => apiFetch<RecipeBreakdown>(`/api/recipes/${menuItemId}`)
export const updateRecipe = (menuItemId: string, data: UpdateRecipeInput) =>
  apiFetch<RecipeBreakdown>(`/api/recipes/${menuItemId}`, { method: 'PUT', body: JSON.stringify(data) })

export function useRecipe(menuItemId: string) {
  return useQuery({ queryKey: ['recipes', menuItemId], queryFn: () => getRecipe(menuItemId) })
}
export function useUpdateRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ menuItemId, data }: { menuItemId: string; data: UpdateRecipeInput }) => updateRecipe(menuItemId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recipes'] }); toast.success('Recipe updated') },
    onError: (e: Error) => toast.error(e.message),
  })
}
