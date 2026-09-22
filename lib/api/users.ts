import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'

export type UserRole = { id: string; name: string; homeArea: 'admin' | 'kitchen' | 'waiter' | 'cashier' }
export type User = { id: string; name: string; email: string; role: UserRole; isActive: boolean; createdAt: string }
export type CreateUserInput = { name: string; email: string; password: string; roleId: string }
export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'> & { password: string; isActive: boolean }>

export const getUsers = () => apiFetch<User[]>('/api/users')
export const createUser = (data: CreateUserInput) =>
  apiFetch<User>('/api/users', { method: 'POST', body: JSON.stringify(data) })
export const updateUser = (id: string, data: UpdateUserInput) =>
  apiFetch<User>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteUser = (id: string) =>
  apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' })

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: getUsers })
}
export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) => updateUser(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User updated') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted') },
    onError: (e: Error) => toast.error(e.message),
  })
}
