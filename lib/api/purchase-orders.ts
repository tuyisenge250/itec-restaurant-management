import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import {
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
  recordSupplierPaymentSchema,
} from '@/lib/validation/purchase-order.schema'

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled'
export type PurchaseOrder = {
  id: string; status: PurchaseOrderStatus; createdAt: string
  supplier: { name: string }
  items: { id: string; inventoryItemId: string; quantityOrdered: number; quantityReceived: number; unitCost: number; inventoryItem: { name: string; unit: string } }[]
}
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>
export type UpdatePurchaseOrderStatusInput = z.infer<typeof updatePurchaseOrderStatusSchema>
export type RecordSupplierPaymentInput = z.infer<typeof recordSupplierPaymentSchema>
export type SupplierPayment = {
  id: string
  amount: number
  method: 'cash' | 'card' | 'momo' | 'other'
  notes: string | null
  createdAt: string
  recordedBy: { name: string }
}

export type PurchaseOrderDetail = PurchaseOrder & {
  notes: string | null
  createdById: string
  createdBy: { name: string }
  approvedById: string | null
  approvedBy: { name: string } | null
  approvedAt: string | null
  reorderedFromId: string | null
  reorderedFrom: { id: string; createdAt: string } | null
  goodsReceipts: {
    id: string
    receivedAt: string
    notes: string | null
    receivedBy: { name: string }
    lines: {
      id: string
      quantityReceived: number
      unitCost: number
      costingMethod: 'fifo' | 'lifo'
      purchaseOrderItem: { inventoryItem: { name: string; unit: string } }
    }[]
  }[]
  payments: SupplierPayment[]
  auditLog: {
    id: string
    action: string
    createdAt: string
    user: { name: string } | null
    beforeData: unknown
    afterData: unknown
  }[]
}

export const getPurchaseOrders = () => apiFetch<PurchaseOrder[]>('/api/purchase-orders')
export const getPurchaseOrder = (id: string) => apiFetch<PurchaseOrderDetail>(`/api/purchase-orders/${id}`)
export const createPurchaseOrder = (data: CreatePurchaseOrderInput) =>
  apiFetch<PurchaseOrder>('/api/purchase-orders', { method: 'POST', body: JSON.stringify(data) })
export const receivePurchaseOrder = (id: string, data: ReceivePurchaseOrderInput) =>
  apiFetch<PurchaseOrder>(`/api/purchase-orders/${id}/receive`, { method: 'POST', body: JSON.stringify(data) })
export const updatePurchaseOrderStatus = (id: string, data: UpdatePurchaseOrderStatusInput) =>
  apiFetch<PurchaseOrder>(`/api/purchase-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) })
export const reorderPurchaseOrder = (id: string) =>
  apiFetch<PurchaseOrder>(`/api/purchase-orders/${id}/reorder`, { method: 'POST' })
export const recordSupplierPayment = (id: string, data: RecordSupplierPaymentInput) =>
  apiFetch<SupplierPayment>(`/api/purchase-orders/${id}/payments`, { method: 'POST', body: JSON.stringify(data) })

export function usePurchaseOrders() {
  return useQuery({ queryKey: ['purchase-orders'], queryFn: getPurchaseOrders })
}
export function usePurchaseOrder(id: string | undefined) {
  return useQuery({ queryKey: ['purchase-orders', id], queryFn: () => getPurchaseOrder(id!), enabled: !!id })
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
export function useUpdatePurchaseOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePurchaseOrderStatusInput }) =>
      updatePurchaseOrderStatus(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); toast.success('Purchase order updated') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useReorderPurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reorderPurchaseOrder,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); toast.success('Reorder draft created') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useRecordSupplierPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecordSupplierPaymentInput }) => recordSupplierPayment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Payment recorded')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
