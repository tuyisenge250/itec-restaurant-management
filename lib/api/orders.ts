import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import {
  createOrderSchema,
  updateOrderItemsSchema,
  updateOrderStatusSchema,
  splitOrderSchema,
  mergeOrderSchema,
  applyDiscountSchema,
  voidOrderItemSchema,
} from '@/lib/validation/order.schema'
import type { RefundRequest } from '@/lib/api/payments'

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'
export type Order = {
  id: string; table: string; status: OrderStatus; createdById: string
  createdBy: { name: string }
  startedById: string | null; startedAt: string | null
  startedBy: { name: string } | null
  discountPercent: number | null; discountAmount: number | null; discountReason: string | null
  createdAt: string; updatedAt: string
  items: {
    id: string; menuItemId: string; quantity: number; priceAtSale: number; costAtSale: number
    isVoided: boolean; voidReason: string | null
    voidedById: string | null; voidedAt: string | null
    preparedById: string | null; preparedAt: string | null
    preparedBy: { name: string } | null
    voidedBy: { name: string } | null
    menuItem: { name: string }
  }[]
}

// The admin order-operations page needs more than the base Order shape:
// full payment + refund history.
export type OrderDetail = Order & {
  payments: {
    id: string; method: 'cash' | 'card' | 'momo' | 'other'
    amount: number; discount: number; notes: string | null; createdAt: string
    recordedBy: { name: string }
    refunds: { id: string; amount: number; reason: string | null; createdAt: string; recordedBy: { name: string } }[]
    refundRequests: RefundRequest[]
  }[]
}

export type OrderAuditLogEntry = {
  id: string; action: string; createdAt: string
  user: { name: string } | null
  beforeData: unknown; afterData: unknown
}
export type OrderAuditLog = { auditLog: OrderAuditLogEntry[]; stockReversedItemIds: string[] }

export type OrderFilters = { status?: string; table?: string; waiterId?: string; from?: string; to?: string }

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderItemsInput = z.infer<typeof updateOrderItemsSchema>
export type OrderStatusTarget = z.infer<typeof updateOrderStatusSchema>['status']
export type SplitOrderInput = z.infer<typeof splitOrderSchema>
export type MergeOrderInput = z.infer<typeof mergeOrderSchema>
export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>
export type VoidOrderItemInput = z.infer<typeof voidOrderItemSchema>

export const getOrders = (filters?: OrderFilters) => {
  const qs = new URLSearchParams(Object.entries(filters ?? {}).filter(([, v]) => !!v) as [string, string][]).toString()
  return apiFetch<Order[]>(`/api/orders${qs ? `?${qs}` : ''}`)
}
export const getOrder = (id: string) => apiFetch<OrderDetail>(`/api/orders/${id}`)
export const getOrderAuditLog = (id: string) => apiFetch<OrderAuditLog>(`/api/orders/${id}/audit-log`)
export function useOrderAuditLog(id: string | undefined) {
  return useQuery({ queryKey: ['orders', id, 'audit-log'], queryFn: () => getOrderAuditLog(id!), enabled: !!id })
}
export const createOrder = (data: CreateOrderInput) =>
  apiFetch<Order>('/api/orders', { method: 'POST', body: JSON.stringify(data) })
export const updateOrderItems = (id: string, data: UpdateOrderItemsInput) =>
  apiFetch<Order>(`/api/orders/${id}/items`, { method: 'PATCH', body: JSON.stringify(data) })
export const updateOrderStatus = (id: string, status: OrderStatusTarget) =>
  apiFetch<Order>(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
export const splitOrder = (id: string, data: SplitOrderInput) =>
  apiFetch<Order>(`/api/orders/${id}/split`, { method: 'POST', body: JSON.stringify(data) })
export const mergeOrder = (id: string, data: MergeOrderInput) =>
  apiFetch<Order>(`/api/orders/${id}/merge`, { method: 'POST', body: JSON.stringify(data) })
export const applyOrderDiscount = (id: string, data: ApplyDiscountInput) =>
  apiFetch<Order>(`/api/orders/${id}/discount`, { method: 'POST', body: JSON.stringify(data) })
export const voidOrderItem = (orderItemId: string, data: VoidOrderItemInput) =>
  apiFetch<Order['items'][number]>(`/api/order-items/${orderItemId}/void`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export type OrderCogsBreakdown = {
  orderId: string
  items: {
    orderItemId: string
    menuItemName: string
    quantity: number
    costAtSale: number
    isVoided: boolean
    lots: { type: string; inventoryItemName: string; unit: string; quantity: number; unitCost: number; reasonCode: string | null }[]
  }[]
}
export const getOrderCogs = (id: string) => apiFetch<OrderCogsBreakdown>(`/api/orders/${id}/cogs`)
export function useOrderCogs(id: string | undefined) {
  return useQuery({ queryKey: ['orders', id, 'cogs'], queryFn: () => getOrderCogs(id!), enabled: !!id })
}

export function useOrders(options?: { refetchInterval?: number; filters?: OrderFilters }) {
  return useQuery({
    queryKey: ['orders', options?.filters],
    queryFn: () => getOrders(options?.filters),
    refetchInterval: options?.refetchInterval,
  })
}
export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: ['orders', id], queryFn: () => getOrder(id!), enabled: !!id })
}
export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order created') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateOrderItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrderItemsInput }) => updateOrderItems(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order updated') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatusTarget }) => updateOrderStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Order updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useSplitOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SplitOrderInput }) => splitOrder(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order split') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useMergeOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MergeOrderInput }) => mergeOrder(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Orders merged') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useApplyOrderDiscount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApplyDiscountInput }) => applyOrderDiscount(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Discount applied') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useVoidOrderItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderItemId, data }: { orderItemId: string; data: VoidOrderItemInput }) =>
      voidOrderItem(orderItemId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Item voided')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
