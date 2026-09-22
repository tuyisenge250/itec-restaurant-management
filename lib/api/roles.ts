import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createRoleSchema, updateRoleSchema } from '@/lib/validation/role.schema'

export type HomeArea = 'admin' | 'kitchen' | 'waiter' | 'cashier'
export type Role = {
  id: string
  name: string
  homeArea: HomeArea
  permissions: string[]
  maxDiscountPercent: number
  createdAt: string
  updatedAt: string
}

export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>

export const getRoles = () => apiFetch<Role[]>('/api/roles')
export const createRole = (data: CreateRoleInput) =>
  apiFetch<Role>('/api/roles', { method: 'POST', body: JSON.stringify(data) })
export const updateRole = (id: string, data: UpdateRoleInput) =>
  apiFetch<Role>(`/api/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteRole = (id: string) =>
  apiFetch<void>(`/api/roles/${id}`, { method: 'DELETE' })

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: getRoles })
}
export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role created') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoleInput }) => updateRole(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('Role updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role deleted') },
    onError: (e: Error) => toast.error(e.message),
  })
}
