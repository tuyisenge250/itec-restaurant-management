import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createMenuCategorySchema, updateMenuCategorySchema } from '@/lib/validation/menu.schema'

export type MenuCategory = { id: string; name: string; sortOrder: number }
export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>

export const getMenuCategories = () => apiFetch<MenuCategory[]>('/api/menu-categories')
export const createMenuCategory = (data: CreateMenuCategoryInput) =>
  apiFetch<MenuCategory>('/api/menu-categories', { method: 'POST', body: JSON.stringify(data) })
export const updateMenuCategory = (id: string, data: UpdateMenuCategoryInput) =>
  apiFetch<MenuCategory>(`/api/menu-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteMenuCategory = (id: string) =>
  apiFetch<void>(`/api/menu-categories/${id}`, { method: 'DELETE' })

export function useMenuCategories() {
  return useQuery({ queryKey: ['menu-categories'], queryFn: getMenuCategories })
}
export function useCreateMenuCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createMenuCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-categories'] }); toast.success('Category added') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateMenuCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMenuCategoryInput }) => updateMenuCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-categories'] }); toast.success('Category updated') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useDeleteMenuCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteMenuCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-categories'] }); toast.success('Category removed') },
    onError: (e: Error) => toast.error(e.message),
  })
}
