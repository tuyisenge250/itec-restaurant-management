import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createPaymentSchema } from '@/lib/validation/payment.schema'

export type Payment = {
  id: string; orderId: string; method: 'cash' | 'card' | 'momo' | 'other'
  amount: number; discount: number; notes: string | null; createdAt: string
  recordedById: string
  recordedBy: { name: string }
}
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>

export const getPayments = (orderId: string) => apiFetch<Payment[]>(`/api/payments?orderId=${orderId}`)
export const createPayment = (data: CreatePaymentInput) =>
  apiFetch<Payment>('/api/payments', { method: 'POST', body: JSON.stringify(data) })

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
