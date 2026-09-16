import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createPaymentSchema, refundPaymentSchema, requestRefundSchema, denyRefundRequestSchema } from '@/lib/validation/payment.schema'

export type Refund = {
  id: string; paymentId: string; amount: number; reason: string | null; createdAt: string
  recordedBy: { name: string }
}
export type RefundRequestStatus = 'pending' | 'approved' | 'denied'
export type RefundRequest = {
  id: string; paymentId: string; amount: number; reason: string
  status: RefundRequestStatus
  requestedById: string
  requestedBy: { name: string }
  reviewedBy: { name: string } | null
  reviewedAt: string | null
  denialReason: string | null
  createdAt: string
}
export type Payment = {
  id: string; orderId: string; method: 'cash' | 'card' | 'momo' | 'other'
  amount: number; discount: number; notes: string | null; createdAt: string
  recordedById: string
  recordedBy: { name: string }
  refunds: Refund[]
  refundRequests: RefundRequest[]
}
export type RefundRequestAdmin = RefundRequest & {
  payment: { id: string; orderId: string; method: string; amount: number; order: { table: string } }
}
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>
export type RequestRefundInput = z.infer<typeof requestRefundSchema>
export type DenyRefundRequestInput = z.infer<typeof denyRefundRequestSchema>

export const getPayments = (orderId: string) => apiFetch<Payment[]>(`/api/payments?orderId=${orderId}`)
export const createPayment = (data: CreatePaymentInput) =>
  apiFetch<Payment>('/api/payments', { method: 'POST', body: JSON.stringify(data) })
export const refundPayment = (paymentId: string, data: RefundPaymentInput) =>
  apiFetch<Payment>(`/api/payments/${paymentId}/refund`, { method: 'POST', body: JSON.stringify(data) })
export const requestRefund = (paymentId: string, data: RequestRefundInput) =>
  apiFetch<RefundRequest>(`/api/payments/${paymentId}/refund-requests`, { method: 'POST', body: JSON.stringify(data) })
export const getRefundRequests = (status?: RefundRequestStatus) =>
  apiFetch<RefundRequestAdmin[]>(`/api/refund-requests${status ? `?status=${status}` : ''}`)
export const approveRefundRequest = (id: string) =>
  apiFetch<RefundRequest>(`/api/refund-requests/${id}/approve`, { method: 'POST' })
export const denyRefundRequest = (id: string, data: DenyRefundRequestInput) =>
  apiFetch<RefundRequest>(`/api/refund-requests/${id}/deny`, { method: 'POST', body: JSON.stringify(data) })

export function usePayments(orderId: string | undefined) {
  return useQuery({ queryKey: ['payments', orderId], queryFn: () => getPayments(orderId!), enabled: !!orderId })
}
export function useCreatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPayment,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['payments', vars.orderId] })
      toast.success('Payment recorded')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useRefundPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: string; data: RefundPaymentInput }) =>
      refundPayment(paymentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Refund recorded')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useRequestRefund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: string; data: RequestRefundInput }) =>
      requestRefund(paymentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Refund request submitted for admin approval')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useRefundRequests(status?: RefundRequestStatus) {
  return useQuery({ queryKey: ['refund-requests', status], queryFn: () => getRefundRequests(status) })
}
export function useApproveRefundRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: approveRefundRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refund-requests'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Refund approved')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useDenyRefundRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DenyRefundRequestInput }) => denyRefundRequest(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refund-requests'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Refund request denied')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
