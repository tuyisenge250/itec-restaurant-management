import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createMenuItemSchema, updateMenuItemSchema } from '@/lib/validation/menu.schema'

export type MenuItem = {
  id: string; name: string; categoryId: string | null; category: { name: string } | null
  price: number; preparationCost: number
  isAvailable: boolean; createdAt: string; updatedAt: string
  recipeItems: { inventoryItemId: string; quantity: number; inventoryItem: { name: string; currentStock: number } }[]
}
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>

export const getMenu = () => apiFetch<MenuItem[]>('/api/menu')
export const createMenuItem = (data: CreateMenuItemInput) =>
  apiFetch<MenuItem>('/api/menu', { method: 'POST', body: JSON.stringify(data) })
export const updateMenuItem = (id: string, data: UpdateMenuItemInput) =>
  apiFetch<MenuItem>(`/api/menu/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteMenuItem = (id: string) =>
  apiFetch<void>(`/api/menu/${id}`, { method: 'DELETE' })

export function useMenu() {
  return useQuery({ queryKey: ['menu'], queryFn: getMenu })
}
export function useCreateMenuItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createMenuItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu'] }); toast.success('Menu item added') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateMenuItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateMenuItem>[1] }) =>
      updateMenuItem(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu'] }); toast.success('Menu item updated') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useDeleteMenuItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu'] }); toast.success('Menu item removed') },
    onError: (e: Error) => toast.error(e.message),
  })
}
