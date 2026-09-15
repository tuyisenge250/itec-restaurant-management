import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createPaymentSchema, refundPaymentSchema } from '@/lib/validation/payment.schema'

export type Refund = { id: string; paymentId: string; amount: number; reason: string | null; createdAt: string }
export type Payment = {
  id: string; orderId: string; method: 'cash' | 'card' | 'momo' | 'other'
  amount: number; discount: number; notes: string | null; createdAt: string
  refunds: Refund[]
}
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>

export const getPayments = (orderId: string) => apiFetch<Payment[]>(`/api/payments?orderId=${orderId}`)
export const createPayment = (data: CreatePaymentInput) =>
  apiFetch<Payment>('/api/payments', { method: 'POST', body: JSON.stringify(data) })
export const refundPayment = (paymentId: string, data: RefundPaymentInput) =>
  apiFetch<Payment>(`/api/payments/${paymentId}/refund`, { method: 'POST', body: JSON.stringify(data) })

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
