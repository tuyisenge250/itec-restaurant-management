import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createPurchaseOrderSchema, receivePurchaseOrderSchema } from '@/lib/validation/purchase-order.schema'

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled'
export type PurchaseOrder = {
  id: string; status: PurchaseOrderStatus; createdAt: string
  supplier: { name: string }
  items: { id: string; inventoryItemId: string; quantityOrdered: number; quantityReceived: number; unitCost: number; inventoryItem: { name: string; unit: string } }[]
}
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>

export const getPurchaseOrders = () => apiFetch<PurchaseOrder[]>('/api/purchase-orders')
export const getPurchaseOrder = (id: string) => apiFetch<PurchaseOrder>(`/api/purchase-orders/${id}`)
export const createPurchaseOrder = (data: CreatePurchaseOrderInput) =>
  apiFetch<PurchaseOrder>('/api/purchase-orders', { method: 'POST', body: JSON.stringify(data) })
export const receivePurchaseOrder = (id: string, data: ReceivePurchaseOrderInput) =>
  apiFetch<PurchaseOrder>(`/api/purchase-orders/${id}/recieve`, { method: 'POST', body: JSON.stringify(data) })

export function usePurchaseOrders() {
  return useQuery({ queryKey: ['purchase-orders'], queryFn: getPurchaseOrders })
}
export function useCreatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); toast.success('Purchase order created') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useReceivePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReceivePurchaseOrderInput }) => receivePurchaseOrder(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Goods received')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
