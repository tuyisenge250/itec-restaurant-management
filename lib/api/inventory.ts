import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { receiveStockSchema } from '@/lib/validation/payment.schema'

export type InventoryItem = {
  id: string; name: string; unit: string; currentStock: number
  avgUnitCost: number; reorderLevel: number; createdAt: string; updatedAt: string
}
export type CreateInventoryInput = { name: string; unit: string; reorderLevel?: number }
export type ReceiveStockInput = z.infer<typeof receiveStockSchema>

export const getInventory = () => apiFetch<InventoryItem[]>('/api/inventory')
export const createInventoryItem = (data: CreateInventoryInput) =>
  apiFetch<InventoryItem>('/api/inventory', { method: 'POST', body: JSON.stringify(data) })
export const receiveStock = (data: ReceiveStockInput) =>
  apiFetch<InventoryItem>('/api/inventory', { method: 'PUT', body: JSON.stringify(data) })
export const updateInventoryItem = (id: string, data: Partial<CreateInventoryInput>) =>
  apiFetch<InventoryItem>(`/api/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteInventoryItem = (id: string) =>
  apiFetch<void>(`/api/inventory/${id}`, { method: 'DELETE' })

export function useInventory() {
  return useQuery({ queryKey: ['inventory'], queryFn: getInventory })
}
export function useCreateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item created') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateInventoryInput> }) => updateInventoryItem(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item updated') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useReceiveStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: receiveStock,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Stock received')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useDeleteInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item deleted') },
    onError: (e: Error) => toast.error(e.message),
  })
}
