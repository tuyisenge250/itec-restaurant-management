import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createPrepRecipeSchema, producePrepRecipeSchema } from '@/lib/validation/prep-recipe.schema'

export type PrepRecipe = {
  id: string
  outputItemId: string
  outputItem: { id: string; name: string; unit: string; itemType: 'raw' | 'prepared' | 'finished_good' }
  yieldQuantity: number
  batchInputNote: string | null
  createdAt: string
  updatedAt: string
  inputs: {
    id: string
    inputItemId: string
    quantity: number
    inputItem: { id: string; name: string; unit: string }
  }[]
}

export type CreatePrepRecipeInput = z.infer<typeof createPrepRecipeSchema>
export type ProducePrepRecipeInput = z.infer<typeof producePrepRecipeSchema>
export type PrepProductionRun = {
  id: string
  prepRecipeId: string
  quantityProduced: number
  source: 'internal' | 'outside'
  laborCost: number
  outsideCost: number | null
  producedLotId: string
  recordedById: string
  createdAt: string
}

export const getPrepRecipes = () => apiFetch<PrepRecipe[]>('/api/prep-recipes')
export const createPrepRecipe = (data: CreatePrepRecipeInput) =>
  apiFetch<PrepRecipe>('/api/prep-recipes', { method: 'POST', body: JSON.stringify(data) })
export const producePrepRecipe = (id: string, data: ProducePrepRecipeInput) =>
  apiFetch<PrepProductionRun>(`/api/prep-recipes/${id}/produce`, { method: 'POST', body: JSON.stringify(data) })

export function usePrepRecipes() {
  return useQuery({ queryKey: ['prep-recipes'], queryFn: getPrepRecipes })
}
export function useCreatePrepRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPrepRecipe,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prep-recipes'] }); toast.success('Prep recipe created') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useProducePrepRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProducePrepRecipeInput }) => producePrepRecipe(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prep-recipes'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Production run recorded')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
