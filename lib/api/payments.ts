import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createPaymentSchema } from '@/lib/validation/payment.schema'

export type Payment = { id: string; orderId: string; method: string; amount: number; discount: number; notes: string | null; createdAt: string }
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>

export const createPayment = (data: CreatePaymentInput) =>
  apiFetch<Payment>('/api/payments', { method: 'POST', body: JSON.stringify(data) })

export function useCreatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Payment recorded')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
