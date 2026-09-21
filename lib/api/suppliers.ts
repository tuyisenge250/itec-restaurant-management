import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createSupplierSchema } from '@/lib/validation/purchase-order.schema'

export type Supplier = {
  id: string; name: string; phone: string | null; email: string | null
  address: string | null; paymentTerms: string | null; isActive: boolean; createdAt: string
}
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>

export type SupplierHistoryOrder = {
  id: string
  status: 'draft' | 'pending_approval' | 'ordered' | 'partially_received' | 'received' | 'cancelled'
  createdAt: string
  orderedValue: number
  receivedValue: number
  paidValue: number
  owed: number
}
export type SupplierHistory = {
  supplier: { id: string; name: string; paymentTerms: string | null }
  orders: SupplierHistoryOrder[]
  totals: { orderedValue: number; receivedValue: number; paidValue: number; owed: number }
}

export const getSuppliers = () => apiFetch<Supplier[]>('/api/suppliers')
export const getSupplierHistory = (id: string) => apiFetch<SupplierHistory>(`/api/suppliers/${id}/history`)
export const createSupplier = (data: CreateSupplierInput) =>
  apiFetch<Supplier>('/api/suppliers', { method: 'POST', body: JSON.stringify(data) })
export const updateSupplier = (id: string, data: Partial<CreateSupplierInput & { isActive: boolean }>) =>
  apiFetch<Supplier>(`/api/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteSupplier = (id: string) =>
  apiFetch<void>(`/api/suppliers/${id}`, { method: 'DELETE' })

export function useSuppliers() {
  return useQuery({ queryKey: ['suppliers'], queryFn: getSuppliers })
}
export function useSupplierHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['suppliers', id, 'history'],
    queryFn: () => getSupplierHistory(id!),
    enabled: !!id,
  })
}
export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createSupplier,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Supplier added') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSupplierInput & { isActive: boolean }> }) =>
      updateSupplier(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Supplier updated') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Supplier removed') },
    onError: (e: Error) => toast.error(e.message),
  })
}
