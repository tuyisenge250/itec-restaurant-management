import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'

export type MenuItem = {
  id: string; name: string; category: string | null; price: number
  isAvailable: boolean; createdAt: string; updatedAt: string
}
export type CreateMenuItemInput = {
  name: string; category?: string; price: number
  recipe: { inventoryItemId: string; quantity: number }[]
}

export const getMenu = () => apiFetch<MenuItem[]>('/api/menu')
export const createMenuItem = (data: CreateMenuItemInput) =>
  apiFetch<MenuItem>('/api/menu', { method: 'POST', body: JSON.stringify(data) })
export const updateMenuItem = (id: string, data: Partial<Omit<CreateMenuItemInput, 'recipe'> & { isAvailable: boolean }>) =>
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
