import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import {
  createProductionOrderSchema,
  fulfillProductionOrderSchema,
} from '@/lib/validation/prep-production-order.schema'
import type { PrepProductionRun } from './prep-recipes'

export type ProductionOrderStatus = 'pending' | 'fulfilled' | 'cancelled'
export type ProductionSource = 'internal' | 'outside'
export type ProductionAssignedRole = 'kitchen' | 'waiter'

export type ProductionOrder = {
  id: string
  prepRecipeId: string
  prepRecipe: { outputItem: { name: string; unit: string } }
  targetQuantity: number
  source: ProductionSource
  assignedRole: ProductionAssignedRole | null
  reservedIngredientCost: number | null
  status: ProductionOrderStatus
  notes: string | null
  createdById: string
  createdBy: { name: string }
  createdAt: string
  fulfillment: { id: string; quantityProduced: number; recordedById: string; createdAt: string } | null
}

export type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>
export type FulfillProductionOrderInput = z.infer<typeof fulfillProductionOrderSchema>
export type IngredientPreviewLine = {
  inputItemId: string
  name: string
  unit: string
  needed: number
  available: number
  lineCost: number
}

export type ProductionOrderFilters = {
  status?: ProductionOrderStatus
  source?: ProductionSource
  assignedRole?: ProductionAssignedRole
}

export const getProductionOrders = (filters?: ProductionOrderFilters) => {
  const qs = new URLSearchParams(Object.entries(filters ?? {}).filter(([, v]) => !!v) as [string, string][]).toString()
  return apiFetch<ProductionOrder[]>(`/api/production-orders${qs ? `?${qs}` : ''}`)
}
export const createProductionOrder = (data: CreateProductionOrderInput) =>
  apiFetch<ProductionOrder>('/api/production-orders', { method: 'POST', body: JSON.stringify(data) })
export const fulfillProductionOrder = (id: string, data: FulfillProductionOrderInput) =>
  apiFetch<PrepProductionRun>(`/api/production-orders/${id}/fulfill`, { method: 'POST', body: JSON.stringify(data) })
export const cancelProductionOrder = (id: string) =>
  apiFetch<ProductionOrder>(`/api/production-orders/${id}/cancel`, { method: 'POST' })
export const getIngredientPreview = (prepRecipeId: string, targetQuantity: number) =>
  apiFetch<IngredientPreviewLine[]>(`/api/prep-recipes/${prepRecipeId}/preview?targetQuantity=${targetQuantity}`)

export function useProductionOrders(filters?: ProductionOrderFilters) {
  return useQuery({ queryKey: ['production-orders', filters], queryFn: () => getProductionOrders(filters) })
}
export function useIngredientPreview(prepRecipeId: string | undefined, targetQuantity: number) {
  return useQuery({
    queryKey: ['prep-recipes', prepRecipeId, 'preview', targetQuantity],
    queryFn: () => getIngredientPreview(prepRecipeId!, targetQuantity),
    enabled: !!prepRecipeId && targetQuantity > 0,
  })
}
export function useCreateProductionOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProductionOrder,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }); toast.success('Production order created') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useFulfillProductionOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FulfillProductionOrderInput }) => fulfillProductionOrder(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-orders'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Production order fulfilled')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useCancelProductionOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelProductionOrder,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }); toast.success('Production order cancelled') },
    onError: (e: Error) => toast.error(e.message),
  })
}
