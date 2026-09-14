import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createOrderSchema, updateOrderStatusSchema } from '@/lib/validation/order.schema'

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'
export type Order = {
  id: string; tableNumber: string | null; status: OrderStatus
  createdAt: string; updatedAt: string
  items: { id: string; menuItemId: string; quantity: number; priceAtSale: number; costAtSale: number; menuItem: { name: string } }[]
}
export type CreateOrderInput = z.infer<typeof createOrderSchema>

export const getOrders = () => apiFetch<Order[]>('/api/orders')
export const getOrder = (id: string) => apiFetch<Order>(`/api/orders/${id}`)
export const createOrder = (data: CreateOrderInput) =>
  apiFetch<Order>('/api/orders', { method: 'POST', body: JSON.stringify(data) })
export const updateOrderStatus = (id: string, status: OrderStatus) =>
  apiFetch<Order>(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })

export function useOrders() {
  return useQuery({ queryKey: ['orders'], queryFn: getOrders })
}
export function useOrder(id: string) {
  return useQuery({ queryKey: ['orders', id], queryFn: () => getOrder(id) })
}
export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order sent to kitchen') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Order updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
